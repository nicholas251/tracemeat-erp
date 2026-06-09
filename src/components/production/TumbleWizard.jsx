import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Layers, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import TumbleBatchCard from "./TumbleBatchCard";

/**
 * TumbleWizard — clean, self-contained tumbling flow.
 *
 * Reads the incoming protein weight (stage.input_qty_lbs) and the product's
 * CHOPPING config (blend_batch_lbs = batch size, chop_spice_qty_lbs = spice per
 * batch, chop_spice_mix_id = which mix) to split the incoming weight into
 * standalone batches. Each batch is its own card where the operator picks
 * protein lots (FIFO) + spice, then releases it. Releasing a batch:
 *   1. deducts that batch's protein from raw inventory,
 *   2. deducts that batch's spice mix,
 *   3. creates a racking card carrying (protein + spice) lbs.
 *
 * When every batch is released, the tumble stage is marked completed.
 */
export default function TumbleWizard({ stage, open, onClose, onCompleted }) {
  const queryClient = useQueryClient();
  const [releasedBatches, setReleasedBatches] = useState({}); // { [batch_number]: { proteinLots, spiceLots, bucketName } }
  const [releasingBatch, setReleasingBatch] = useState(null);
  const [error, setError] = useState("");

  // Racking cards already created by THIS tumble stage. Used to detect batches
  // that were released in a prior session so we never double-deduct/double-create
  // when the operator closes ("resume later") and reopens the wizard.
  const { data: existingRackingCards = [] } = useQuery({
    queryKey: ["tumbleRackingCards", stage?.id],
    queryFn: () => base44.entities.ProductionStage.filter({ order_id: stage.order_id }),
    enabled: open && !!stage,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const { data: product } = useQuery({
    queryKey: ["tumbleProduct", stage?.order_id],
    queryFn: async () => {
      const order = (await base44.entities.ProductionOrder.filter({ id: stage.order_id }))[0];
      if (!order?.product_id) return null;
      return (await base44.entities.Product.filter({ id: order.product_id }))[0] || null;
    },
    enabled: open && !!stage,
  });

  const { data: flow } = useQuery({
    queryKey: ["tumbleFlow", stage?.order_id],
    queryFn: async () => {
      const order = (await base44.entities.ProductionOrder.filter({ id: stage.order_id }))[0];
      if (!order?.flow_id) return null;
      return (await base44.entities.ProductFlow.filter({ id: order.flow_id }))[0] || null;
    },
    enabled: open && !!stage,
  });

  const totalLbs = stage?.input_qty_lbs || 0;
  const batchSize = Number(product?.tumble_batch_lbs) || Number(product?.blend_batch_lbs) || 0;
  const spicePerBatch = Number(product?.chop_spice_qty_lbs) || 0;
  const spicePct = batchSize > 0 ? spicePerBatch / batchSize : 0;
  // Protein bucket is optional. Tumble-entry flows receive raw protein directly
  // (already deducted at receiving), so there may be no blend bucket to deduct.
  const proteinBucket = product?.blend_ingredients?.[0] || null;

  // Split incoming weight into chopping-sized batches.
  const batches = useMemo(() => {
    if (!batchSize || batchSize <= 0 || !totalLbs) return [];
    const count = Math.ceil(totalLbs / batchSize);
    const rows = [];
    let remaining = totalLbs;
    for (let i = 0; i < count; i++) {
      const proteinLbs = parseFloat(Math.min(batchSize, remaining).toFixed(2));
      const spiceLbs = parseFloat((proteinLbs * spicePct).toFixed(2));
      rows.push({
        batch_number: i + 1,
        protein_lbs: proteinLbs,
        spice_lbs: spiceLbs,
        total_lbs: parseFloat((proteinLbs + spiceLbs).toFixed(2)),
      });
      remaining -= proteinLbs;
    }
    return rows;
  }, [totalLbs, batchSize, spicePct]);

  // Seed already-released batches from racking cards created in a prior session.
  // Each release creates a racking ProductionStage with input_lot_number
  // "TUMBLE-<date>-B<batch_number>". Detect those so re-opening the wizard shows
  // them as released and the operator can't release them again (double-deduct).
  useEffect(() => {
    if (!open || existingRackingCards.length === 0) return;
    const seeded = {};
    for (const card of existingRackingCards) {
      const m = (card.input_lot_number || "").match(/^TUMBLE-\d+-B(\d+)$/);
      if (m) {
        const batchNum = parseInt(m[1], 10);
        if (!seeded[batchNum]) {
          seeded[batchNum] = { bucketName: "Protein", proteinLots: [], spiceLots: [], restored: true };
        }
      }
    }
    if (Object.keys(seeded).length > 0) {
      setReleasedBatches((prev) => ({ ...seeded, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingRackingCards, open]);

  const allReleased = batches.length > 0 && batches.every((b) => releasedBatches[b.batch_number]);

  const rackingStep = useMemo(() => {
    if (!flow?.steps) return null;
    const sorted = [...flow.steps].sort((a, b) => a.step_number - b.step_number);
    return sorted.find((s) => s.step_number > stage.step_number) || null;
  }, [flow, stage]);

  const [finalizing, setFinalizing] = useState(false);

  // Mark the tumble stage completed (shared by the last-batch release path and the
  // manual "Complete Tumble Stage" recovery button). Guarded so it can only run once.
  const finalizeStage = async () => {
    if (finalizing) return;
    setFinalizing(true);
    await base44.entities.ProductionStage.update(stage.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      output_qty_lbs: parseFloat(batches.reduce((s, b) => s + b.total_lbs, 0).toFixed(2)),
    });
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    onCompleted?.();
    onClose();
  };

  // Release a single batch: deduct protein + spice, create a racking card.
  const handleReleaseBatch = async (batch, { proteinBucket: chosenBucket, proteinLots, spiceLots }) => {
    setError("");
    setReleasingBatch(batch.batch_number);
    try {
      // 0. A racking step is REQUIRED — without it the deducted weight would have
      //    nowhere to go and would silently vanish. Abort before any deduction.
      if (!rackingStep) {
        throw new Error("No racking step found after tumbling in this product's flow — add one in the Flow Builder before releasing.");
      }
      // 1. Deduct protein for THIS batch from the selected bucket.
      //    A bucket is REQUIRED — without it we cannot deduct inventory.
      if (!chosenBucket?.bucket_id) {
        throw new Error("Pick a protein bucket for this batch before releasing — inventory can't be deducted without one.");
      }
      // 1. Deduct spice mix FIRST. Spice is the smaller, more commonly-short
      //    deduction — validating it before committing protein means a spice
      //    shortfall never strands an already-deducted protein batch (which would
      //    double-deduct protein on retry).
      if (spiceLots.length) {
        const spiceRes = await base44.functions.invoke("deductSpiceMixOnComplete", {
          stage_id: stage.id,
          lots: spiceLots,
        });
        const spiceShort = Number(spiceRes?.data?.total_shortfall) || 0;
        if (spiceShort > 0.01) {
          throw new Error(
            `Spice mix was ${spiceShort} lbs short — nothing was racked. Add spice mix or adjust lots, then retry.`
          );
        }
      }

      // 2. Deduct protein for THIS batch from the selected bucket. Committed last
      //    so it only runs once spice is confirmed available.
      const proteinRes = await base44.functions.invoke("deductRawInventoryOnBatchComplete", {
        stage_id: stage.id,
        ingredients: [{
          bucket_id: chosenBucket.bucket_id,
          bucket_name: chosenBucket.bucket_name || "Protein",
          actual_lbs: batch.protein_lbs,
          lot_allocations: proteinLots.length ? proteinLots : null,
        }],
      });
      const proteinShort = Number(proteinRes?.data?.total_shortfall) || 0;
      if (proteinShort > 0.01) {
        throw new Error(
          `Protein inventory was ${proteinShort} lbs short — nothing was racked. Add inventory or adjust lots, then retry.`
        );
      }

      // 3. Create a racking card carrying this batch's weight.
      const lot = `TUMBLE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-B${batch.batch_number}`;
      await base44.entities.ProductionStage.create({
        order_id: stage.order_id,
        order_number: stage.order_number,
        product_name: stage.product_name,
        step_number: rackingStep.step_number,
        capability_id: rackingStep.capability_id,
        capability_key: rackingStep.capability_key,
        capability_name: rackingStep.capability_name,
        work_profile_id: rackingStep.work_profile_id || "",
        work_profile_name: rackingStep.work_profile_name || "",
        status: "available",
        input_qty_lbs: batch.total_lbs,
        input_lot_number: lot,
      });

      const nextReleased = {
        ...releasedBatches,
        [batch.batch_number]: {
          bucketName: chosenBucket?.bucket_name || "Protein",
          proteinLots,
          spiceLots,
        },
      };
      setReleasedBatches(nextReleased);

      // If that was the last batch, complete the tumble stage.
      if (batches.every((b) => nextReleased[b.batch_number])) {
        await finalizeStage();
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["allStages"] });
      queryClient.invalidateQueries({ queryKey: ["rawInventory"] });
      queryClient.invalidateQueries({ queryKey: ["spiceMixesActive"] });
      queryClient.invalidateQueries({ queryKey: ["proteinBuckets"] });
    } catch (err) {
      console.error("Batch release failed:", err);
      setError(err?.message || "Could not release this batch.");
    } finally {
      setReleasingBatch(null);
    }
  };

  const releasedCount = batches.filter((b) => releasedBatches[b.batch_number]).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-card shrink-0">
          <div className="w-10 h-10 rounded-xl bg-chart-1/15 flex items-center justify-center shrink-0">
            <Thermometer className="w-5 h-5 text-chart-1" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold leading-tight">
              Tumbling — {stage?.product_name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order <span className="font-semibold text-foreground">#{stage?.order_number}</span>
              &nbsp;·&nbsp;<span className="font-semibold text-foreground">{totalLbs} lbs</span> in
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!batchSize ? (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No chopping batch size set on this product — set "Total Batch Size" under the Chopping tab.
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-chart-1 shrink-0" />
                  <span className="font-semibold text-sm">Tumble Batches</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {releasedCount} / {batches.length} released
                  </Badge>
                </div>
                <div className="rounded-lg bg-background border px-3 py-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Batch size</span>
                    <span className="font-semibold">{batchSize} lbs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spice per batch</span>
                    <span className="font-semibold">{spicePerBatch} lbs ({(spicePct * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protein bucket</span>
                    <span className="font-semibold">{proteinBucket?.bucket_name || "Raw protein (from receiving)"}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Batch cards */}
              {batches.map((b) => (
                <TumbleBatchCard
                  key={b.batch_number}
                  batch={b}
                  proteinBucket={proteinBucket}
                  spiceMixId={product?.chop_spice_mix_id}
                  released={!!releasedBatches[b.batch_number]}
                  releaseDetails={releasedBatches[b.batch_number] || null}
                  releasing={releasingBatch === b.batch_number}
                  onRelease={(payload) => handleReleaseBatch(b, payload)}
                />
              ))}

              {allReleased && (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-chart-2 py-2">
                  <CheckCircle2 className="w-5 h-5" /> All batches released
                </div>
              )}

              {/* If every batch is released but the stage was never finalized
                  (e.g. closed/crashed before completion), allow finalizing now. */}
              {allReleased && stage?.status !== "completed" && (
                <Button className="w-full h-11 bg-chart-2 hover:bg-chart-2/90" onClick={finalizeStage}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Complete Tumble Stage
                </Button>
              )}

              <Button variant="outline" className="w-full h-11" onClick={onClose}>
                {allReleased ? "Done" : "Close (resume later)"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}