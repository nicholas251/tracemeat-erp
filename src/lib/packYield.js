// Packing yield: what actually went into inventory (cases + splits + parked carry-over)
// versus what came in from cooling (plus any carry-over pulled in). Packing weights vary
// product to product, so a gain or loss is allowed and simply reported.
export function computePackYield(stage, form, product) {
  const carryoverLbs = (form.carryover_records || []).reduce((s, r) => s + (r.lbs || 0), 0);
  const expectedLbs = parseFloat(((stage?.input_qty_lbs || 0) + carryoverLbs).toFixed(2));
  const originalLbs = (Number(form.packages_produced) || 0) * (product?.case_weight_lbs || 0);
  const splits = Array.isArray(form.finished_product_splits) ? form.finished_product_splits : [];
  const splitLbs = splits.reduce((s, raw) => {
    const sp = typeof raw === "string" ? JSON.parse(raw) : raw;
    return s + ((Number(sp?.quantity_cases) || 0) * (Number(sp?.case_weight_lbs) || 0));
  }, 0);
  const unfinishedLbs = form.unfinished_allocated ? (Number(form.unfinished_remainder_lbs) || 0) : 0;
  const packedLbs = parseFloat((originalLbs + splitLbs + unfinishedLbs).toFixed(2));
  const diffLbs = parseFloat((packedLbs - expectedLbs).toFixed(2));
  const yieldPct = expectedLbs > 0 ? parseFloat(((packedLbs / expectedLbs) * 100).toFixed(1)) : 0;
  // Cook yield vs set point: back out the raw oven weight from the cooled weight
  // (cooled = raw × set-point yield), then compare what was actually packed from it.
  // Carry-over is excluded — it wasn't cooked in this run.
  const setYield = Number(product?.yield_percent) || 0;
  let cook = null;
  if (setYield > 0 && (stage?.input_qty_lbs || 0) > 0) {
    const rawLbs = (stage.input_qty_lbs) / (setYield / 100);
    const actualYield = ((packedLbs - carryoverLbs) / rawLbs) * 100;
    cook = {
      rawLbs: parseFloat(rawLbs.toFixed(2)),
      setYield,
      actualYield: parseFloat(actualYield.toFixed(1)),
      setLoss: parseFloat((100 - setYield).toFixed(1)),
      actualLoss: parseFloat((100 - actualYield).toFixed(1)),
      // + = better than set point (less loss), − = worse (more loss)
      deltaPts: parseFloat((actualYield - setYield).toFixed(1)),
    };
  }
  return { expectedLbs, packedLbs, diffLbs, yieldPct, cook };
}

// Stamps the actual packed weight on the stage and notes any gain/loss.
export function applyPackYield(updates, stage, form, product) {
  const y = computePackYield(stage, form, product);
  updates.output_qty_lbs = y.packedLbs;
  if (Math.abs(y.diffLbs) >= 0.01) {
    const note = `Packing yield ${y.diffLbs > 0 ? "gain" : "loss"}: ${y.diffLbs > 0 ? "+" : ""}${y.diffLbs} lbs (${y.yieldPct}%)`;
    updates.notes = [updates.notes, note].filter(Boolean).join(" · ");
  }
  if (y.cook && y.packedLbs > 0) {
    const c = y.cook;
    const cookNote = `Cook loss ${c.actualLoss}% vs set point ${c.setLoss}% (${c.deltaPts >= 0 ? "+" : ""}${c.deltaPts} pts yield)`;
    updates.notes = [updates.notes, cookNote].filter(Boolean).join(" · ");
  }
}