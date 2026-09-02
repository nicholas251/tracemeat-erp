// Shape the lots a deduction function reports back into ProductionStage.consumed_lots
// entries. `materialType` is protein | spice | cure | casing.
export function tagConsumedLots(lots, materialType, extra = {}) {
  return (lots || [])
    .filter(l => (Number(l.lbs) || 0) > 0)
    .map(l => ({
      material_type: materialType,
      bucket_id: l.bucket_id || "",
      bucket_name: l.bucket_name || "",
      raw_inventory_id: l.raw_inventory_id || "",
      spice_mix_id: l.spice_mix_id || "",
      lot_number: l.lot_number || "",
      supplier: l.supplier || "",
      po_number: l.po_number || "",
      received_date: l.received_date || "",
      lbs: parseFloat(Number(l.lbs).toFixed(2)),
      ...extra,
    }));
}