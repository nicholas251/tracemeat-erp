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
  return { expectedLbs, packedLbs, diffLbs, yieldPct };
}

// Stamps the actual packed weight on the stage and notes any gain/loss.
export function applyPackYield(updates, stage, form, product) {
  const y = computePackYield(stage, form, product);
  updates.output_qty_lbs = y.packedLbs;
  if (Math.abs(y.diffLbs) >= 0.01) {
    const note = `Packing yield ${y.diffLbs > 0 ? "gain" : "loss"}: ${y.diffLbs > 0 ? "+" : ""}${y.diffLbs} lbs (${y.yieldPct}%)`;
    updates.notes = [updates.notes, note].filter(Boolean).join(" · ");
  }
}