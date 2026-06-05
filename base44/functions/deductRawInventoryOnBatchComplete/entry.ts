import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Deducts raw inventory (RawInventory lots) for a completed blending stage.
 * 
 * Payload:
 *   ingredients: Array<{ bucket_id: string, actual_lbs: number, bucket_name: string }>
 *   stage_id: string
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ingredients, stage_id } = await req.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return Response.json({ error: 'Missing or empty ingredients array' }, { status: 400 });
    }

    const results = [];

    for (const ing of ingredients) {
      const { bucket_id, actual_lbs, bucket_name, lot_allocations } = ing;
      if (!bucket_id || !actual_lbs) continue;

      let remaining = actual_lbs;

      // ── Preferred path: deduct from the EXACT lots the operator assigned ──
      // The operator may assign the full quantity of a lot (or more than what's
      // recorded as available). We deduct exactly what they assigned per lot.
      const explicit = (lot_allocations || []).filter(a => a?.raw_inventory_id && (Number(a.actual_lbs) || 0) > 0);
      if (explicit.length > 0) {
        for (const a of explicit) {
          const lot = await base44.asServiceRole.entities.RawInventory.filter({ id: a.raw_inventory_id }).then(r => r?.[0]);
          if (!lot) continue;
          const assigned = Number(a.actual_lbs) || 0;
          const newQty = parseFloat(((lot.available_qty || 0) - assigned).toFixed(2));
          await base44.asServiceRole.entities.RawInventory.update(lot.id, {
            available_qty: Math.max(0, newQty),
            status: newQty <= 0 ? 'depleted' : 'in_use',
          });
          remaining -= assigned;
        }
        results.push({
          bucket_name: bucket_name || bucket_id,
          requested_lbs: actual_lbs,
          shortfall: 0,
        });
        continue;
      }

      // ── Fallback: FIFO across the bucket when no explicit lots were assigned ──
      const allLots = await base44.asServiceRole.entities.RawInventory.filter(
        { bucket_id },
        'received_date',
        100
      );
      const lots = allLots.filter(l => (l.status === 'available' || l.status === 'in_use') && (l.available_qty || 0) > 0);

      for (const lot of lots) {
        if (remaining <= 0) break;
        const deduct = Math.min(lot.available_qty || 0, remaining);
        remaining -= deduct;
        const newQty = parseFloat(((lot.available_qty || 0) - deduct).toFixed(2));
        await base44.asServiceRole.entities.RawInventory.update(lot.id, {
          available_qty: Math.max(0, newQty),
          status: newQty <= 0 ? 'depleted' : 'in_use',
        });
      }

      results.push({
        bucket_name: bucket_name || bucket_id,
        requested_lbs: actual_lbs,
        shortfall: parseFloat(Math.max(0, remaining).toFixed(2)),
      });

      if (remaining > 0) {
        console.warn(`Insufficient inventory for bucket "${bucket_name}": ${remaining} lbs short`);
      }
    }

    return Response.json({ success: true, stage_id, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});