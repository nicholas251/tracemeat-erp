import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ChevronRight, ChevronLeft, Play, Package, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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
        lot_number: "",
        actual_lbs: parseFloat((ing.quantity_lbs * ratio).toFixed(2)),
        confirmed: false,
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
      // Try to find product from production order
      const orders = await base44.entities.ProductionOrder.filter({ id: stage.order_id });
      const order = orders[0];
      if (!order?.product_id) return null;
      const products = await base44.entities.Product.filter({ id: order.product_id });
      return products[0] || null;
    },
    enabled: open && !!stage,
  });

  // Build batches once product is loaded
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
    const allIngs = resolvedBatches.flatMap(b => b.ingredients);
    const outputLbs = resolvedBatches.reduce((sum, b) => sum + b.batchLbs, 0);

    // Save blend log in sub_batches
    const subBatches = resolvedBatches.map((b) => ({
      sub_batch_id: `blend-${b.batchNumber}`,
      label: `Blend Batch #${b.batchNumber}`,
      qty_lbs: b.batchLbs,
      ingredients: b.ingredients.map(ing => ({
        bucket_name: ing.bucket_name,
        lot_number: ing.lot_number,
        actual_lbs: ing.actual_lbs,
      })),
      status: "completed",
    }));

    await base44.entities.ProductionStage.update(stage.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      output_qty_lbs: outputLbs,
      sub_batches: subBatches,
    });

    // Unlock next stage
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
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{ing.bucket_name}</span>
                      {ing.confirmed
                        ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                        : <Badge variant="outline" className="text-xs">Pending</Badge>
                      }
                    </div>
                    <p className="text-xs text-muted-foreground">Required: <span className="font-semibold text-foreground">{ing.required_lbs} lbs</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Lot Code</Label>
                        <Input
                          value={ing.lot_number}
                          disabled={ing.confirmed}
                          onChange={e => updateIngredient(step - 1, ingIdx, "lot_number", e.target.value)}
                          placeholder="e.g. LOT-2024-001"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Actual Qty (lbs) <span className="text-muted-foreground font-normal">max {ing.required_lbs}</span></Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={ing.actual_lbs}
                          disabled={ing.confirmed}
                          onChange={e => updateIngredient(step - 1, ingIdx, "actual_lbs", Number(e.target.value))}
                          className={`h-8 text-sm ${ing.actual_lbs > ing.required_lbs ? "border-destructive text-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {ing.actual_lbs > ing.required_lbs && (
                          <p className="text-xs text-destructive">Exceeds max of {ing.required_lbs} lbs</p>
                        )}
                      </div>
                    </div>
                    {!ing.confirmed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs gap-1 mt-1"
                        disabled={!ing.lot_number || !ing.actual_lbs || ing.actual_lbs > ing.required_lbs}
                        onClick={() => confirmIngredient(step - 1, ingIdx)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                      </Button>
                    )}
                    {ing.actual_lbs > 0 && ing.actual_lbs < ing.required_lbs && !ing.confirmed && (
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-600">Reason for short quantity</Label>
                        <Textarea
                          value={ing.notes || ""}
                          onChange={e => updateIngredient(step - 1, ingIdx, "notes", e.target.value)}
                          placeholder="e.g. scale variance, partial lot used..."
                          className="h-16 text-xs"
                        />
                      </div>
                    )}
                    {!ing.lot_number && !ing.confirmed && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Lot code required
                      </p>
                    )}
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
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <span>{ing.bucket_name}</span>
                      <div className="text-right">
                        <span className="font-medium">{ing.actual_lbs} lbs</span>
                        <span className="text-muted-foreground text-xs ml-2">{ing.lot_number}</span>
                      </div>
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