import { base44 } from "@/api/base44Client";

// Returns every raw-inventory lot an order's stages consumed back to inventory,
// then removes the order's stage cards.
export async function restoreOrderInventory(orderId) {
  const page = await base44.entities.ProductionStage.filter({ order_id: orderId }, { limit: 500 });
  const stages = page.items;
  const add = {};
  for (const s of stages) {
    for (const c of s.consumed_lots || []) {
      if (c.raw_inventory_id && c.lbs) add[c.raw_inventory_id] = (add[c.raw_inventory_id] || 0) + c.lbs;
    }
  }
  for (const [id, lbs] of Object.entries(add)) {
    // A lot that has since been removed from raw inventory has nothing to restore to.
    const [lot] = await base44.entities.RawInventory.filter({ id });
    if (!lot) continue;
    const available = Math.round(((lot.available_qty || 0) + lbs) * 100) / 100;
    await base44.entities.RawInventory.update(id, { available_qty: available, status: "available" });
  }
  const mixAdd = {};
  for (const s of stages) {
    for (const c of s.consumed_lots || []) {
      if (c.spice_mix_id && c.lbs) mixAdd[c.spice_mix_id] = (mixAdd[c.spice_mix_id] || 0) + c.lbs;
    }
  }
  for (const [id, lbs] of Object.entries(mixAdd)) {
    const [mix] = await base44.entities.SpiceMix.filter({ id });
    if (!mix) continue;
    await base44.entities.SpiceMix.update(id, { available_qty_lbs: Math.round(((mix.available_qty_lbs || 0) + lbs) * 100) / 100 });
  }
  if (stages.length) await base44.entities.ProductionStage.deleteMany({ order_id: orderId });
  // Racks belong to the order too — left behind, they would stay on offer at the smokehouse.
  await base44.entities.RackUnit.deleteMany({ order_id: orderId });
}