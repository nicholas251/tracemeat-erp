import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
      if (!bucket_id || !(Number(actual_lbs) > 0)) {
        console.warn(`Skipping ingredient — bucket_id=${bucket_id}, actual_lbs=${actual_lbs}`);
        continue;
      }
      console.log(`Deducting ${actual_lbs} lbs from bucket ${bucket_id} (${bucket_name})`);

      let remaining = actual_lbs;
      const usedLotIds = new Set();

      // ── Preferred path: deduct from the EXACT lots the operator assigned ──
      // The backend is the SINGLE SOURCE OF TRUTH: we re-read each lot's LIVE
      // available_qty (never trusting the frontend's snapshot, which may be stale
      // after a sibling batch deducted), and take only what's actually there.
      // Any leftover the assigned lots couldn't cover rolls into the FIFO sweep.
      const explicit = (lot_allocations || []).filter(a => a?.raw_inventory_id && (Number(a.actual_lbs) || 0) > 0);
      for (const a of explicit) {
        if (remaining <= 0) break;
        const lot = await base44.asServiceRole.entities.RawInventory
          .filter({ id: a.raw_inventory_id })
          .then(r => r?.[0]);
        if (!lot) continue;
        const liveAvail = Number(lot.available_qty) || 0;
        // Take the smaller of: what the operator assigned, what we still need,
        // and what the lot actually holds right now.
        const deduct = parseFloat(Math.min(Number(a.actual_lbs) || 0, remaining, liveAvail).toFixed(2));
        if (deduct <= 0) { usedLotIds.add(lot.id); continue; }
        const newQty = parseFloat((liveAvail - deduct).toFixed(2));
        await base44.asServiceRole.entities.RawInventory.update(lot.id, {
          available_qty: Math.max(0, newQty),
          status: newQty <= 0 ? 'depleted' : 'in_use',
        });
        remaining = parseFloat((remaining - deduct).toFixed(2));
        usedLotIds.add(lot.id);
      }

      // ── FIFO sweep ──
      // Runs when no explicit lots were assigned, OR when the explicit lots
      // couldn't cover the full requirement (live qty was lower than assigned).
      if (remaining > 0.001) {
        const allLots = await base44.asServiceRole.entities.RawInventory.filter(
          { bucket_id },
          'received_date',
          200
        );
        // Stable FIFO: received_date, then created_date, then id — so same-day
        // lots always deduct in a deterministic order.
        const lots = allLots
          .filter(l => (l.status === 'available' || l.status === 'in_use') && (Number(l.available_qty) || 0) > 0 && !usedLotIds.has(l.id))
          .sort((x, y) => {
            const dx = x.received_date || x.created_date || "";
            const dy = y.received_date || y.created_date || "";
            if (dx !== dy) return dx < dy ? -1 : 1;
            const cx = x.created_date || "";
            const cy = y.created_date || "";
            if (cx !== cy) return cx < cy ? -1 : 1;
            return (x.id || "") < (y.id || "") ? -1 : 1;
          });

        for (const lot of lots) {
          if (remaining <= 0) break;
          const liveAvail = Number(lot.available_qty) || 0;
          const deduct = parseFloat(Math.min(liveAvail, remaining).toFixed(2));
          remaining = parseFloat((remaining - deduct).toFixed(2));
          const newQty = parseFloat((liveAvail - deduct).toFixed(2));
          await base44.asServiceRole.entities.RawInventory.update(lot.id, {
            available_qty: Math.max(0, newQty),
            status: newQty <= 0 ? 'depleted' : 'in_use',
          });
        }
      }

      const shortfall = parseFloat(Math.max(0, remaining).toFixed(2));
      results.push({
        bucket_name: bucket_name || bucket_id,
        requested_lbs: actual_lbs,
        shortfall,
      });

      if (shortfall > 0) {
        console.warn(`Insufficient inventory for bucket "${bucket_name}": ${shortfall} lbs short`);
      }
    }

    const total_shortfall = parseFloat(
      results.reduce((s, r) => s + (Number(r.shortfall) || 0), 0).toFixed(2)
    );

    return Response.json({ success: true, stage_id, results, total_shortfall });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});