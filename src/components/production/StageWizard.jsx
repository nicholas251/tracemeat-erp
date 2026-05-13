import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Play,
  Package, Thermometer, Clock, Layers, Scale, AlertCircle, FlaskConical
} from "lucide-react";
import LinkingCookBatchBuilder from "./LinkingCookBatchBuilder";

// ─── Stage icon map ───────────────────────────────────────────────────────────
const STAGE_ICONS = {
  blending: Package,
  chopping: FlaskConical,
  linking: Layers,
  cooking: Thermometer,
  chilling: Thermometer,
  packaging: Package,
};

// ─── Build ingredient batches (blending) with multiple batches ────────────────
function buildIngredientBatchesMultiple(stage, product, capKey, numBatches) {
  if (capKey !== "blending") return [];

  const totalLbs = stage.input_qty_lbs || 0;
  const batchSize = product?.blend_batch_lbs || 240;
  const ingredients = product?.blend_ingredients || [];
  const recipeTotalLbs = ingredients.reduce((s, i) => s + (i.quantity_lbs || 0), 0);

  return Array.from({ length: numBatches }, (_, i) => {
    const isLast = i === numBatches - 1;
    const batchLbs = isLast ? totalLbs - (batchSize * i) : batchSize;
    const ratio = recipeTotalLbs > 0 ? batchLbs / recipeTotalLbs : 1;

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

// ─── Build measurement steps for cooking / chilling / linking / packaging ────
function buildMeasurementSteps(stage, product, capKey, spiceMixes, casingBuckets = []) {
  const steps = [];

  if (capKey === "chopping") {
    steps.push({
      id: "bowl_prep",
      label: "Bowl Preparation",
      fields: [
        { key: "input_lot_confirmed", label: `Confirm blend lot ${stage?.input_lot_number || "N/A"} added to bowl?`, type: "boolean" },
        { key: "spice_mix_id", label: "Spice Mix", type: "spice_select", options: spiceMixes },
        { key: "spice_mix_qty_lbs", label: "Spice Mix Amount (lbs)", type: "number" },
        { key: "water_amount_lbs", label: "Water Amount Added (lbs)", type: "number" },
        { key: "cure_amount_lbs", label: "Cure Added (lbs)", type: "number" },
      ],
    });
  }

  if (capKey === "linking") {
    steps.push({
      id: "linking",
      label: "Linking",
      fields: [
        { key: "casing_bucket_id", label: "Casings Used", type: "casing_select", options: casingBuckets },
        { key: "casing_qty_lbs", label: "Casing Qty Used (lbs)", type: "number" },
        { key: "output_qty_lbs", label: "Output Qty (lbs)", type: "number" },
        { key: "notes", label: "Notes / Observations", type: "textarea" },
      ],
    });
    // Cook batch assembly is handled via the separate cook_batch state, not a field step
  }

  if (capKey === "cooking") {
    steps.push({
      id: "cook",
      label: "Cook Parameters",
      fields: [
        { key: "temperature_c", label: "Internal Temp (°C)", type: "number" },
        { key: "duration_minutes", label: "Cook Time (minutes)", type: "number" },
        { key: "racks_count", label: "Rack Count", type: "number" },
      ],
    });
  }

  if (capKey === "chilling") {
    steps.push({
      id: "chill",
      label: "Chill Check",
      fields: [
        { key: "temperature_c", label: "Exit Temp (°C)", type: "number" },
        { key: "duration_minutes", label: "Chill Duration (minutes)", type: "number" },
        { key: "output_qty_lbs", label: "Output Qty (lbs)", type: "number" },
      ],
    });
  }

  if (capKey === "packaging") {
    steps.push({
      id: "packaging",
      label: "Packaging",
      fields: [
        { key: "output_qty_lbs", label: "Total Output Weight (lbs)", type: "number" },
        { key: "packages_produced", label: "Packages Produced", type: "number" },
        { key: "packaging_weight_lbs", label: "Avg Package Weight (lbs)", type: "number" },
        { key: "lot_number", label: "Finished Goods Lot #", type: "text" },
      ],
    });
  }

  // Quality + notes always last
  steps.push({
    id: "quality",
    label: "Quality & Notes",
    fields: [
      { key: "quality_check_passed", label: "Quality Check Passed", type: "boolean" },
      { key: "notes", label: "Notes / Observations", type: "textarea" },
    ],
  });

  return steps;
}

// ─── Main wizard ─────────────────────────────────────────────────────────────
export default function StageWizard({ stage, open, onClose, onCompleted, startBatchNumber = null }) {
  const [step, setStep] = useState(0);
  const [batches, setBatches] = useState(null);
  const [form, setForm] = useState({});
  const [cookBatch, setCookBatch] = useState(null); // for linking stage
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const capKey = stage?.capability_key;
  const usesIngredientBatches = capKey === "blending";

  const { data: product } = useQuery({
    queryKey: ["wizardProduct", stage?.order_id],
    queryFn: async () => {
      const orders = await base44.entities.ProductionOrder.filter({ id: stage.order_id });
      const order = orders[0];
      if (!order?.product_id) return null;
      const products = await base44.entities.Product.filter({ id: order.product_id });
      return products[0] || null;
    },
    enabled: open && !!stage,
  });

  const { data: spiceMixes = [] } = useQuery({
    queryKey: ["spiceMixes"],
    queryFn: () => base44.entities.SpiceMix.filter({ status: "active" }),
    enabled: open && capKey === "chopping",
  });

  const { data: casingBuckets = [] } = useQuery({
    queryKey: ["casingBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "spice" }),
    enabled: open && capKey === "linking",
  });

  // For ingredient-batch stages (blending)
  // Calculate total batches from total raw input / blend batch size
  const calcTotalBatches = () => {
    if (!usesIngredientBatches || !product || !stage) return 1;
    const totalLbs = stage.input_qty_lbs || 0;
    const batchSize = product.blend_batch_lbs || 240;
    return Math.ceil(totalLbs / batchSize);
  };
  const totalBatches = usesIngredientBatches ? calcTotalBatches() : 0;
  
  const resolvedBatches = usesIngredientBatches
    ? (batches || (product !== undefined ? buildIngredientBatchesMultiple(stage, product, capKey, totalBatches) : null))
    : null;

  // For measurement stages
  const measureSteps = !usesIngredientBatches
    ? buildMeasurementSteps(stage, product, capKey, spiceMixes, casingBuckets)
    : [];

  // ── Navigation boundaries ──
  const totalMeasureSteps = measureSteps.length;
  // step 0 = intro
  // step 1..totalBatches = batch confirmations (blending)
  // step 1..totalMeasureSteps = measurement steps (others)
  // last step = review/complete
  const lastStep = usesIngredientBatches ? totalBatches + 1 : totalMeasureSteps + 1;
  const isBatchStep = usesIngredientBatches && step >= 1 && step <= totalBatches;
  const isMeasureStep = !usesIngredientBatches && step >= 1 && step <= totalMeasureSteps;
  const isFinalStep = step === lastStep;
  const currentBatch = isBatchStep ? (resolvedBatches?.[step - 1] || null) : null;
  const currentMeasureStep = isMeasureStep ? measureSteps[step - 1] : null;

  // ── Ingredient batch helpers ──
  const updateIngredient = (batchIdx, ingIdx, field, value) => {
    const updated = resolvedBatches.map((b, bi) =>
      bi !== batchIdx ? b : {
        ...b,
        ingredients: b.ingredients.map((ing, ii) =>
          ii !== ingIdx ? ing : { ...ing, [field]: value }
        ),
      }
    );
    setBatches(updated);
  };

  const confirmIngredient = (batchIdx, ingIdx) =>
    updateIngredient(batchIdx, ingIdx, "confirmed", true);

  const allConfirmedInBatch = (batch) =>
    batch.ingredients.length === 0 || batch.ingredients.every(ing => ing.confirmed);

  // ── Start ──
  const handleStart = async () => {
    if (stage.status !== "in_progress") {
      setSaving(true);
      await base44.entities.ProductionStage.update(stage.id, {
        status: "in_progress",
        started_at: new Date().toISOString(),
      });
      setSaving(false);
    }
    // For blending, jump directly to the specific batch if startBatchNumber is given
    setStep(startBatchNumber ?? 1);
  };

  // ── Complete ──
  const handleComplete = async () => {
    setSaving(true);
    const currentBatchIdx = step - 1;
    const currentBatch = resolvedBatches?.[currentBatchIdx];
    const isLastBatch = step === totalBatches;

    try {
      if (usesIngredientBatches && currentBatch) {
        // For blending: complete one batch at a time
        const batchLbs = currentBatch.batchLbs;
        const subBatch = {
          sub_batch_id: `batch-${currentBatch.batchNumber}-${Date.now()}`,
          label: `Blending Batch #${currentBatch.batchNumber}`,
          qty_lbs: batchLbs,
          status: "completed",
        };

        // Update stage with this completed batch
        const updatedSubBatches = [...(stage.sub_batches || []), subBatch];

        await base44.entities.ProductionStage.update(stage.id, {
          sub_batches: updatedSubBatches,
          status: "in_progress",
          completed_at: isLastBatch ? new Date().toISOString() : stage.completed_at,
        });

        // Deduct raw materials for this batch only
        const batchIngredients = currentBatch.ingredients.map(ing => ({
          bucket_id: ing.bucket_id,
          bucket_name: ing.bucket_name,
          actual_lbs: ing.actual_lbs,
        }));
        base44.functions.invoke("deductRawInventoryOnBatchComplete", {
          stage_id: stage.id,
          ingredients: batchIngredients,
        }).catch(err => console.warn("Inventory deduction failed:", err));

        // Create chopping stage for this batch
        const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
        if (order) {
          const nextStepNum = (stage.step_number || 1) + 1;
          const nextFlow = await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);
          const nextStep = nextFlow?.steps?.find(s => s.step_number === nextStepNum);

          if (nextStep) {
            await base44.entities.ProductionStage.create({
              order_id: stage.order_id,
              order_number: stage.order_number,
              product_name: stage.product_name,
              step_number: nextStepNum,
              capability_id: nextStep.capability_id,
              capability_key: nextStep.capability_key,
              capability_name: nextStep.capability_name,
              work_profile_id: nextStep.work_profile_id,
              work_profile_name: nextStep.work_profile_name,
              status: "available",
              input_qty_lbs: currentBatch.batchLbs,
            });
          }
        }

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["allStages"] });
        queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
        queryClient.invalidateQueries({ queryKey: ["blendingStages"] });

        // Close wizard after each batch completion
        onCompleted?.();
        onClose();
      } else if (capKey === "linking" && cookBatch) {
        // ── Linking: complete this stage and mark all selected sibling stages as part of this cook batch ──
        const updates = {
          status: "completed",
          completed_at: new Date().toISOString(),
          cook_batch_lot: cookBatch.lotNumber,
          output_qty_lbs: form.output_qty_lbs || stage.input_qty_lbs || 0,
          ...form,
        };
        await base44.entities.ProductionStage.update(stage.id, updates);

        // Mark all other selected linking stages as merged into this cook batch
        const otherSelected = (cookBatch.selectedStageIds || []).filter(id => id !== stage.id);
        for (const sid of otherSelected) {
          await base44.entities.ProductionStage.update(sid, {
            cook_batch_lot: cookBatch.lotNumber,
            status: "completed",
            completed_at: new Date().toISOString(),
          });
        }

        // Create a single cooking stage for this cook batch
        const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
        if (order) {
          const nextFlow = await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);
          const cookStep = nextFlow?.steps?.find(s => s.capability_key === "cooking");
          if (cookStep) {
            // Check if a cooking stage already exists for this cook batch lot
            const existingCookStages = await base44.entities.ProductionStage.filter({
              order_id: stage.order_id,
              capability_key: "cooking",
            });
            const alreadyExists = existingCookStages.some(s => s.cook_batch_lot === cookBatch.lotNumber);
            if (!alreadyExists) {
              await base44.entities.ProductionStage.create({
                order_id: stage.order_id,
                order_number: stage.order_number,
                product_name: stage.product_name,
                step_number: cookStep.step_number,
                capability_id: cookStep.capability_id,
                capability_key: cookStep.capability_key,
                capability_name: cookStep.capability_name,
                work_profile_id: cookStep.work_profile_id,
                work_profile_name: cookStep.work_profile_name,
                status: "available",
                input_qty_lbs: cookBatch.totalQty,
                cook_batch_lot: cookBatch.lotNumber,
              });
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ["allStages"] });
        queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
        onCompleted?.();
        onClose();
      } else {
        // For non-blending/non-linking stages: complete the whole stage
        const updates = {
          status: "completed",
          completed_at: new Date().toISOString(),
          ...form,
        };

        await base44.entities.ProductionStage.update(stage.id, updates);

        // Unlock next stage
        const allStages = await base44.entities.ProductionStage.filter({ order_id: stage.order_id });
        const nextStage = allStages.find(s => s.step_number === stage.step_number + 1);
        if (nextStage?.status === "locked") {
          const rawQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
          // Apply 20% cook loss when passing from cooking to the next stage
          const nextInputQty = capKey === "cooking" ? parseFloat((rawQty * 0.8).toFixed(2)) : rawQty;
          await base44.entities.ProductionStage.update(nextStage.id, {
            status: "available",
            input_qty_lbs: nextInputQty,
            input_lot_number: updates.lot_number || stage.cook_batch_lot || "",
          });
        }

        queryClient.invalidateQueries({ queryKey: ["allStages"] });
        queryClient.invalidateQueries({ queryKey: ["productionOrders"] });

        onCompleted?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const progressPct = lastStep > 1 ? Math.round(((step - 1) / (lastStep - 1)) * 100) : 0;

  const Icon = STAGE_ICONS[capKey] || Package;
  const stageLabel = capKey ? capKey.charAt(0).toUpperCase() + capKey.slice(1) : "";

  // ── Render ──
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-chart-1" />
            {stageLabel} — {stage?.product_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Order #{stage?.order_number} · Step {stage?.step_number} · {stage?.input_qty_lbs || 0} lbs
          </p>
        </DialogHeader>

        {/* ── INTRO ── */}
        {step === 0 && (
          <IntroStep
            stage={stage}
            capKey={capKey}
            stageLabel={stageLabel}
            resolvedBatches={resolvedBatches}
            measureSteps={measureSteps}
            product={product}
            saving={saving}
            onStart={handleStart}
            usesIngredientBatches={usesIngredientBatches}
          />
        )}

        {/* ── INGREDIENT BATCH STEP (blending) ── */}
        {isBatchStep && currentBatch && (
          <BatchConfirmStep
            batch={currentBatch}
            batchIdx={step - 1}
            totalBatches={totalBatches}
            progressPct={progressPct}
            onUpdateIngredient={updateIngredient}
            onConfirmIngredient={confirmIngredient}
            allConfirmed={allConfirmedInBatch(currentBatch)}
            onBack={() => setStep(s => s - 1)}
            onComplete={handleComplete}
            saving={saving}
          />
        )}

        {/* ── MEASUREMENT STEP ── */}
        {isMeasureStep && currentMeasureStep && (
          <MeasureStep
            stepDef={currentMeasureStep}
            stepIndex={step - 1}
            totalSteps={totalMeasureSteps}
            progressPct={progressPct}
            form={form}
            setForm={setForm}
            spiceMixes={spiceMixes}
            casingBuckets={casingBuckets}
            capKey={capKey}
            stage={stage}
            cookBatch={cookBatch}
            setCookBatch={setCookBatch}
            onBack={() => setStep(s => s - 1)}
            onNext={() => setStep(s => s + 1)}
            isLast={step === totalMeasureSteps}
          />
        )}

        {/* ── FINAL REVIEW ── */}
        {isFinalStep && (
          <FinalStep
            stage={stage}
            capKey={capKey}
            stageLabel={stageLabel}
            resolvedBatches={resolvedBatches}
            form={form}
            cookBatch={cookBatch}
            saving={saving}
            onBack={() => setStep(lastStep - 1)}
            onComplete={handleComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntroStep({ stage, capKey, stageLabel, resolvedBatches, measureSteps, product, saving, onStart, usesIngredientBatches }) {
  const isAlreadyStarted = stage?.status === "in_progress";
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-chart-1/10 border border-chart-1/20 p-4 space-y-2">
        <p className="font-semibold text-chart-1">
          {isAlreadyStarted ? `Continue ${stageLabel}` : `Ready to start ${stageLabel}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {stage?.input_qty_lbs} lbs · Order #{stage?.order_number}
        </p>
        {usesIngredientBatches && resolvedBatches && (
          <div className="space-y-1 pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Batches to Complete</p>
            {resolvedBatches.map(b => (
              <div key={b.batchNumber} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-chart-1/20 text-chart-1 text-xs flex items-center justify-center font-bold">{b.batchNumber}</span>
                <span>{b.batchLbs} lbs</span>
                <span className="text-muted-foreground">· {b.ingredients.length} ingredient{b.ingredients.length !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}
        {!usesIngredientBatches && measureSteps.length > 0 && (
          <div className="space-y-1 pt-1">
            {measureSteps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-chart-1/20 text-chart-1 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        )}
        {usesIngredientBatches && !resolvedBatches && (
          <p className="text-sm text-muted-foreground">Loading batch plan...</p>
        )}
      </div>
      <Button
        className="w-full gap-2"
        onClick={onStart}
        disabled={saving || (usesIngredientBatches && !resolvedBatches)}
      >
        <Play className="w-4 h-4" />
        {isAlreadyStarted ? `Continue ${stageLabel}` : `Start ${stageLabel}`}
      </Button>
    </div>
  );
}

function BatchConfirmStep({ batch, batchIdx, totalBatches, progressPct, onUpdateIngredient, onConfirmIngredient, allConfirmed, onBack, onComplete, saving }) {
  return (
    <div className="space-y-4">
      <ProgressBar current={batch.batchNumber} total={totalBatches} pct={progressPct} label="Batch" />

      <div className="rounded-lg bg-muted/40 border p-3">
        <p className="font-semibold">Blend Batch #{batch.batchNumber}</p>
        <p className="text-sm text-muted-foreground">{batch.batchLbs} lbs</p>
      </div>

      {batch.ingredients.length > 0 && (
        <>
          <p className="text-sm font-medium">Confirm each ingredient:</p>
          <div className="space-y-3">
            {batch.ingredients.map((ing, ingIdx) => (
              <Card key={ingIdx} className={`border ${ing.confirmed ? "border-chart-2/40 bg-chart-2/5" : "border-border"}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{ing.bucket_name}</span>
                    {ing.confirmed
                      ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                      : <Badge variant="outline" className="text-xs">Pending</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">Required: <span className="font-semibold text-foreground">{ing.required_lbs} lbs</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Lot Code</Label>
                      <Input
                        value={ing.lot_number}
                        disabled={ing.confirmed}
                        onChange={e => onUpdateIngredient(batchIdx, ingIdx, "lot_number", e.target.value)}
                        placeholder="e.g. LOT-2024-001"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Actual Qty (lbs)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={ing.actual_lbs}
                        disabled={ing.confirmed}
                        onChange={e => onUpdateIngredient(batchIdx, ingIdx, "actual_lbs", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {!ing.confirmed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs gap-1 mt-1"
                      disabled={!ing.lot_number || !ing.actual_lbs}
                      onClick={() => onConfirmIngredient(batchIdx, ingIdx)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                    </Button>
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
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="gap-1" onClick={onBack} disabled={saving}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button 
          className="flex-1 gap-1 bg-chart-2 hover:bg-chart-2/90" 
          disabled={!allConfirmed || saving} 
          onClick={onComplete}
        >
          <CheckCircle2 className="w-4 h-4" /> Complete Batch #{batch.batchNumber}
        </Button>
      </div>
    </div>
  );
}

function MeasureStep({ stepDef, stepIndex, totalSteps, progressPct, form, setForm, spiceMixes, casingBuckets, capKey, stage, cookBatch, setCookBatch, onBack, onNext, isLast }) {
  const isLinking = capKey === "linking" && stepDef.id === "linking";
  // For linking: require a cook batch to be assembled before proceeding
  const canProceed = isLinking ? !!cookBatch : true;

  return (
    <div className="space-y-4">
      <ProgressBar current={stepIndex + 1} total={totalSteps} pct={progressPct} label="Step" />

      <div className="rounded-lg bg-muted/40 border p-3">
        <p className="font-semibold">{stepDef.label}</p>
      </div>

      <div className="space-y-3">
        {stepDef.fields.map(field => (
          <FieldInput
            key={field.key}
            field={field}
            value={form[field.key]}
            spiceMixes={spiceMixes}
            casingBuckets={casingBuckets}
            onChange={val => setForm(f => ({ ...f, [field.key]: val }))}
            onSpiceSelect={(id, name) => setForm(f => ({ ...f, spice_mix_id: id, spice_mix_name: name }))}
            onCasingSelect={(id, name) => setForm(f => ({ ...f, casing_bucket_id: id, casing_bucket_name: name }))}
          />
        ))}
      </div>

      {/* Cook batch builder — only for the linking step */}
      {isLinking && (
        <LinkingCookBatchBuilder
          stage={stage}
          cookBatch={cookBatch}
          onChange={setCookBatch}
        />
      )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!canProceed}
        nextLabel={isLast ? "Review & Complete" : "Next Step"}
      />
    </div>
  );
}

function FieldInput({ field, value, onChange, spiceMixes, casingBuckets = [], onSpiceSelect, onCasingSelect }) {
  if (field.type === "casing_select") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Select value={value || ""} onValueChange={v => {
          const bucket = (field.options || casingBuckets).find(b => b.id === v);
          onCasingSelect(v, bucket?.name || "");
        }}>
          <SelectTrigger><SelectValue placeholder="Select casings..." /></SelectTrigger>
          <SelectContent>
            {(field.options || casingBuckets).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "spice_select") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Select value={value || ""} onValueChange={v => {
          const mix = spiceMixes.find(m => m.id === v);
          onSpiceSelect(v, mix?.name || "");
        }}>
          <SelectTrigger><SelectValue placeholder="Select mix..." /></SelectTrigger>
          <SelectContent>
            {spiceMixes.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Switch checked={!!value} onCheckedChange={onChange} />
        <Label>{field.label}</Label>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="h-20"
          placeholder="Any observations..."
        />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      <Input
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "0.1" : undefined}
        value={value ?? ""}
        onChange={e => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
        className="h-9"
      />
    </div>
  );
}

function FinalStep({ stage, capKey, stageLabel, resolvedBatches, form, cookBatch, saving, onBack, onComplete }) {
  const outputLbs = resolvedBatches
    ? resolvedBatches.reduce((s, b) => s + b.batchLbs, 0)
    : form.output_qty_lbs || stage?.input_qty_lbs || 0;

  const isLinking = capKey === "linking";
  const canComplete = isLinking ? !!cookBatch : true;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-chart-2/10 border border-chart-2/20 p-4">
        <p className="font-semibold text-chart-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Ready to complete {stageLabel}
        </p>
        <p className="text-sm text-muted-foreground mt-1">Output: {outputLbs} lbs</p>
        {isLinking && cookBatch && (
          <div className="mt-2 text-sm space-y-0.5">
            <p className="text-muted-foreground">Cook Batch Lot: <span className="font-mono font-semibold text-foreground">{cookBatch.lotNumber}</span></p>
            <p className="text-muted-foreground">Cook Batch Qty: <span className="font-semibold text-foreground">{cookBatch.totalQty} lbs</span></p>
            <p className="text-muted-foreground">Linking Batches Merged: <span className="font-semibold text-foreground">{cookBatch.selectedStageIds?.length || 1}</span></p>
          </div>
        )}
        {isLinking && !cookBatch && (
          <p className="text-sm text-destructive mt-1">⚠ No cook batch assembled — go back to build one.</p>
        )}
      </div>

      {/* Batch summary (blending) */}
      {resolvedBatches && resolvedBatches.map(b => (
        <div key={b.batchNumber} className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Batch #{b.batchNumber} — {b.batchLbs} lbs
          </p>
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

      {/* Measurement summary */}
      {!resolvedBatches && Object.keys(form).length > 0 && (
        <div className="rounded border divide-y text-sm">
          {Object.entries(form).filter(([, v]) => v !== "" && v !== null && v !== undefined).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-3 py-2">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-medium">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="gap-1" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          className="flex-1 gap-1 bg-chart-2 hover:bg-chart-2/90"
          onClick={onComplete}
          disabled={saving || !canComplete}
        >
          <CheckCircle2 className="w-4 h-4" /> Complete {stageLabel}
        </Button>
      </div>
    </div>
  );
}

function ProgressBar({ current, total, pct, label }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label} {current} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-chart-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled, nextLabel }) {
  return (
    <div className="flex gap-2 pt-2">
      <Button variant="outline" className="gap-1" onClick={onBack}>
        <ChevronLeft className="w-4 h-4" /> Back
      </Button>
      <Button className="flex-1 gap-1" disabled={nextDisabled} onClick={onNext}>
        {nextLabel} <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}