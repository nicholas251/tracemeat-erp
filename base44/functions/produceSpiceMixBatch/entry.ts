import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spiceMixId, batchQtyLbs } = await req.json();
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

    for (const ingredient of mix.ingredients) {
      const neededLbs = ingredient.quantity_lbs * scaleFactor;

      // Get available RawInventory lots for this bucket (FIFO by received_date)
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

    // Update spice mix available qty
    const newAvailable = (mix.available_qty_lbs || 0) + batchQtyLbs;
    await base44.asServiceRole.entities.SpiceMix.update(spiceMixId, {
      available_qty_lbs: newAvailable
    });

    return Response.json({
      success: true,
      batchProduced: batchQtyLbs,
      newAvailableQty: newAvailable,
      deductions,
      shortfalls
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});