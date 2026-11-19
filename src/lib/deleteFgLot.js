import { base44 } from "@/api/base44Client";
import { logAudit } from "@/lib/auditLog";
import { clearItemsFromPallets } from "@/lib/palletSync";

// Removes a finished-goods lot everywhere (bucket + inventory items) and logs who did it.
export async function deleteFgLot({ productId, productName, lotNumber, initials, reason }) {
  const [bucket] = await base44.entities.FinishedGoodsBucket.filter({ product_id: productId });
  const items = await base44.entities.InventoryItem.filter({ product_id: productId, lot_number: lotNumber });

  let lbs = items.reduce((s, i) => s + (i.quantity_lbs || 0), 0);
  let cases = 0;
  if (bucket) {
    const removed = (bucket.lots || []).filter(l => l.lot_number === lotNumber);
    const bucketLbs = removed.reduce((s, l) => s + (l.quantity_lbs || 0), 0);
    cases = removed.reduce((s, l) => s + (l.cases || 0), 0);
    lbs = Math.max(lbs, bucketLbs);
    const qty = Math.max(0, (bucket.quantity_lbs || 0) - bucketLbs);
    const cw = bucket.case_weight_lbs;
    await base44.entities.FinishedGoodsBucket.update(bucket.id, {
      lots: (bucket.lots || []).filter(l => l.lot_number !== lotNumber),
      quantity_lbs: qty,
      cases_on_hand: cw ? Math.floor(qty / cw) : Math.max(0, (bucket.cases_on_hand || 0) - cases),
    });
  }
  // The lot record can carry a different lot number than the on-hand lot, so also remove any
  // of this product's available lot records that no longer match a lot left on hand.
  // Left behind, they stay pickable on sales orders.
  let orphans = [];
  if (bucket) {
    const kept = new Set((bucket.lots || []).filter(l => l.lot_number !== lotNumber).map(l => l.lot_number));
    const live = await base44.entities.InventoryItem.filter({ product_id: productId, status: "available" });
    orphans = live.filter(i => i.lot_number !== lotNumber && !kept.has(i.lot_number));
  }
  const gone = [...items, ...orphans];
  await Promise.all(gone.map(i => base44.entities.InventoryItem.delete(i.id)));
  await clearItemsFromPallets(gone.map(i => i.id));

  await logAudit({
    action: "deleted",
    product_name: productName,
    lot_number: lotNumber,
    quantity_lbs: lbs,
    cases,
    initials,
    reason: reason || "",
    details: `Lot removed from inventory (${lbs} lbs, ${cases} cases)`,
  });
}