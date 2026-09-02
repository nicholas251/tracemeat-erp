import { base44 } from "@/api/base44Client";

// Keep the product's FinishedGoodsBucket (on-hand lbs + cases, per-lot) in step with a
// finished-goods hold. Pass a negative deltaLbs when placing a hold, positive on release.
export async function adjustFgBucketForHold(inventoryItem, deltaLbs) {
  if (!inventoryItem?.product_id || !deltaLbs) return;
  const bucket = (await base44.entities.FinishedGoodsBucket.filter({ product_id: inventoryItem.product_id }))[0];
  if (!bucket) return;

  const caseWeight = Number(bucket.case_weight_lbs) || 0;
  const deltaCases = caseWeight > 0 ? Math.round(deltaLbs / caseWeight) : 0;

  const lots = (bucket.lots || []).map(lot => {
    if (lot.lot_number !== inventoryItem.lot_number) return lot;
    const qty = Math.max(0, (lot.quantity_lbs || 0) + deltaLbs);
    return {
      ...lot,
      quantity_lbs: parseFloat(qty.toFixed(2)),
      cases: Math.max(0, (lot.cases || 0) + deltaCases),
      status: qty <= 0 ? "reserved" : "available",
    };
  });

  await base44.entities.FinishedGoodsBucket.update(bucket.id, {
    quantity_lbs: parseFloat(Math.max(0, (bucket.quantity_lbs || 0) + deltaLbs).toFixed(2)),
    cases_on_hand: Math.max(0, (bucket.cases_on_hand || 0) + deltaCases),
    lots,
  });
}