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
        // Treat a missing mix as a full shortfall so the caller aborts the batch
        // rather than silently racking unseasoned product.
        results.push({ spice_mix_id: mixId, spice_mix_name: 'Unknown', deducted_lbs: 0, remaining_lbs: 0, shortfall: qty, committed: false });
        continue;
      }

      const current = mix.available_qty_lbs ?? mix.quantity_lbs ?? 0;

      // CHECK-THEN-COMMIT: if there isn't enough, deduct NOTHING and report the
      // shortfall. Previously we deducted down to 0 and reported a shortfall after
      // the write had already committed, so a retry double-deducted.
      if (qty - current > 0.01) {
        console.warn(`Spice mix "${mix.name}" short by ${(qty - current).toFixed(2)} lbs — NO deduction written.`);
        results.push({ spice_mix_id: mix.id, spice_mix_name: mix.name, deducted_lbs: 0, remaining_lbs: current, shortfall: parseFloat((qty - current).toFixed(2)), committed: false });
        continue;
      }

      const newQty = parseFloat(Math.max(0, current - qty).toFixed(2));

      await base44.asServiceRole.entities.SpiceMix.update(mix.id, {
        available_qty_lbs: newQty,
        status: newQty <= 0 ? 'archived' : mix.status,
      });

      // ── Also deplete the matching RawInventory "produced mix" lots (FIFO) ──
      // Producing a mix batch creates RawInventory lots (lot_number "SM-...") in a
      // spice bucket named after the mix. Those lot copies must shrink too, otherwise
      // they keep showing on the bucket cards after the mix is consumed.
      const consumed_lots = [];
      try {
        const mixLots = (await base44.asServiceRole.entities.RawInventory.filter(
          { bucket_name: mix.name },
          'received_date',
          200
        )).filter(l => (l.available_qty || 0) > 0 && l.status !== 'depleted');

        let toRemove = qty;
        for (const lot of mixLots) {
          if (toRemove <= 0.001) break;
          const take = parseFloat(Math.min(lot.available_qty || 0, toRemove).toFixed(2));
          const lotNewQty = parseFloat(Math.max(0, (lot.available_qty || 0) - take).toFixed(2));
          await base44.asServiceRole.entities.RawInventory.update(lot.id, {
            available_qty: lotNewQty,
            status: lotNewQty <= 0 ? 'depleted' : 'in_use',
          });
          consumed_lots.push({
            bucket_id: lot.bucket_id || "",
            bucket_name: mix.name,
            spice_mix_id: mix.id,
            raw_inventory_id: lot.id,
            lot_number: lot.lot_number || "",
            lbs: take,
          });
          toRemove -= take;
        }
      } catch (e) {
        console.warn(`Could not sync raw mix lots for "${mix.name}": ${e.message}`);
      }
      // No produced-batch lot on record — still stamp the mix itself so the trace
      // is never blind to the spice that went in.
      if (consumed_lots.length === 0) {
        consumed_lots.push({ bucket_name: mix.name, spice_mix_id: mix.id, lot_number: `MIX-${mix.name}`, lbs: qty });
      }

      results.push({
        spice_mix_id: mix.id,
        spice_mix_name: mix.name,
        deducted_lbs: qty,
        remaining_lbs: newQty,
        shortfall: 0,
        committed: true,
        consumed_lots,
      });
    }

    const total_shortfall = parseFloat(
      results.reduce((s, r) => s + (Number(r.shortfall) || 0), 0).toFixed(2)
    );
    const consumed_lots = results.flatMap(r => r.consumed_lots || []);

    return Response.json({ success: true, stage_id, results, total_shortfall, consumed_lots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});