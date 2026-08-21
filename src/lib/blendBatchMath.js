// ── Blending batch math — SINGLE SOURCE OF TRUTH ─────────────────────────────
// Used by the production-order form, the blending dashboard, and the batch wizard
// so every screen always agrees on batch size and batch count.

// Full chop-batch weight = protein + water + spice + cure. Falls back to 240 lbs
// only when the product has no batch configuration at all.
export function fullChopBatchLbs(product) {
  const total =
    (Number(product?.blend_batch_lbs) || 0) +
    (Number(product?.chop_water_lbs) || 0) +
    (Number(product?.chop_spice_qty_lbs) || 0) +
    (Number(product?.chop_cure_lbs) || 0);
  return total > 0 ? total : 240;
}

// Batch count: round up, unless the trailing fraction is 0.15 or less — that small
// a remainder isn't worth running an extra full batch, so it rounds down (the
// remainder is absorbed into the last batch). Never returns 0 for a real quantity.
export function calcBlendBatchCount(totalLbs, batchSizeLbs) {
  const total = Number(totalLbs) || 0;
  const size = Number(batchSizeLbs) || 0;
  if (total <= 0 || size <= 0) return 0;
  const raw = total / size;
  const count = raw - Math.floor(raw) <= 0.15 ? Math.floor(raw) : Math.ceil(raw);
  return Math.max(1, count);
}