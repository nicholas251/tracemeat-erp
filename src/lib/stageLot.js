// ─── Standardized stage lot numbering ────────────────────────────────────────
// One consistent, parseable lot format across every production stage so anyone
// can read a lot and instantly know the date, order, and stage.
//
//   Format:  <YYYYMMDD>-<ORDER>-<STAGE>[-B<n>]
//   Example: 20260610-PO724531-CHOP
//            20260610-PO724531-TUMBLE-B2
//
// Lots are AUTO-GENERATED and locked — operators never type them. This keeps
// traceability uniform across all flows.

// Short, human-readable stage codes per capability key.
const STAGE_CODES = {
  blending: "BLEND",
  chopping: "CHOP",
  mixer: "MIX",
  linking: "LINK",
  tumbling: "TUMBLE",
  tumble: "TUMBLE",
  racking: "RACK",
  racking_product: "RACK",
  cooking: "COOK",
  chilling: "CHILL",
  packaging: "FG",
  sous_vide_pack: "PACK",
};

export function stageCode(capabilityKey) {
  return STAGE_CODES[capabilityKey] || (capabilityKey || "STAGE").toUpperCase().slice(0, 6);
}

function datePart(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function orderPart(orderNumber) {
  return (orderNumber || "").replace(/[^A-Za-z0-9]/g, "") || "ORD";
}

// Build a standardized stage lot: <DATE>-<ORDER>-<STAGE>[-B<batchNumber>]
export function buildStageLot({ orderNumber, capabilityKey, batchNumber = null, date }) {
  const parts = [datePart(date), orderPart(orderNumber), stageCode(capabilityKey)];
  let lot = parts.join("-");
  if (batchNumber != null) lot += `-B${batchNumber}`;
  return lot;
}