import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import IngredientLotPicker from "../blending/IngredientLotPicker";
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
  Package, Thermometer, Clock, Layers, AlertCircle, FlaskConical
} from "lucide-react";
import LinkingCookBatchBuilder from "./LinkingCookBatchBuilder";
import TumbleCookBatchBuilder from "./TumbleCookBatchBuilder";
import RackingCookBatchBuilder from "./RackingCookBatchBuilder";
import SpiceMixLotPicker from "./SpiceMixLotPicker";

// ─── Stage icon map ───────────────────────────────────────────────────────────
const STAGE_ICONS = {
  blending: Package,
  chopping: FlaskConical,
  linking: Layers,
  racking: Layers,
  tumble: Thermometer,
  tumbling: Thermometer,
  mixer: Package,
  cooking: Thermometer,
  chilling: Thermometer,
  packaging: Package,
  sous_vide_pack: Layers,
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
        lot_allocations: null, // populated by IngredientLotPicker from FIFO
        confirmed: false,
        notes: "",
      })),
    };
  });
}

// ─── Build measurement steps for cooking / chilling / linking / packaging ────
function buildMeasurementSteps(stage, product, capKey, casingBuckets = []) {
  const steps = [];

  if (capKey === "chopping") {
    steps.push({
      id: "bowl_prep",
      label: "Bowl Preparation",
      fields: [
        { key: "input_lot_confirmed", label: `Confirm blend lot ${stage?.input_lot_number || "N/A"} added to bowl?`, type: "boolean" },
        { key: "spice_mix", label: "Spice Mix", type: "spice_mix_picker", requiredLbs: product?.chop_spice_qty_lbs || 0, filterSpiceMixId: product?.chop_spice_mix_id },
        { key: "cure_lot_number", label: "Cure Lot #", type: "text", placeholder: "e.g. CURE-LOT-2024-001" },
        { key: "cure_amount_lbs", label: "Cure Added (lbs)", type: "number" },
        { key: "water_amount_lbs", label: "Water Amount Added (lbs)", type: "number" },
        { key: "output_qty_lbs", label: "Output Qty (lbs)", type: "number" },
        { key: "output_lot_number", label: "Chopping Output Lot #", type: "text", placeholder: "e.g. CHOP-2024-001" },
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

  if (capKey === "tumble" || capKey === "tumbling") {
    const spiceQty = stage?.spice_mix_qty_lbs || product?.tumble_spice_qty_lbs || 0;
    steps.push({
      id: "tumble",
      label: "Tumbling",
      fields: [
        { key: "spice_mix", label: "Spice Mix Added", type: "spice_mix_picker", requiredLbs: spiceQty, filterSpiceMixId: product?.chop_spice_mix_id },
        { key: "duration_minutes", label: "Tumble Duration (minutes)", type: "number" },
        // output qty / lot / cook batch plan handled by TumbleCookBatchBuilder embedded in MeasureStep
      ],
    });
  }

  if (capKey === "mixer") {
    const porkLot = stage?.pork_lot_number || stage?.input_lot_number || "N/A";
    const binderLot = stage?.binder_lot_number || "";
    steps.push({
      id: "mixer_inputs",
      label: "Confirm Incoming Batches",
      fields: [
        { key: "pork_lot_confirmed", label: `Confirm Pork batch lot "${porkLot}" added to mixer?`, type: "boolean" },
        { key: "pork_qty_lbs", label: "Pork Batch Qty (lbs)", type: "number", defaultValue: stage?.input_qty_lbs },
        { key: "binder_lot_confirmed", label: `Confirm Binder batch lot "${binderLot || "— awaiting bowl chopper"}" added to mixer?`, type: "boolean" },
        { key: "binder_qty_lbs", label: "Binder Batch Qty (lbs)", type: "number", defaultValue: stage?.binder_qty_lbs },
      ],
    });
    steps.push({
      id: "mixer",
      label: "Mixing",
      fields: [
        { key: "duration_minutes", label: "Mix Duration (minutes)", type: "number" },
        { key: "output_qty_lbs", label: "Combined Output Qty (lbs)", type: "number" },
        { key: "output_lot_number", label: "Linker Batch Lot #", type: "text", placeholder: "e.g. MIX-2024-001" },
        { key: "notes", label: "Notes / Observations", type: "textarea" },
      ],
    });
  }

  if (capKey === "racking") {
    steps.push({
      id: "racking",
      label: "Racking",
      fields: [
        { key: "output_qty_lbs", label: "Output Qty (lbs)", type: "number" },
        { key: "output_lot_number", label: "Racked Lot #", type: "text", placeholder: "e.g. RACK-2024-001" },
        { key: "notes", label: "Notes / Observations", type: "textarea" },
      ],
    });
  }

  if (capKey === "cooking") {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const cookLotDefault = stage?.cook_batch_lot
      ? `${stage.cook_batch_lot}-${today}`
      : `COOK-${today}`;
    // Auto-calculate rack count from stage's racks_count if available
    const racksCount = stage?.racks_count || 0;
    steps.push({
      id: "cook",
      label: "Cook Parameters",
      fields: [
        { key: "temperature_f", label: "Internal Temp (°F)", type: "number" },
        { key: "duration_minutes", label: "Cook Time (minutes)", type: "number" },
        { key: "racks_count", label: "Rack Count", type: "number", defaultValue: racksCount, disabled: true },
        { key: "output_lot_number", label: "Cooked Lot #", type: "text", placeholder: "e.g. COOK-2024-001", defaultValue: cookLotDefault },
      ],
    });
  }

  if (capKey === "chilling") {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    // Extract cooking batch number from cook_batch_lot (e.g., "CB1" from "SV-CB1-2024...")
    const cookBatchMatch = stage?.cook_batch_lot?.match(/CB(\d+)/);
    const cookBatchNumber = cookBatchMatch ? cookBatchMatch[1] : "?";
    const chillLotDefault = `CHILL-${today}-CB${cookBatchNumber}`;
    steps.push({
      id: "chill",
      label: "Chill Check",
      fields: [
        { key: "temperature_c", label: "Exit Temp (°C)", type: "number" },
        { key: "duration_minutes", label: "Chill Duration (minutes)", type: "number" },
        { key: "output_lot_number", label: "Chilled Lot #", type: "text", placeholder: "e.g. CHILL-2024-001", defaultValue: chillLotDefault },
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

  // Generic fallback for any capability not explicitly handled above
  const knownKeys = ["chopping", "linking", "cooking", "chilling", "packaging", "racking", "tumble", "tumbling", "mixer"];
  if (!knownKeys.includes(capKey)) {
    steps.push({
      id: "generic",
      label: "Stage Details",
      fields: [
        { key: "output_qty_lbs", label: "Output Qty (lbs)", type: "number" },
        { key: "output_lot_number", label: "Output Lot #", type: "text", placeholder: "e.g. STAGE-2024-001" },
        { key: "notes", label: "Notes / Observations", type: "textarea" },
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
  const [cookPlan, setCookPlan] = useState(null);   // for tumble stage
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

  const { data: casingBuckets = [] } = useQuery({
    queryKey: ["casingBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "casing" }),
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
    ? buildMeasurementSteps(stage, product, capKey, casingBuckets)
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
          actual_lbs: ing.lot_allocations?.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0) || 0,
          lot_allocations: ing.lot_allocations,
        }));
        base44.functions.invoke("deductRawInventoryOnBatchComplete", {
          stage_id: stage.id,
          ingredients: batchIngredients,
        }).catch(err => console.warn("Inventory deduction failed:", err));

        // Route blending outputs: beef → chopping (step 2), pork → mixer (step 3) directly
        const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
        if (order) {
          const allStages = await base44.entities.ProductionStage.filter({ order_id: stage.order_id });
          const nextFlow = await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);

          // Detect if this is a kielbasa-style flow with a mixer step
          const hasMixerStep = nextFlow?.steps?.some(s => s.capability_key === "mixer");

          // Separate pork and beef ingredients from this batch
          const porkIngredients = currentBatch.ingredients.filter(ing =>
            ing.bucket_name?.toLowerCase().includes("pork")
          );
          const beefIngredients = currentBatch.ingredients.filter(ing =>
            !ing.bucket_name?.toLowerCase().includes("pork")
          );

          const porkLbs = porkIngredients.reduce((s, ing) =>
            s + (ing.lot_allocations?.reduce((ss, a) => ss + (Number(a.actual_lbs) || 0), 0) || ing.required_lbs || 0), 0
          );
          const beefLbs = currentBatch.batchLbs - porkLbs;

          const blendOutputLot = form.output_lot_number || `BLEND-${Date.now()}`;
          const porkLotNumber = porkIngredients[0]?.lot_allocations?.[0]?.lot_number || blendOutputLot;

          if (hasMixerStep && porkLbs > 0 && beefLbs > 0) {
            // ── Kielbasa flow: route beef to chopping, pork to mixer ──
            const nextStepNum = (stage.step_number || 1) + 1; // chopping
            const mixerStep = nextFlow?.steps?.find(s => s.capability_key === "mixer");
            const choppingStep = nextFlow?.steps?.find(s => s.capability_key === "chopping");

            // Unlock/create chopping stage with beef qty + lot
            const existingChoppingStage = allStages.find(s => s.step_number === nextStepNum && s.capability_key === "chopping");
            if (existingChoppingStage && existingChoppingStage.status === "locked") {
              await base44.entities.ProductionStage.update(existingChoppingStage.id, {
                status: "available",
                input_qty_lbs: parseFloat(beefLbs.toFixed(2)),
                input_lot_number: blendOutputLot,
              });
            } else if (!existingChoppingStage && choppingStep) {
              await base44.entities.ProductionStage.create({
                order_id: stage.order_id,
                order_number: stage.order_number,
                product_name: stage.product_name,
                step_number: choppingStep.step_number,
                capability_id: choppingStep.capability_id,
                capability_key: choppingStep.capability_key,
                capability_name: choppingStep.capability_name,
                work_profile_id: choppingStep.work_profile_id || "",
                work_profile_name: choppingStep.work_profile_name || "",
                status: "available",
                input_qty_lbs: parseFloat(beefLbs.toFixed(2)),
                input_lot_number: blendOutputLot,
              });
            }

            // Unlock/create mixer stage with pork qty + lot (pork bypasses chopping)
            const existingMixerStage = allStages.find(s => s.capability_key === "mixer");
            if (existingMixerStage && existingMixerStage.status === "locked") {
              await base44.entities.ProductionStage.update(existingMixerStage.id, {
                // Store pork lot info on the mixer stage for the wizard to read
                pork_lot_number: porkLotNumber,
                input_qty_lbs: parseFloat(porkLbs.toFixed(2)),
                input_lot_number: porkLotNumber,
              });
            } else if (!existingMixerStage && mixerStep) {
              await base44.entities.ProductionStage.create({
                order_id: stage.order_id,
                order_number: stage.order_number,
                product_name: stage.product_name,
                step_number: mixerStep.step_number,
                capability_id: mixerStep.capability_id,
                capability_key: mixerStep.capability_key,
                capability_name: mixerStep.capability_name,
                work_profile_id: mixerStep.work_profile_id || "",
                work_profile_name: mixerStep.work_profile_name || "",
                status: "locked", // stays locked until chopping completes and provides the binder
                pork_lot_number: porkLotNumber,
                input_qty_lbs: parseFloat(porkLbs.toFixed(2)),
                input_lot_number: porkLotNumber,
              });
            }
          } else {
            // ── Standard flow: unlock the immediately next stage ──
            const nextStepNum = (stage.step_number || 1) + 1;
            const existingNextStage = allStages.find(s => s.step_number === nextStepNum);

            if (existingNextStage && existingNextStage.status === "locked") {
              await base44.entities.ProductionStage.update(existingNextStage.id, {
                status: "available",
                input_qty_lbs: currentBatch.batchLbs,
                input_lot_number: blendOutputLot,
              });
            } else if (!existingNextStage) {
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
          }
        }

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["allStages"] });
        queryClient.invalidateQueries({ queryKey: ["orderStages", stage.order_id] });
        queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
        queryClient.invalidateQueries({ queryKey: ["blendingStages"] });

        // Close wizard after each batch completion
        onCompleted?.();
        onClose();
      } else if ((capKey === "tumble" || capKey === "tumbling") && cookPlan) {
        // ── Tumble: complete stage, then create one cooking stage per cook batch ──
        const totalOutputLbs = cookPlan.cookBatches.reduce((s, b) => s + b.lbs, 0);
        const tumbleOutputLot = cookPlan.lotPrefix || `TUMBLE-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`;
        await base44.entities.ProductionStage.update(stage.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          output_qty_lbs: totalOutputLbs,
          output_lot_number: tumbleOutputLot,
          racks_count: cookPlan.cookBatches.reduce((s, b) => s + b.racks, 0),
          spice_mix_id: form.spice_mix_id || "",
          spice_mix_name: form.spice_mix_name || "",
          spice_mix_lot_number: form.spice_mix_lot_number || "",
          spice_mix_qty_lbs: form.spice_mix_qty_lbs || 0,
          duration_minutes: form.duration_minutes || null,
          temperature_c: form.temperature_c || null,
        });

        // Deduct FIFO lots for protein + spice across all cook batches
        for (const cb of cookPlan.cookBatches) {
          const ingredients = [];
          if (cb.proteinLots?.length) {
            const proteinBucket = product?.blend_ingredients?.[0];
            ingredients.push({
              bucket_id: proteinBucket?.bucket_id || "",
              bucket_name: proteinBucket?.bucket_name || "Protein",
              actual_lbs: cb.proteinLots.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0),
              lot_allocations: cb.proteinLots,
            });
          }
          if (cb.spiceLots?.length) {
            ingredients.push({
              bucket_id: cb.spiceLots[0]?.bucket_id || null,
              bucket_name: "Spice",
              actual_lbs: cb.spiceLots.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0),
              lot_allocations: cb.spiceLots,
            });
          }
          if (ingredients.length) {
            base44.functions.invoke("deductRawInventoryOnBatchComplete", {
              stage_id: stage.id,
              ingredients,
            }).catch(err => console.warn("Inventory deduction failed:", err));
          }
        }

        // Look up the next steps in the flow after tumbling and create independent per-batch stages
        const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
        if (order) {
          const nextFlow = await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);
          if (nextFlow?.steps) {
            const sortedSteps = [...nextFlow.steps].sort((a, b) => a.step_number - b.step_number);
            const nextSteps = sortedSteps.filter(s => s.step_number > stage.step_number);
            if (nextSteps.length > 0) {
              const firstNextStep = nextSteps[0];
              // Create one independent stage for this cook batch at the next step
              for (const cb of cookPlan.cookBatches) {
                await base44.entities.ProductionStage.create({
                  order_id: stage.order_id,
                  order_number: stage.order_number,
                  product_name: stage.product_name,
                  step_number: firstNextStep.step_number,
                  capability_id: firstNextStep.capability_id,
                  capability_key: firstNextStep.capability_key,
                  capability_name: firstNextStep.capability_name,
                  work_profile_id: firstNextStep.work_profile_id || "",
                  work_profile_name: firstNextStep.work_profile_name || "",
                  status: "available",
                  input_qty_lbs: cb.lbs,
                  racks_count: cb.racks,
                  cook_batch_lot: cb.lotNumber,
                  input_lot_number: cb.lotNumber,
                });
              }
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ["allStages"] });
        queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
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
          queryClient.invalidateQueries({ queryKey: ["orderStages", stage.order_id] });
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
        // Convert temperature from Fahrenheit to Celsius for storage if present
        if (capKey === "cooking" && updates.temperature_f) {
          updates.temperature_c = parseFloat(((updates.temperature_f - 32) * 5/9).toFixed(2));
          delete updates.temperature_f;
        } else if (capKey === "chilling" && updates.temperature_f) {
          updates.temperature_c = parseFloat(((updates.temperature_f - 32) * 5/9).toFixed(2));
          delete updates.temperature_f;
        }

        await base44.entities.ProductionStage.update(stage.id, updates);

        // If this is packaging: push into the FG bucket AND create an InventoryItem lot
        if (capKey === "packaging") {
          const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
          if (order) {
            const today = new Date();
            const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
            const rand = Math.floor(Math.random() * 900 + 100);
            const fgLot = updates.lot_number || `FG-${datePart}-${(order.order_number || "").replace(/\D/g, "").slice(-4)}-${rand}`;

            const outputLbs = updates.output_qty_lbs || stage.input_qty_lbs || 0;
            const packagesProduced = updates.packages_produced || 0;
            const today_str = today.toISOString().slice(0, 10);

            // Find the product to get shelf life and case weight
            const product = await base44.entities.Product.filter({ id: order.product_id }).then(r => r?.[0]);
            const shelfLifeDays = product?.shelf_life_days || null;
            const caseWeightLbs = product?.case_weight_lbs || null;
            const expiryDate = shelfLifeDays
              ? new Date(today.getTime() + shelfLifeDays * 86400000).toISOString().slice(0, 10)
              : null;

            // Calculate cases from packages if case info available
            const packagesPerCase = product?.packages_per_case || null;
            const casesProduced = packagesPerCase && packagesProduced
              ? Math.floor(packagesProduced / packagesPerCase)
              : (caseWeightLbs && outputLbs ? parseFloat((outputLbs / caseWeightLbs).toFixed(2)) : 0);

            // 1. Push into FinishedGoodsBucket (find or create)
            const existingBuckets = await base44.entities.FinishedGoodsBucket.filter({ product_id: order.product_id });
            const bucket = existingBuckets[0];
            if (bucket) {
              const newLots = [...(bucket.lots || []), {
                lot_number: fgLot,
                production_date: today_str,
                expiry_date: expiryDate,
                quantity_lbs: outputLbs,
                cases: casesProduced,
                order_number: order.order_number || "",
                status: "available",
              }];
              await base44.entities.FinishedGoodsBucket.update(bucket.id, {
                quantity_lbs: (bucket.quantity_lbs || 0) + outputLbs,
                cases_on_hand: (bucket.cases_on_hand || 0) + casesProduced,
                lots: newLots,
              });
            } else {
              // Create bucket on the fly if missing
              await base44.entities.FinishedGoodsBucket.create({
                product_id: order.product_id || "",
                product_name: stage.product_name || order.product_name || "",
                sku: product?.sku || "",
                product_number: product?.product_number || "",
                category: product?.category || "",
                quantity_lbs: outputLbs,
                cases_on_hand: casesProduced,
                case_weight_lbs: caseWeightLbs,
                lots: [{
                  lot_number: fgLot,
                  production_date: today_str,
                  expiry_date: expiryDate,
                  quantity_lbs: outputLbs,
                  cases: casesProduced,
                  order_number: order.order_number || "",
                  status: "available",
                }],
                status: "active",
              });
            }

            // 2. Also create InventoryItem for lot-level traceability
            await base44.entities.InventoryItem.create({
              product_id: order.product_id || "",
              product_name: stage.product_name || order.product_name || "",
              sku: product?.sku || order.sku || "",
              batch_id: stage.order_id,
              batch_number: order.order_number || "",
              lot_number: fgLot,
              quantity_lbs: outputLbs,
              original_quantity_lbs: outputLbs,
              status: "available",
              production_date: today_str,
              expiry_date: expiryDate,
              notes: `Created from packaging stage. Cook batch: ${stage.cook_batch_lot || stage.input_lot_number || ""}`,
            });

            queryClient.invalidateQueries({ queryKey: ["inventory"] });
            queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
          }
        }

        // Unlock next stage and pass lot traceability (or create it if it doesn't exist)
        const allStages = await base44.entities.ProductionStage.filter({ order_id: stage.order_id });
        let nextStage = allStages.find(s => s.step_number === stage.step_number + 1 && s.status !== "completed");
        
        // For chilling, create packing stages if they don't exist
        if (!nextStage && capKey === "chilling") {
          const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
          if (order?.flow_id) {
            const flow = await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);
            const nextFlowStep = flow?.steps?.find(s => s.step_number === stage.step_number + 1);
            if (nextFlowStep) {
              const rawQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
              const nextInputLot = updates.output_lot_number || stage.cook_batch_lot || stage.input_lot_number || "";
              await base44.entities.ProductionStage.create({
                order_id: stage.order_id,
                order_number: stage.order_number,
                product_name: stage.product_name,
                step_number: nextFlowStep.step_number,
                capability_id: nextFlowStep.capability_id,
                capability_key: nextFlowStep.capability_key,
                capability_name: nextFlowStep.capability_name,
                work_profile_id: nextFlowStep.work_profile_id || "",
                work_profile_name: nextFlowStep.work_profile_name || "",
                status: "available",
                input_qty_lbs: rawQty,
                input_lot_number: nextInputLot,
                cook_batch_lot: stage.cook_batch_lot || "",
              });
              // Refresh nextStage after creation
              nextStage = await base44.entities.ProductionStage.filter({ order_id: stage.order_id }).then(r =>
                r.find(s => s.step_number === stage.step_number + 1 && s.status !== "completed")
              );
            }
          }
        }

        // For cooking stage, create a chilling stage for each cook batch in the cook plan
        if (capKey === "cooking" && cookPlan?.cookBatches?.length > 0) {
          const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
          if (order?.flow_id) {
            const flow = await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);
            const nextFlowStep = flow?.steps?.find(s => s.step_number === stage.step_number + 1);
            if (nextFlowStep) {
              const productData = await base44.entities.Product.filter({ id: order.product_id }).then(r => r?.[0]);
              const yieldFraction = ((productData?.yield_percent ?? 85)) / 100;

              // Create a chilling stage for EACH cook batch
              for (const batch of cookPlan.cookBatches) {
                const batchQty = parseFloat((batch.lbs * yieldFraction).toFixed(2));
                await base44.entities.ProductionStage.create({
                  order_id: stage.order_id,
                  order_number: stage.order_number,
                  product_name: stage.product_name,
                  step_number: nextFlowStep.step_number,
                  capability_id: nextFlowStep.capability_id,
                  capability_key: nextFlowStep.capability_key,
                  capability_name: nextFlowStep.capability_name,
                  work_profile_id: nextFlowStep.work_profile_id || "",
                  work_profile_name: nextFlowStep.work_profile_name || "",
                  status: "available",
                  input_qty_lbs: batchQty,
                  input_lot_number: batch.lotNumber || "",
                  cook_batch_lot: batch.lotNumber || "",
                });
              }
            }
          }
        }

        if (nextStage?.status === "locked") {
           const rawQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
          const productYield = product?.yield_percent;
          if (!productYield) console.warn(`Product missing yield_percent; using default 85%`);
          const yieldFraction = (productYield ?? 85) / 100;
          const nextInputQty = capKey === "cooking" ? parseFloat((rawQty * yieldFraction).toFixed(2)) : rawQty; // No yield applied to chilling
          
          // Determine lot number to pass forward
          let nextInputLot = "";
          if (capKey === "packaging") {
            nextInputLot = updates.lot_number || "";
          } else if (capKey === "chopping" || capKey === "cooking" || capKey === "chilling" || capKey === "mixer" || capKey === "racking") {
            // These stages produce an output lot number that feeds the next stage
            nextInputLot = updates.output_lot_number || stage.cook_batch_lot || stage.input_lot_number || "";
          } else {
            // Linking: use cook batch lot
            nextInputLot = stage.cook_batch_lot || stage.input_lot_number || "";
          }

          // Special case: chopping feeds into a mixer stage — unlock it and store the binder lot
          if (capKey === "chopping" && nextStage.capability_key === "mixer") {
            await base44.entities.ProductionStage.update(nextStage.id, {
              status: "available",
              input_qty_lbs: nextInputQty,
              input_lot_number: nextStage.input_lot_number || "", // keep pork lot that was set by blending
              binder_lot_number: nextInputLot, // chopping output becomes the binder
              binder_qty_lbs: nextInputQty,
            });
          } else {
            await base44.entities.ProductionStage.update(nextStage.id, {
              status: "available",
              input_qty_lbs: nextInputQty,
              input_lot_number: nextInputLot,
            });
          }
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
      <DialogContent className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-card shrink-0">
          <div className="w-10 h-10 rounded-xl bg-chart-1/15 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-chart-1" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold leading-tight">{stageLabel} — {stage?.product_name}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order <span className="font-semibold text-foreground">#{stage?.order_number}</span>
              &nbsp;·&nbsp;Step {stage?.step_number}
              &nbsp;·&nbsp;<span className="font-semibold text-foreground">{stage?.input_qty_lbs || 0} lbs</span> in
            </p>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
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
              casingBuckets={casingBuckets}
              capKey={capKey}
              stage={stage}
              product={product}
              cookBatch={cookBatch}
              setCookBatch={setCookBatch}
              cookPlan={cookPlan}
              setCookPlan={setCookPlan}
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
              cookPlan={cookPlan}
              saving={saving}
              onBack={() => setStep(lastStep - 1)}
              onComplete={handleComplete}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntroStep({ stage, capKey, stageLabel, resolvedBatches, measureSteps, product, saving, onStart, usesIngredientBatches }) {
  const isAlreadyStarted = stage?.status === "in_progress";
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-chart-1/10 border border-chart-1/20 p-5 space-y-4">
        <div>
          <p className="font-bold text-chart-1 text-base">
            {isAlreadyStarted ? `Continue ${stageLabel}` : `Ready to start ${stageLabel}`}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{stage?.input_qty_lbs} lbs</span> entering this stage
          </p>
        </div>

        {usesIngredientBatches && resolvedBatches && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Batches to Complete</p>
            {resolvedBatches.map(b => (
              <div key={b.batchNumber} className="flex items-center gap-3 bg-white/50 rounded-lg px-3 py-2.5">
                <span className="w-7 h-7 rounded-full bg-chart-1/20 text-chart-1 text-sm flex items-center justify-center font-bold shrink-0">{b.batchNumber}</span>
                <span className="font-semibold text-sm">{b.batchLbs} lbs</span>
                <span className="text-muted-foreground text-sm">· {b.ingredients.length} ingredient{b.ingredients.length !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}

        {!usesIngredientBatches && measureSteps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Steps in this stage</p>
            {measureSteps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 bg-white/50 rounded-lg px-3 py-2.5">
                <span className="w-7 h-7 rounded-full bg-chart-1/20 text-chart-1 text-sm flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {usesIngredientBatches && !resolvedBatches && (
          <p className="text-sm text-muted-foreground">Loading batch plan...</p>
        )}
      </div>

      <Button
        className="w-full h-12 text-base gap-2 font-semibold"
        onClick={onStart}
        disabled={saving || (usesIngredientBatches && !resolvedBatches)}
      >
        <Play className="w-5 h-5" />
        {isAlreadyStarted ? `Continue ${stageLabel}` : `Start ${stageLabel}`}
      </Button>
    </div>
  );
}

function BatchConfirmStep({ batch, batchIdx, totalBatches, progressPct, onUpdateIngredient, onConfirmIngredient, allConfirmed, onBack, onComplete, saving }) {
  return (
    <div className="space-y-5">
      <ProgressBar current={batch.batchNumber} total={totalBatches} pct={progressPct} label="Batch" />

      <div className="rounded-xl bg-muted/40 border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-base">Blend Batch #{batch.batchNumber}</p>
          <p className="text-sm text-muted-foreground">{batch.batchLbs} lbs</p>
        </div>
        {allConfirmed && (
          <CheckCircle2 className="w-5 h-5 text-chart-2" />
        )}
      </div>

      {batch.ingredients.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Confirm each ingredient</p>
          {batch.ingredients.map((ing, ingIdx) => (
            <Card key={ingIdx} className={`border-2 transition-colors ${ing.confirmed ? "border-chart-2/40 bg-chart-2/5" : "border-border"}`}>
              <CardContent className="p-4">
                <IngredientLotPicker
                  ing={ing}
                  disabled={ing.confirmed}
                  onChange={(field, value) => onUpdateIngredient(batchIdx, ingIdx, field, value)}
                  onConfirm={() => onConfirmIngredient(batchIdx, ingIdx)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack} disabled={saving}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          className="flex-1 gap-2 h-11 text-base font-semibold bg-chart-2 hover:bg-chart-2/90"
          disabled={!allConfirmed || saving}
          onClick={onComplete}
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? "Saving…" : `Complete Batch #${batch.batchNumber}`}
        </Button>
      </div>
    </div>
  );
}

function MeasureStep({ stepDef, stepIndex, totalSteps, progressPct, form, setForm, casingBuckets, capKey, stage, product, cookBatch, setCookBatch, cookPlan, setCookPlan, onBack, onNext, isLast }) {
  const [spiceShortNotes, setSpiceShortNotes] = React.useState("");
  const [caseWeights, setCaseWeights] = React.useState(form.case_weights || []);

  // Auto-populate fields with defaultValue when first entering this step
  // Also handle temperature conversion from Celsius to Fahrenheit for cooking/chilling
  React.useEffect(() => {
    const defaults = {};
    for (const field of stepDef.fields) {
      if (field.defaultValue !== undefined && (form[field.key] === undefined || form[field.key] === "")) {
        defaults[field.key] = field.defaultValue;
      }
      // Convert Celsius to Fahrenheit for display in cooking/chilling stages
      if (field.key === "temperature_f" && stage?.temperature_c && !form.temperature_f) {
        defaults[field.key] = parseFloat(((stage.temperature_c * 9/5) + 32).toFixed(2));
      }
    }
    if (Object.keys(defaults).length > 0) {
      setForm(f => ({ ...defaults, ...f }));
    }
  }, [stepDef.id]);
  const isLinking = capKey === "linking" && stepDef.id === "linking";
  const isTumble = (capKey === "tumble" || capKey === "tumbling") && stepDef.id === "tumble";
  const isRacking = capKey === "racking" && stepDef.id === "racking" && stage?.flow_name === "Tumbling Protein Flow (Large)";
  const isPackaging = capKey === "packaging" && stepDef.id === "packaging" && product?.varied_weights;
  const isMixerInputs = capKey === "mixer" && stepDef.id === "mixer_inputs";

  // Check if spice is short and notes are required
  const spiceField = stepDef.fields.find(f => f.type === "spice_mix_picker");
  const spiceValue = spiceField ? form[spiceField.key] : null;
  const spiceTotalAllocated = spiceValue?.lots
    ? spiceValue.lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0)
    : (Number(spiceValue?.spice_mix_qty_lbs) || 0);
  const spiceRequired = spiceField?.requiredLbs || 0;
  const spiceIsShort = spiceRequired > 0 && spiceTotalAllocated > 0 && spiceTotalAllocated < spiceRequired - 0.001;
  const spiceBlocksNext = spiceIsShort && !spiceShortNotes?.trim();

  const canProceed = isLinking ? !!cookBatch
    : isTumble ? !!cookPlan
    : isRacking ? !!cookPlan
    : isPackaging ? (form.case_count > 0 && caseWeights.length === parseInt(form.case_count))
    : isMixerInputs ? (!!form.pork_lot_confirmed && !!form.binder_lot_confirmed)
    : !spiceBlocksNext;

  return (
    <div className="space-y-5">
      <ProgressBar current={stepIndex + 1} total={totalSteps} pct={progressPct} label="Step" />

      <div className="rounded-xl bg-muted/40 border px-4 py-3">
        <p className="font-bold text-base">{stepDef.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Step {stepIndex + 1} of {totalSteps}</p>
      </div>

      {stepDef.fields.length > 0 && (
        <div className="space-y-4">
          {stepDef.fields.map(field => (
            <FieldInput
              key={field.key}
              field={field}
              value={form[field.key]}
              casingBuckets={casingBuckets}
              spiceShortNotes={spiceShortNotes}
              onSpiceShortNotesChange={setSpiceShortNotes}
              onChange={val => {
                if (field.type === "spice_mix_picker") {
                  // Spread spice mix sub-fields onto form for easy saving
                  setForm(f => ({
                    ...f,
                    spice_mix: val,
                    spice_mix_id: val.spice_mix_id || "",
                    spice_mix_name: val.spice_mix_name || "",
                    spice_mix_lot_number: val.spice_mix_lot_number || "",
                    spice_mix_qty_lbs: val.spice_mix_qty_lbs || 0,
                  }));
                } else {
                  setForm(f => ({ ...f, [field.key]: val }));
                }
              }}
              onCasingSelect={(id, name) => setForm(f => ({ ...f, casing_bucket_id: id, casing_bucket_name: name }))}
            />
          ))}
        </div>
      )}

      {/* Mixer batch merge summary */}
      {isMixerInputs && (
        <div className="rounded-xl border border-chart-1/30 bg-chart-1/5 p-4 space-y-3">
          <p className="text-xs font-bold text-chart-1 uppercase tracking-wider">Batches Being Combined</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 text-sm">
              <div>
                <span className="font-semibold">Pork Batch</span>
                <span className="text-muted-foreground text-xs ml-2">from Blending</span>
              </div>
              <span className="font-mono text-xs font-bold">{stage?.pork_lot_number || stage?.input_lot_number || "—"}</span>
            </div>
            <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 text-sm">
              <div>
                <span className="font-semibold">Binder Batch</span>
                <span className="text-muted-foreground text-xs ml-2">from Bowl Chopper</span>
              </div>
              <span className="font-mono text-xs font-bold">{stage?.binder_lot_number || "awaiting chopper"}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Both batches must be confirmed before proceeding to mix.</p>
        </div>
      )}

      {/* Cook batch builder — linking step */}
      {isLinking && (
        <LinkingCookBatchBuilder
          stage={stage}
          cookBatch={cookBatch}
          onChange={setCookBatch}
        />
      )}

      {/* Cook batch builder — tumble step */}
      {isTumble && (
        <TumbleCookBatchBuilder
          totalLbs={stage?.input_qty_lbs || 0}
          product={product}
          cookPlan={cookPlan}
          onChange={setCookPlan}
        />
      )}

      {/* Cook batch builder — racking step */}
      {isRacking && (
        <RackingCookBatchBuilder
          totalLbs={form.output_qty_lbs || stage?.input_qty_lbs || 0}
          cookPlan={cookPlan}
          onChange={setCookPlan}
        />
      )}

      {/* Case weights for varied weights products */}
      {isPackaging && (
        <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
          <div>
            <p className="font-semibold text-sm">Individual Case Weights</p>
            <p className="text-xs text-muted-foreground">Enter weight for each case ({form.case_count} total)</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: parseInt(form.case_count) || 0 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <label className="text-xs font-medium">Case {i + 1}</label>
                <input
                  type="number"
                  step="0.01"
                  value={caseWeights[i]?.weight_lbs || ""}
                  onChange={(e) => {
                    const updated = [...caseWeights];
                    if (!updated[i]) updated[i] = {};
                    updated[i].weight_lbs = e.target.value ? Number(e.target.value) : 0;
                    updated[i].case_number = i + 1;
                    setCaseWeights(updated);
                    setForm(prev => ({ ...prev, case_weights: updated }));
                  }}
                  className="h-8 px-2 border border-input rounded text-sm"
                  placeholder="lbs"
                />
              </div>
            ))}
          </div>
          {caseWeights.length > 0 && (
            <div className="pt-2 border-t border-border text-xs space-y-1">
              <p className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{caseWeights.reduce((s, c) => s + (c.weight_lbs || 0), 0).toFixed(2)} lbs</span></p>
              <p className="text-muted-foreground">Average: <span className="font-semibold text-foreground">{(caseWeights.reduce((s, c) => s + (c.weight_lbs || 0), 0) / caseWeights.length).toFixed(2)} lbs</span></p>
            </div>
          )}
        </div>
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

function FieldInput({ field, value, onChange, casingBuckets = [], onCasingSelect, spiceShortNotes, onSpiceShortNotesChange }) {
  if (field.type === "spice_mix_picker") {
    return (
      <SpiceMixLotPicker
        label={field.label}
        requiredLbs={field.requiredLbs || 0}
        value={value || {}}
        onChange={onChange}
        filterSpiceMixId={field.filterSpiceMixId}
        shortNotes={spiceShortNotes}
        onShortNotesChange={onSpiceShortNotesChange}
      />
    );
  }
  if (field.type === "casing_select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Select value={value || ""} onValueChange={v => {
          const bucket = (field.options || casingBuckets).find(b => b.id === v);
          onCasingSelect(v, bucket?.name || "");
        }}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select casings..." /></SelectTrigger>
          <SelectContent>
            {(field.options || casingBuckets).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "spice_select") {
    // Legacy fallback — replaced by spice_mix_picker; skip gracefully
    return null;
  }
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
        <Switch checked={!!value} onCheckedChange={onChange} className="scale-125" />
        <Label className="text-sm font-medium cursor-pointer select-none">{field.label}</Label>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="h-24 text-base"
          placeholder={field.placeholder || "Any observations..."}
          disabled={field.disabled}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{field.label}</Label>
      <Input
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "0.1" : undefined}
        value={value ?? field.defaultValue ?? ""}
        onChange={e => {
          let val = field.type === "number" ? Number(e.target.value) : e.target.value;
          onChange(val);
        }}
        placeholder={field.placeholder || ""}
        className="h-11 text-base"
        disabled={field.disabled}
      />
    </div>
  );
}

function FinalStep({ stage, capKey, stageLabel, resolvedBatches, form, cookBatch, cookPlan, saving, onBack, onComplete }) {
  const isLinking = capKey === "linking";
  const isTumble = capKey === "tumble" || capKey === "tumbling";
  const isRacking = capKey === "racking" && stage?.flow_name === "Tumbling Protein Flow (Large)";
  const isPackaging = capKey === "packaging" && form.case_weights;

  const outputLbs = resolvedBatches
    ? resolvedBatches.reduce((s, b) => s + b.batchLbs, 0)
    : isTumble && cookPlan
      ? cookPlan.cookBatches.reduce((s, b) => s + b.lbs, 0)
      : form.output_qty_lbs || stage?.input_qty_lbs || 0;

  const canComplete = isLinking ? !!cookBatch : (isTumble || isRacking) ? !!cookPlan : isPackaging ? form.case_weights?.length > 0 : true;

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className={`rounded-xl border-2 p-4 space-y-3 ${canComplete ? "border-chart-2/30 bg-chart-2/8" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-5 h-5 ${canComplete ? "text-chart-2" : "text-muted-foreground"}`} />
          <p className={`font-bold text-base ${canComplete ? "text-chart-2" : "text-muted-foreground"}`}>
            {canComplete ? `Ready to complete ${stageLabel}` : `Review required`}
          </p>
        </div>

        <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
          <span className="text-sm text-muted-foreground">Output quantity</span>
          <span className="font-bold text-lg">{outputLbs} lbs</span>
        </div>

        {isLinking && cookBatch && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batch Lot</span>
              <span className="font-mono font-bold">{cookBatch.lotNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Batch Qty</span>
              <span className="font-semibold">{cookBatch.totalQty} lbs</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Linking Batches</span>
              <span className="font-semibold">{cookBatch.selectedStageIds?.length || 1}</span>
            </div>
          </div>
        )}
        {isLinking && !cookBatch && (
          <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> No cook batch assembled — go back to build one.
          </p>
        )}
        {isTumble && cookPlan && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batches</span>
              <span className="font-semibold">{cookPlan.cookBatches.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Racks</span>
              <span className="font-semibold">{cookPlan.cookBatches.reduce((s, b) => s + b.racks, 0)}</span>
            </div>
            <div className="space-y-1 pt-1">
              {cookPlan.cookBatches.map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{b.lotNumber}</span>
                  <div className="flex gap-2 text-muted-foreground">
                    <span>{b.racks} racks</span>
                    <span>·</span>
                    <span>{b.lbs} lbs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isTumble && !cookPlan && (
          <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> No cook batches configured — go back to build them.
          </p>
        )}
        {isRacking && cookPlan && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batches</span>
              <span className="font-semibold">{cookPlan.cookBatches.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Racks</span>
              <span className="font-semibold">{cookPlan.cookBatches.reduce((s, b) => s + b.racks, 0)}</span>
            </div>
            <div className="space-y-1 pt-1">
              {cookPlan.cookBatches.map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{b.lotNumber}</span>
                  <div className="flex gap-2 text-muted-foreground">
                    <span>{b.racks} racks</span>
                    <span>·</span>
                    <span>{b.lbs} lbs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isRacking && !cookPlan && (
          <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> No cook batches configured — go back to build them.
          </p>
        )}
      </div>

      {/* Batch summary (blending) */}
      {resolvedBatches && resolvedBatches.map(b => (
        <div key={b.batchNumber} className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Batch #{b.batchNumber} — {b.batchLbs} lbs
          </p>
          <div className="rounded-xl border divide-y text-sm overflow-hidden">
            {b.ingredients.map((ing, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ing.bucket_name}</span>
                  <span className="text-muted-foreground text-xs font-medium">
                    {(ing.lot_allocations?.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0) || 0).toFixed(2)} lbs
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

      {/* Measurement summary */}
      {!resolvedBatches && Object.keys(form).length > 0 && (
        <div className="rounded-xl border divide-y text-sm overflow-hidden">
          {Object.entries(form).filter(([, v]) => v !== "" && v !== null && v !== undefined).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-semibold">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          className="flex-1 gap-2 h-12 text-base font-bold bg-chart-2 hover:bg-chart-2/90"
          onClick={onComplete}
          disabled={saving || !canComplete}
        >
          <CheckCircle2 className="w-5 h-5" />
          {saving ? "Completing…" : `Complete ${stageLabel}`}
        </Button>
      </div>
    </div>
  );
}

function ProgressBar({ current, total, pct, label }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground">
        <span>{label} {current} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-chart-1 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled, nextLabel }) {
  return (
    <div className="flex gap-3 pt-1">
      <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack}>
        <ChevronLeft className="w-4 h-4" /> Back
      </Button>
      <Button className="flex-1 gap-2 h-11 font-semibold" disabled={nextDisabled} onClick={onNext}>
        {nextLabel} <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}