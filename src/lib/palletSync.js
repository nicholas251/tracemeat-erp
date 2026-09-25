import { base44 } from "@/api/base44Client";

// Stamp each finished-goods lot with the spot(s) its cases sit in, so lot views show it.
export async function syncItemLocations(itemIds) {
  const pallets = await base44.entities.Pallet.filter({ status: "stored" });
  for (const id of new Set(itemIds)) {
    const spots = pallets
      .filter(p => (p.lots || []).some(l => l.inventory_item_id === id))
      .map(p => p.location);
    await base44.entities.InventoryItem.update(id, { location: [...new Set(spots)].sort().join(", ") });
  }
}