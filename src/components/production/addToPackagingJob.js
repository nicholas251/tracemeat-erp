import { base44 } from "@/api/base44Client";

const r2 = (n) => parseFloat((Number(n) || 0).toFixed(2));
const uniqJoin = (vals) => [...new Set(vals.filter(Boolean))].join(", ");

// Routes a completed cooling batch into the order's single open packing job ("production
// job bucket"). Every cooling batch of an order accumulates into ONE packaging stage, each
// kept as a sub-batch with its own lot + lbs, so packing completes the whole order into
// cases and finished goods trace back to every cooling batch they actually came from.
export async function addCoolingBatchToPackagingJob({ stage, packFlowStep, cooledQty, cooledLot, cookBatchLot, expiryDate }) {
  const packStages = await base44.entities.ProductionStage.filter({
    order_id: stage.order_id,
    capability_key: "packaging",
  });
  // Dedup: this cooling batch is already in a packing job.
  const already = packStages.some(s =>
    s.source_chilling_stage_id === stage.id || (s.sub_batches || []).some(sb => sb.sub_batch_id === stage.id)
  );
  if (already) return;

  const entry = {
    sub_batch_id: stage.id,
    label: `Cooling batch ${cookBatchLot || cooledLot}`,
    lot_number: cooledLot,
    qty_lbs: r2(cooledQty),
    status: "active",
  };

  // Open job = not yet started, holding real product (skips the empty placeholder stub).
  const job = packStages.find(s => s.status === "available" && (s.input_qty_lbs || 0) > 0);

  if (job) {
    const existing = (job.sub_batches || []).length
      ? job.sub_batches
      : [{
          sub_batch_id: job.source_chilling_stage_id || job.id,
          label: `Cooling batch ${job.cook_batch_lot || job.input_lot_number || ""}`,
          lot_number: job.input_lot_number || "",
          qty_lbs: r2(job.input_qty_lbs),
          status: "active",
        }];
    const subs = [...existing, entry];
    const expiries = [job.expiry_date, expiryDate].filter(Boolean).sort();
    await base44.entities.ProductionStage.update(job.id, {
      sub_batches: subs,
      input_qty_lbs: r2(subs.reduce((s, b) => s + (b.qty_lbs || 0), 0)),
      input_lot_number: uniqJoin(subs.map(b => b.lot_number)),
      // Earliest expiry wins — the packed cases can't outlive the oldest batch in them.
      expiry_date: expiries[0] || undefined,
    });
    return;
  }

  await base44.entities.ProductionStage.create({
    order_id: stage.order_id,
    order_number: stage.order_number,
    product_name: stage.product_name,
    step_number: packFlowStep.step_number,
    capability_id: packFlowStep.capability_id,
    capability_key: packFlowStep.capability_key,
    capability_name: packFlowStep.capability_name,
    work_profile_id: packFlowStep.work_profile_id || "",
    work_profile_name: packFlowStep.work_profile_name || "",
    status: "available",
    input_qty_lbs: r2(cooledQty),
    input_lot_number: cooledLot,
    cook_batch_lot: cookBatchLot,
    source_chilling_stage_id: stage.id,
    sub_batches: [entry],
    ...(expiryDate ? { expiry_date: expiryDate } : {}),
  });
}