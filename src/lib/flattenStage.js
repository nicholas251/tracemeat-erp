import { base44 } from "@/api/base44Client";
import { buildStageLot } from "@/lib/stageLot";
import { tagConsumedLots } from "@/lib/consumedLots";

export const FLATTEN_BATCH_LBS = 600;

// Split an order's raw weight into 600 lb flatten batches, the short batch last.
export function flattenBatchSizes(totalLbs) {
  const full = Math.floor((totalLbs || 0) / FLATTEN_BATCH_LBS);
  const rest = parseFloat(((totalLbs || 0) - full * FLATTEN_BATCH_LBS).toFixed(2));
  const sizes = Array(full).fill(FLATTEN_BATCH_LBS);
  if (rest > 0) sizes.push(rest);
  return sizes;
}

// Takes the flattened weight out of the chosen protein bucket (oldest lot first) and
// records the exact raw lots on the stage. Returns an error message, or null when done.
export async function deductFlattenProtein({ stage, liveStage, form, updates }) {
  const lbs = Number(updates.output_qty_lbs) || Number(stage.input_qty_lbs) || 0;
  updates.output_qty_lbs = lbs;
  if (!updates.output_lot_number) {
    const batchNumber = parseInt((stage.batch_tag || "").match(/flatten-batch-(\d+)/)?.[1], 10) || null;
    updates.output_lot_number = buildStageLot({ orderNumber: stage.order_number, capabilityKey: "flatten", batchNumber });
  }
  const consumed = [...(liveStage?.consumed_lots || [])];
  // Never take it twice if completion is retried.
  if (consumed.some(l => l.material_type === "protein")) return null;
  if (!form.protein_bucket_id) return "Choose the protein bucket being flattened before completing.";

  const res = await base44.functions.invoke("deductRawInventoryOnBatchComplete", {
    stage_id: stage.id,
    ingredients: [{ bucket_id: form.protein_bucket_id, bucket_name: form.protein_bucket_name || "Protein", actual_lbs: lbs }],
  });
  const short = Number(res?.data?.total_shortfall) || 0;
  if (short > 0.01) {
    return `Not enough protein inventory — short by ${short} lbs. Nothing was deducted. Add stock or pick another bucket, then retry.`;
  }
  const rawLots = res?.data?.consumed_lots || [];
  updates.consumed_lots = [...consumed, ...tagConsumedLots(rawLots, "protein", { output_lot_number: updates.output_lot_number })];
  updates.input_lot_number = rawLots.map(l => l.lot_number).filter(Boolean).join(", ");
  await base44.entities.ProductionStage.update(stage.id, { consumed_lots: updates.consumed_lots });
  return null;
}

// Fryer Rack: takes the assigned spice mix out of stock and ties its lots to the same
// lot as the product. Returns { error } or { update } (fields to save on the stage).
export async function deductFryerSpice({ stage, form, lot }) {
  const live = await base44.entities.ProductionStage.get(stage.id);
  const consumed = [...(live?.consumed_lots || [])];
  // Never take it twice if completion is retried.
  if (consumed.some(l => l.material_type === "spice")) return { update: {} };
  const lots = form.spice_mix?.lots || [];
  if (!lots.length) return { error: "Assign the spice mix for this card before completing." };

  const res = await base44.functions.invoke("deductSpiceMixOnComplete", { stage_id: stage.id, lots });
  const short = Number(res?.data?.total_shortfall) || 0;
  if (short > 0.01) {
    return { error: `Not enough spice mix — short by ${short} lbs. Nothing was deducted. Add spice stock and retry.` };
  }
  const spiceLots = res?.data?.consumed_lots || [];
  const update = {
    consumed_lots: [...consumed, ...tagConsumedLots(spiceLots, "spice", { output_lot_number: lot })],
    spice_mix_id: form.spice_mix_id || "",
    spice_mix_name: form.spice_mix_name || "",
    spice_mix_qty_lbs: lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0),
    spice_mix_lot_number: spiceLots.map(l => l.lot_number).filter(Boolean).join(", "),
  };
  await base44.entities.ProductionStage.update(stage.id, update);
  return { update };
}

// Each completed flatten batch opens its own card on the next step (Fryer Rack).
export async function releaseFlattenBatch({ stage, updates }) {
  const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
  const flow = order?.flow_id ? await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]) : null;
  const next = flow?.steps?.find(s => s.step_number === stage.step_number + 1);
  if (!next) return;
  const existing = await base44.entities.ProductionStage.filter({
    order_id: stage.order_id, capability_key: next.capability_key, batch_tag: stage.batch_tag,
  });
  if (existing.length) return;
  await base44.entities.ProductionStage.create({
    order_id: stage.order_id,
    order_number: stage.order_number,
    product_name: stage.product_name,
    step_number: next.step_number,
    capability_id: next.capability_id,
    capability_key: next.capability_key,
    capability_name: next.capability_name,
    work_profile_id: next.work_profile_id || "",
    work_profile_name: next.work_profile_name || "",
    status: "available",
    input_qty_lbs: updates.output_qty_lbs,
    input_lot_number: updates.output_lot_number,
    batch_tag: stage.batch_tag,
    sub_batches: [],
  });
}