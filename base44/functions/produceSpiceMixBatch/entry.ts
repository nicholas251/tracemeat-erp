import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const TOL = 0.01;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spiceMixId, batchQtyLbs, ingredientLots, partialInitials, multiLotInitials } = await req.json().catch(() => ({}));
    const batchQty = Number(batchQtyLbs) || 0;
    if (!spiceMixId || batchQty <= 0) {
      return Response.json({ error: 'spiceMixId and batchQtyLbs are required' }, { status: 400 });
    }

    const mix = await base44.asServiceRole.entities.SpiceMix.get(spiceMixId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!mix) {
      return Response.json({ error: 'Spice mix not found' }, { status: 404 });
    }
    if (!mix.ingredients || mix.ingredients.length === 0 || !(Number(mix.quantity_lbs) > 0)) {
      return Response.json({ error: 'Spice mix has no ingredients' }, { status: 400 });
    }

    // What this batch needs from each ingredient bucket.
    const scale = batchQty / mix.quantity_lbs;
    const required = new Map();
    for (const ing of mix.ingredients) {
      const lbs = (Number(ing.quantity_lbs) || 0) * scale;
      if (!ing.bucket_id || lbs <= 0) continue;
      const cur = required.get(ing.bucket_id) || { name: ing.bucket_name || 'Ingredient', lbs: 0 };
      cur.lbs += lbs;
      required.set(ing.bucket_id, cur);
    }
    for (const r of required.values()) r.lbs = r2(r.lbs);

    // Live usable stock for those buckets, oldest first.
    const res = await base44.asServiceRole.entities.RawInventory.filter(
      { bucket_id: { $in: [...required.keys()] }, status: { $in: ['available', 'in_use'] } },
      { sort: 'received_date', limit: 1000 },
    );
    const rows = (Array.isArray(res) ? res : res.items || []).filter((r) => (r.available_qty || 0) > 0);
    const rowsById = new Map(rows.map((r) => [r.id, r]));

    // The lots to take from: the operator's confirmed lots, or oldest-first when none were sent.
    const plan = new Map(); // bucket_id -> [{ row_id, lot_number, lbs }]
    if (Array.isArray(ingredientLots) && ingredientLots.length > 0) {
      for (const ing of ingredientLots) {
        for (const lot of (ing.lots || [])) {
          const take = Number(lot.actual_lbs) || 0;
          if (take <= 0) continue;
          const list = plan.get(ing.bucket_id) || [];
          list.push({ row_id: lot.raw_inventory_id, lot_number: lot.lot_number, lbs: take });
          plan.set(ing.bucket_id, list);
        }
      }
    } else {
      for (const [bucketId, need] of required) {
        let remaining = need.lbs;
        const list = [];
        for (const row of rows.filter((r) => r.bucket_id === bucketId)) {
          if (remaining <= TOL) break;
          const take = r2(Math.min(row.available_qty, remaining));
          list.push({ row_id: row.id, lot_number: row.lot_number, lbs: take });
          remaining = r2(remaining - take);
        }
        plan.set(bucketId, list);
      }
    }

    // Strict check, before anything is touched: every ingredient fully covered by real stock.
    const problems = [];
    const takeByRow = new Map();
    for (const [bucketId, need] of required) {
      const list = plan.get(bucketId) || [];
      let total = 0;
      for (const l of list) {
        const row = rowsById.get(l.row_id);
        if (!row || row.bucket_id !== bucketId) {
          problems.push(`${need.name}: lot ${l.lot_number || '(none)'} is not in stock`);
          continue;
        }
        takeByRow.set(row.id, (takeByRow.get(row.id) || 0) + l.lbs);
        total += l.lbs;
      }
      total = r2(total);
      if (total < need.lbs - TOL) problems.push(`${need.name}: short by ${r2(need.lbs - total)} lbs (needs ${need.lbs})`);
      if (total > need.lbs + TOL) problems.push(`${need.name}: over by ${r2(total - need.lbs)} lbs (needs ${need.lbs})`);
    }
    for (const [rowId, take] of takeByRow) {
      const row = rowsById.get(rowId);
      if (take > (row.available_qty || 0) + TOL) {
        problems.push(`${row.bucket_name}: lot ${row.lot_number} only has ${r2(row.available_qty)} lbs, ${r2(take)} lbs requested`);
      }
    }
    if (problems.length) {
      return Response.json({
        error: `Not enough ingredient inventory. Nothing was deducted. ${problems.join('; ')}`,
        problems,
      }, { status: 400 });
    }

    // An ingredient covered by more than one lot must be signed off.
    const multiLot = [...required].filter(([bucketId]) => new Set((plan.get(bucketId) || []).map((l) => l.row_id)).size > 1);
    const signOff = String(multiLotInitials || '').trim().toUpperCase();
    if (multiLot.length && signOff.length < 2) {
      return Response.json({
        error: `Initials are required: ${multiLot.map(([, n]) => n.name).join(', ')} is covered by more than one lot.`,
      }, { status: 400 });
    }

    // Deduct.
    const deductions = [];
    for (const [bucketId, need] of required) {
      for (const l of (plan.get(bucketId) || [])) {
        const row = rowsById.get(l.row_id);
        const newQty = r2((row.available_qty || 0) - l.lbs);
        row.available_qty = newQty;
        await base44.asServiceRole.entities.RawInventory.update(row.id, {
          available_qty: Math.max(0, newQty),
          status: newQty <= 0 ? 'depleted' : 'in_use',
        });
        deductions.push({ bucket_id: bucketId, bucket_name: need.name, lot_number: row.lot_number, lot_id: row.id, deducted: l.lbs });
      }
    }

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const lotNumber = `SM-${datePart}-${Math.floor(now.getTime() / 1000).toString().slice(-5)}`;

    // Ensure the mix has an is_mix spice bucket so the produced batch can be tracked as a lot.
    let bucketId = mix.bucket_id;
    let bucketName = mix.bucket_name || mix.name;
    if (!bucketId) {
      const existing = await base44.asServiceRole.entities.InventoryBucket.filter({ name: mix.name, category: 'spice', is_mix: true });
      const bucket = existing[0] || await base44.asServiceRole.entities.InventoryBucket.create({
        name: mix.name, category: 'spice', is_mix: true, unit: 'lbs', code: '', description: '', status: 'active',
      });
      bucketId = bucket.id;
      bucketName = bucket.name;
    }
    const newAvailable = (mix.available_qty_lbs || 0) + batchQty;
    await base44.asServiceRole.entities.SpiceMix.update(spiceMixId, {
      available_qty_lbs: newAvailable,
      bucket_id: bucketId,
      bucket_name: bucketName,
      status: mix.status === 'archived' ? 'active' : mix.status,
    });

    // Document any ingredient that needed more than one lot.
    const multiLotLines = multiLot.map(([id, need]) => {
      const parts = deductions.filter((d) => d.bucket_id === id).map((d) => `${d.lot_number} (${r2(d.deducted)} lbs)`);
      return `${need.name} covered by lots ${parts.join(' + ')}`;
    });
    const notes = [
      partialInitials ? `Partial batch (${batchQty} of ${mix.quantity_lbs} lbs) — confirmed by ${partialInitials}` : '',
      multiLotLines.length ? `Multi-lot: ${multiLotLines.join('; ')} — confirmed by ${signOff}` : '',
    ].filter(Boolean).join('\n');

    await base44.asServiceRole.entities.RawInventory.create({
      bucket_id: bucketId,
      bucket_name: bucketName,
      bucket_category: 'spice',
      lot_number: lotNumber,
      description: `Produced spice mix batch — ${mix.name}`,
      quantity: batchQty,
      available_qty: batchQty,
      unit: 'lbs',
      received_date: now.toISOString().slice(0, 10),
      status: 'available',
      ...(notes ? { notes } : {}),
      // Recall traceability: which raw spice lots went into this produced mix batch.
      component_lots: deductions.map((d) => ({
        bucket_name: d.bucket_name || '',
        lot_number: d.lot_number || '',
        raw_inventory_id: d.lot_id || '',
        lbs: r2(d.deducted),
      })),
    });

    if (multiLotLines.length) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'manual_entry',
        area: 'Spice Mixes',
        product_name: mix.name,
        lot_number: lotNumber,
        quantity_lbs: batchQty,
        details: `Ingredient covered by more than one lot: ${multiLotLines.join('; ')}`,
        initials: signOff,
        user_name: user.full_name || '',
        user_email: user.email || '',
      });
    }

    return Response.json({
      success: true,
      batchProduced: batchQty,
      lotNumber,
      newAvailableQty: newAvailable,
      deductions,
      multiLot: multiLotLines,
      shortfalls: [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}