import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Deducts SpiceMix inventory (available_qty_lbs) when a stage consumes assigned spice.
 *
 * Payload:
 *   stage_id: string
 *   lots: Array<{ spice_mix_id: string, spice_mix_qty_lbs: number }>
 *         (also accepts { id, qty_lbs } / { actual_lbs } shapes)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lots, stage_id } = await req.json();

    if (!lots || !Array.isArray(lots) || lots.length === 0) {
      return Response.json({ error: 'Missing or empty lots array' }, { status: 400 });
    }

    const results = [];

    // Aggregate quantities per spice mix so multiple lot rows pointing at the
    // same SpiceMix are deducted in a single read+write (avoids self-races).
    const byMix = new Map();
    for (const lot of lots) {
      const mixId = lot.spice_mix_id || lot.id;
      const qty = Number(lot.spice_mix_qty_lbs ?? lot.qty_lbs ?? lot.actual_lbs ?? 0);
      if (!mixId || !qty || qty <= 0) continue;
      byMix.set(mixId, (byMix.get(mixId) || 0) + qty);
    }

    for (const [mixId, qty] of byMix.entries()) {
      // Re-read the latest value immediately before updating to minimise the
      // window for a lost update when stages complete close together.
      let mix = null;
      try {
        mix = await base44.asServiceRole.entities.SpiceMix.get(mixId);
      } catch (_e) {
        mix = null;
      }
      if (!mix) {
        console.warn(`SpiceMix not found: ${mixId}`);
        continue;
      }

      const current = mix.available_qty_lbs ?? mix.quantity_lbs ?? 0;
      const newQty = parseFloat(Math.max(0, current - qty).toFixed(2));

      await base44.asServiceRole.entities.SpiceMix.update(mix.id, {
        available_qty_lbs: newQty,
        status: newQty <= 0 ? 'archived' : mix.status,
      });

      results.push({
        spice_mix_id: mix.id,
        spice_mix_name: mix.name,
        deducted_lbs: qty,
        remaining_lbs: newQty,
        shortfall: parseFloat(Math.max(0, qty - current).toFixed(2)),
      });

      if (qty > current) {
        console.warn(`Spice mix "${mix.name}" short by ${(qty - current).toFixed(2)} lbs`);
      }
    }

    return Response.json({ success: true, stage_id, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});