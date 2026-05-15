import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ChevronRight, ChevronLeft, Play, Package } from "lucide-react";
import IngredientLotPicker from "./IngredientLotPicker";

function buildBatches(stage, product) {
  const totalLbs = stage.input_qty_lbs || 0;
  const batchSize = product?.blend_batch_lbs || totalLbs;
  const ingredients = product?.blend_ingredients || [];
  const count = batchSize > 0 ? Math.ceil(totalLbs / batchSize) : 1;

  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1;
    const batchLbs = isLast ? totalLbs - batchSize * i : batchSize;
    const ratio = batchSize > 0 ? batchLbs / batchSize : 1;
    return {
      batchNumber: i + 1,
      batchLbs,
      ingredients: ingredients.map(ing => ({
        bucket_id: ing.bucket_id,
        bucket_name: ing.bucket_name,
        required_lbs: parseFloat((ing.quantity_lbs * ratio).toFixed(2)),
        lot_allocations: null, // will be populated by IngredientLotPicker from FIFO
        confirmed: false,
        notes: "",
      })),
    };
  });
}

// Step 0: Overview — Step N+1: each batch — Final: complete
export default function BlendingWizard({ stage, open, onClose, onCompleted }) {
  const [step, setStep] = useState(0); // 0=intro, 1..N=batches, N+1=done
  const [batches, setBatches] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: product } = useQuery({
    queryKey: ["product", stage?.product_id || stage?.order_id],
    queryFn: async () => {
      const orders = await base44.entities.ProductionOrder.filter({ id: stage.order_id });
      const order = orders[0];
      if (!order?.product_id) return null;
      const products = await base44.entities.Product.filter({ id: order.product_id });
      return products[0] || null;
    },
    enabled: open && !!stage,
  });

  const resolvedBatches = batches || (product ? buildBatches(stage, product) : null);

  const totalBatches = resolvedBatches?.length || 0;
  const isBatchStep = step >= 1 && step <= totalBatches;
  const currentBatch = isBatchStep ? resolvedBatches[step - 1] : null;
  const isFinalStep = step === totalBatches + 1;

  const updateIngredient = (batchIdx, ingIdx, field, value) => {
    const updated = resolvedBatches.map((b, bi) => {
      if (bi !== batchIdx) return b;
      return {
        ...b,
        ingredients: b.ingredients.map((ing, ii) =>
          ii !== ingIdx ? ing : { ...ing, [field]: value }
        ),
      };
    });
    setBatches(updated);
  };

  const confirmIngredient = (batchIdx, ingIdx) => {
    updateIngredient(batchIdx, ingIdx, "confirmed", true);
  };

  const allConfirmedInBatch = (batch) =>
    batch.ingredients.every(ing => ing.confirmed);

  const handleStart = async () => {
    setSaving(true);
    await base44.entities.ProductionStage.update(stage.id, {
      status: "in_progress",
      started_at: new Date().toISOString(),
    });
    setSaving(false);
    setStep(1);
  };

  const handleComplete = async () => {
    setSaving(true);
    const outputLbs = resolvedBatches.reduce((sum, b) => sum + b.batchLbs, 0);

    const subBatches = resolvedBatches.map((b) => ({
      sub_batch_id: `blend-${b.batchNumber}`,
      label: `Blend Batch #${b.batchNumber}`,
      qty_lbs: b.batchLbs,
      ingredients: b.ingredients.map(ing => ({
        bucket_name: ing.bucket_name,
        lot_allocations: ing.lot_allocations,
        // keep backward compat: flatten to single lot if only one
        lot_number: ing.lot_allocations?.length === 1 ? ing.lot_allocations[0].lot_number : (ing.lot_allocations?.map(a => a.lot_number).join(", ") || ""),
        actual_lbs: ing.lot_allocations?.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0) || 0,
      })),
      status: "completed",
    }));

    await base44.entities.ProductionStage.update(stage.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      output_qty_lbs: outputLbs,
      sub_batches: subBatches,
    });

    const allStages = await base44.entities.ProductionStage.filter({ order_id: stage.order_id });
    const nextStage = allStages.find(s => s.step_number === stage.step_number + 1);
    if (nextStage?.status === "locked") {
      await base44.entities.ProductionStage.update(nextStage.id, {
        status: "available",
        input_qty_lbs: outputLbs,
      });
    }
    if (!nextStage) {
      await base44.entities.ProductionOrder.update(stage.order_id, { status: "completed" });
    } else {
      await base44.entities.ProductionOrder.update(stage.order_id, { status: "in_progress" });
    }

    setSaving(false);
    onCompleted();
  };

  const progressPct = totalBatches > 0 ? Math.round(((step - 1) / totalBatches) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-chart-1" />
            Blending — {stage?.product_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Order #{stage?.order_number} · {stage?.input_qty_lbs} lbs total</p>
        </DialogHeader>

        {/* ── INTRO STEP ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-chart-1/10 border border-chart-1/20 p-4 space-y-2">
              <p className="font-semibold text-chart-1">Ready to start blending</p>
              <p className="text-sm text-muted-foreground">
                {resolvedBatches
                  ? `This order requires ${resolvedBatches.length} blend batch${resolvedBatches.length > 1 ? "es" : ""} of ${product?.blend_batch_lbs || stage?.input_qty_lbs} lbs each.`
                  : "Loading batch plan..."}
              </p>
              {resolvedBatches && (
                <div className="space-y-1 pt-1">
                  {resolvedBatches.map(b => (
                    <div key={b.batchNumber} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-chart-1/20 text-chart-1 text-xs flex items-center justify-center font-bold">{b.batchNumber}</span>
                      <span>{b.batchLbs} lbs</span>
                      <span className="text-muted-foreground">· {b.ingredients.length} ingredient{b.ingredients.length !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button className="w-full gap-2" onClick={handleStart} disabled={saving || !resolvedBatches}>
              <Play className="w-4 h-4" /> Start Blending
            </Button>
          </div>
        )}

        {/* ── BATCH STEPS ── */}
        {isBatchStep && currentBatch && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Batch {currentBatch.batchNumber} of {totalBatches}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-chart-1 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 border p-3">
              <p className="font-semibold">Blend Batch #{currentBatch.batchNumber}</p>
              <p className="text-sm text-muted-foreground">{currentBatch.batchLbs} lbs</p>
            </div>

            <p className="text-sm font-medium">Confirm each ingredient:</p>

            <div className="space-y-3">
              {currentBatch.ingredients.map((ing, ingIdx) => (
                <Card key={ingIdx} className={`border ${ing.confirmed ? "border-chart-2/40 bg-chart-2/5" : "border-border"}`}>
                  <CardContent className="p-3">
                    <IngredientLotPicker
                      ing={ing}
                      disabled={ing.confirmed}
                      onChange={(field, value) => updateIngredient(step - 1, ingIdx, field, value)}
                      onConfirm={() => confirmIngredient(step - 1, ingIdx)}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="gap-1" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                className="flex-1 gap-1"
                disabled={!allConfirmedInBatch(currentBatch)}
                onClick={() => setStep(s => s + 1)}
              >
                {step < totalBatches ? "Next Batch" : "Review & Complete"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── FINAL SUMMARY ── */}
        {isFinalStep && resolvedBatches && (
          <div className="space-y-4">
            <div className="rounded-lg bg-chart-2/10 border border-chart-2/20 p-4">
              <p className="font-semibold text-chart-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> All batches confirmed
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Total output: {resolvedBatches.reduce((s, b) => s + b.batchLbs, 0)} lbs across {resolvedBatches.length} batch{resolvedBatches.length > 1 ? "es" : ""}
              </p>
            </div>

            {resolvedBatches.map(b => (
              <div key={b.batchNumber} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Batch #{b.batchNumber} — {b.batchLbs} lbs</p>
                <div className="rounded border divide-y text-sm">
                  {b.ingredients.map((ing, i) => (
                    <div key={i} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{ing.bucket_name}</span>
                        <span className="text-muted-foreground text-xs">
                          {ing.lot_allocations?.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0).toFixed(2)} lbs
                        </span>
                      </div>
                      {ing.lot_allocations?.map((a, ai) => (
                        <div key={ai} className="flex justify-between text-xs text-muted-foreground mt-0.5 pl-2">
                          <span className="font-mono">{a.lot_number}</span>
                          <span>{a.actual_lbs} lbs</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="gap-1" onClick={() => setStep(totalBatches)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                className="flex-1 gap-1 bg-chart-2 hover:bg-chart-2/90"
                onClick={handleComplete}
                disabled={saving}
              >
                <CheckCircle2 className="w-4 h-4" /> Complete Blending
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}