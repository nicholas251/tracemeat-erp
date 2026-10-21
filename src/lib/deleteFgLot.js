import { base44 } from "@/api/base44Client";

// Removes a finished-goods lot everywhere (bucket + inventory items) and logs who did it.
export async function deleteFgLot({ productId, productName, lotNumber, initials, reason }) {
  const me = await base44.auth.me();
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
  await Promise.all(items.map(i => base44.entities.InventoryItem.delete(i.id)));

  await base44.entities.FGLotDeletion.create({
    product_id: productId,
    product_name: productName,
    lot_number: lotNumber,
    quantity_lbs: lbs,
    cases,
    initials: initials.trim().toUpperCase(),
    reason: reason || "",
    deleted_by_email: me?.email,
    deleted_by_name: me?.full_name,
    deleted_at: new Date().toISOString(),
  });
}