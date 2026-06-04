import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spiceMixId, batchQtyLbs, ingredientLots } = await req.json();
    if (!spiceMixId || !batchQtyLbs) {
      return Response.json({ error: 'spiceMixId and batchQtyLbs are required' }, { status: 400 });
    }

    const mix = await base44.asServiceRole.entities.SpiceMix.get(spiceMixId);
    if (!mix) {
      return Response.json({ error: 'Spice mix not found' }, { status: 404 });
    }

    if (!mix.ingredients || mix.ingredients.length === 0) {
      return Response.json({ error: 'Spice mix has no ingredients' }, { status: 400 });
    }

    // Scale factor: how many times the base recipe we're producing
    const scaleFactor = batchQtyLbs / mix.quantity_lbs;

    const deductions = [];
    const shortfalls = [];

    if (Array.isArray(ingredientLots) && ingredientLots.length > 0) {
      // Operator confirmed exact lots for each ingredient — deduct those
      for (const ing of ingredientLots) {
        for (const lot of (ing.lots || [])) {
          const take = Number(lot.actual_lbs) || 0;
          if (take <= 0 || !lot.raw_inventory_id) continue;

          const row = await base44.asServiceRole.entities.RawInventory.get(lot.raw_inventory_id);
          if (!row) continue;
          const newQty = (row.available_qty || 0) - take;
          await base44.asServiceRole.entities.RawInventory.update(row.id, {
            available_qty: newQty,
            status: newQty <= 0 ? 'depleted' : 'in_use'
          });
          deductions.push({ bucket_name: ing.bucket_name, lot_number: lot.lot_number, lot_id: row.id, deducted: take });
        }
      }
    } else {
      // Fallback: auto FIFO deduction
      for (const ingredient of mix.ingredients) {
        const neededLbs = ingredient.quantity_lbs * scaleFactor;

        const lots = await base44.asServiceRole.entities.RawInventory.filter({
          bucket_id: ingredient.bucket_id,
          status: { $in: ['available', 'in_use'] }
        }, 'received_date', 100);

        let remaining = neededLbs;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const take = Math.min(lot.available_qty || 0, remaining);
          if (take <= 0) continue;

          const newQty = (lot.available_qty || 0) - take;
          await base44.asServiceRole.entities.RawInventory.update(lot.id, {
            available_qty: newQty,
            status: newQty <= 0 ? 'depleted' : 'in_use'
          });

          deductions.push({ bucket_name: ingredient.bucket_name, lot_id: lot.id, deducted: take });
          remaining -= take;
        }

        if (remaining > 0) {
          shortfalls.push({ bucket_name: ingredient.bucket_name, shortfall: remaining });
        }
      }
    }

    // Update spice mix available qty
    const newAvailable = (mix.available_qty_lbs || 0) + batchQtyLbs;
    await base44.asServiceRole.entities.SpiceMix.update(spiceMixId, {
      available_qty_lbs: newAvailable
    });

    // Assign a lot number to this produced batch and create an inventory lot record
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const lotNumber = `SM-${datePart}-${Math.floor(now.getTime() / 1000).toString().slice(-5)}`;

    // Ensure the mix has an is_mix spice bucket so the produced batch can be tracked as a lot.
    // Reuse the linked bucket if present, otherwise find an existing one by name before
    // creating a new one — prevents duplicate buckets for the same mix.
    let bucketId = mix.bucket_id;
    let bucketName = mix.bucket_name || mix.name;
    if (!bucketId) {
      const existing = await base44.asServiceRole.entities.InventoryBucket.filter({
        name: mix.name,
        category: 'spice',
        is_mix: true,
      });
      const bucket = existing[0] || await base44.asServiceRole.entities.InventoryBucket.create({
        name: mix.name,
        category: 'spice',
        is_mix: true,
        unit: 'lbs',
        code: '',
        description: '',
        status: 'active'
      });
      bucketId = bucket.id;
      bucketName = bucket.name;
    }
    // Always persist the resolved bucket link back to the mix (and re-activate it,
    // since producing a batch means the mix is in use again).
    await base44.asServiceRole.entities.SpiceMix.update(spiceMixId, {
      bucket_id: bucketId,
      bucket_name: bucketName,
      status: mix.status === 'archived' ? 'active' : mix.status,
    });

    await base44.asServiceRole.entities.RawInventory.create({
      bucket_id: bucketId,
      bucket_name: bucketName,
      bucket_category: 'spice',
      lot_number: lotNumber,
      description: `Produced spice mix batch — ${mix.name}`,
      quantity: batchQtyLbs,
      available_qty: batchQtyLbs,
      unit: 'lbs',
      received_date: now.toISOString().slice(0, 10),
      status: 'available'
    });

    return Response.json({
      success: true,
      batchProduced: batchQtyLbs,
      lotNumber,
      newAvailableQty: newAvailable,
      deductions,
      shortfalls
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});