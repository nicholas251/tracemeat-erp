import { base44 } from "@/api/base44Client";

// Removes a produced spice-mix lot's lbs from its SpiceMix available total.
// mode "return": puts the unused share of each component spice back into its raw lot.
// mode "discard": the spice is simply written off.
export async function adjustForSpiceMixLotRemoval(lot, mode) {
  const lbs = Number(lot.available_qty) || 0;
  const mix = (await base44.entities.SpiceMix.filter({ bucket_id: lot.bucket_id }))[0];
  if (mix) {
    await base44.entities.SpiceMix.update(mix.id, {
      available_qty_lbs: Math.max(0, (mix.available_qty_lbs || 0) - lbs),
    });
  }
  if (mode !== "return") return;
  const ratio = (Number(lot.quantity) || 0) > 0 ? lbs / Number(lot.quantity) : 1;
  for (const c of lot.component_lots || []) {
    if (!c.raw_inventory_id || !(c.lbs > 0)) continue;
    const raw = await base44.entities.RawInventory.get(c.raw_inventory_id).catch(() => null);
    if (!raw) continue;
    await base44.entities.RawInventory.update(raw.id, {
      available_qty: parseFloat(((raw.available_qty || 0) + c.lbs * ratio).toFixed(2)),
      status: "available",
    });
  }
}

export const isSpiceMixLot = (lot) => (lot?.component_lots || []).length > 0;