import { base44 } from "@/api/base44Client";

/**
 * Routes a completed racking stage into per-cook-batch cooking stages.
 * Each cook batch becomes its own cooking stage carrying its rack count and lot.
 * Returns true if it handled routing (caller should skip generic next-stage unlock).
 */
export async function routeRackingToCooking({ stage, cookPlan, nextStage }) {
  if (!cookPlan?.cookBatches?.length) return false;

  const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
  const flow = order?.flow_id
    ? await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0])
    : null;
  const cookFlowStep = flow?.steps?.find(s => s.capability_key === "cooking");

  // Record cook batches as sub-batches on the racking stage for traceability
  const rackedSubBatches = cookPlan.cookBatches.map((batch, i) => ({
    sub_batch_id: `racked-batch-${i + 1}-${Date.now()}`,
    label: `Cook Batch ${batch.lotNumber}`,
    qty_lbs: parseFloat((batch.lbs || 0).toFixed(2)),
    lot_number: batch.lotNumber,
    racks: batch.racks,
    status: "completed",
  }));
  await base44.entities.ProductionStage.update(stage.id, { sub_batches: rackedSubBatches });

  if (!cookFlowStep) return true;

  // Remove the single placeholder cooking stage created at order setup (if still unused)
  if (nextStage && nextStage.capability_key === "cooking" && nextStage.status === "locked") {
    await base44.entities.ProductionStage.delete(nextStage.id);
  }

  for (const batch of cookPlan.cookBatches) {
    const existing = await base44.entities.ProductionStage.filter({
      order_id: stage.order_id,
      capability_key: "cooking",
      cook_batch_lot: batch.lotNumber,
    });
    if (existing.length === 0) {
      await base44.entities.ProductionStage.create({
        order_id: stage.order_id,
        order_number: stage.order_number,
        product_name: stage.product_name,
        step_number: cookFlowStep.step_number,
        capability_id: cookFlowStep.capability_id,
        capability_key: cookFlowStep.capability_key,
        capability_name: cookFlowStep.capability_name,
        work_profile_id: cookFlowStep.work_profile_id || "",
        work_profile_name: cookFlowStep.work_profile_name || "",
        status: "available",
        input_qty_lbs: parseFloat((batch.lbs || 0).toFixed(2)),
        input_lot_number: batch.lotNumber,
        cook_batch_lot: batch.lotNumber,
        racks_count: batch.racks,
      });
    }
  }
  return true;
}