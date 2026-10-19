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
    const lot = await base44.entities.RawInventory.get(id);
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
    const mix = await base44.entities.SpiceMix.get(id);
    await base44.entities.SpiceMix.update(id, { available_qty_lbs: Math.round(((mix.available_qty_lbs || 0) + lbs) * 100) / 100 });
  }
  if (stages.length) await base44.entities.ProductionStage.deleteMany({ order_id: orderId });
}