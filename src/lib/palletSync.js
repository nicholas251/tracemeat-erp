import { base44 } from "@/api/base44Client";

// Take finished-goods lots off their pallets once they have fully shipped or been removed,
// so the warehouse map never shows cases that are no longer in stock.
export async function clearItemsFromPallets(itemIds) {
  const ids = new Set(itemIds);
  if (!ids.size) return;
  const pallets = await base44.entities.Pallet.filter({ status: "stored" });
  for (const p of pallets) {
    const lots = (p.lots || []).filter(l => !ids.has(l.inventory_item_id));
    if (lots.length === (p.lots || []).length) continue;
    await base44.entities.Pallet.update(p.id, lots.length ? { lots } : { lots, status: "removed", removed_at: new Date().toISOString() });
  }
}

// Stamp each finished-goods lot with the spot(s) its cases sit in, so lot views show it.
export async function syncItemLocations(itemIds) {
  const pallets = await base44.entities.Pallet.filter({ status: "stored" });
  for (const id of new Set(itemIds)) {
    const spots = pallets
      .filter(p => (p.lots || []).some(l => l.inventory_item_id === id))
      .map(p => `${p.building_name ? `${p.building_name} ` : ""}${p.location}`);
    await base44.entities.InventoryItem.update(id, { location: [...new Set(spots)].sort().join(", ") });
  }
}