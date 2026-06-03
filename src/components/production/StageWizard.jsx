import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Package, Thermometer, Layers, FlaskConical } from "lucide-react";
import { IntroStep, BatchConfirmStep, MeasureStep, FinalStep } from "./StageWizardSteps";

// ─── Stage icon map ───────────────────────────────────────────────────────────
const STAGE_ICONS = {
  blending: Package,
  chopping: FlaskConical,
  linking: Layers,
  racking: Layers,
  racking_product: Layers,
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
function buildMeasurementSteps(stage, product, capKey, casingBuckets = [], rackingFollows = false) {
  const steps = [];

  if (capKey === "chopping") {
    steps.push({
      id: "bowl_prep",
      label: "Bowl Preparation",
      fields: [
        { key: "input_lot_confirmed", label: `Confirm blend lot ${stage?.input_lot_number || "N/A"} added to bowl?`, type: "boolean" },
        { key: "spice_mix", label: "Spice Mix", type: "spice_mix_picker", requiredLbs: product?.chop_spice_qty_lbs || 0, filterSpiceMixId: product?.chop_spice_mix_id },
        { key: "cure_lot_number", label: "Cure Lot #", type: "cure_select" },
        { key: "cure_amount_lbs", label: "Cure Added (lbs)", type: "number" },
        { key: "water_amount_lbs", label: "Water Amount Added (lbs)", type: "number" },
        { key: "output_qty_lbs", label: "Output Qty (lbs)", type: "number" },
        { key: "output_lot_number", label: "Chopping Output Lot #", type: "text", placeholder: "e.g. CHOP-2024-001" },
        { key: "notes", label: "Notes / Observations", type: "textarea" },
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
      ],
    });
    // Cook batch assembly is handled via the separate cook_batch state, not a field step
  }

  if (capKey === "tumble" || capKey === "tumbling") {
    const spiceQty = stage?.spice_mix_qty_lbs || product?.tumble_spice_qty_lbs || 0;
    // When racking follows tumbling, tumbling is a simple seasoning step (racking controls
    // cook batch splitting). Otherwise the TumbleCookBatchBuilder handles output/lot/racks.
    const fields = [
      { key: "spice_mix", label: "Spice Mix Added", type: "spice_mix_picker", requiredLbs: spiceQty, filterSpiceMixId: product?.chop_spice_mix_id },
      { key: "duration_minutes", label: "Tumble Duration (minutes)", type: "number" },
    ];
    if (rackingFollows) {
      const tumbleLotDefault = `TUMBLE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
      fields.push(
        { key: "output_qty_lbs", label: "Output Qty (lbs) — auto-calculated", type: "number", defaultValue: stage?.input_qty_lbs, disabled: true },
        { key: "output_lot_number", label: "Tumbled Lot # (auto-assigned, editable)", type: "text", placeholder: "e.g. TUMBLE-2024-001", defaultValue: tumbleLotDefault },
      );
    }
    fields.push({ key: "notes", label: "Notes / Observations", type: "textarea" });
    // When racking follows, tumbling is a simple seasoning step — the cook batch
    // assembly (TumbleCookBatchBuilder) belongs to the racking stage, not here.
    steps.push({ id: "tumble", label: "Tumbling", fields, simpleTumble: rackingFollows });
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
        { key: "notes", label: "Notes / Observations", type: "textarea" },
      ],
    });
    steps.push({
      id: "mixer",
      label: "Mixing",
      fields: [
        { key: "duration_minutes", label: "Mix Duration (minutes)", type: "number" },
        { key: "output_qty_lbs", label: "Combined Output Qty (lbs)", type: "number" },
        { key: "output_lot_number", label: "Linker Batch Lot #", type: "text", placeholder: "e.g. MIX-2024-001" },
      ],
    });
  }

  if (capKey === "racking" || capKey === "racking_product") {
    // Output qty + lot are driven entirely by the cook batch builder below — no manual
    // fields here (each cook batch carries its own lot/qty/rack count to cooking).
    steps.push({
      id: "racking",
      label: "Racking",
      fields: [
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
          { key: "temperature_f", label: "Cook End Temperature (°F)", type: "number" },
          { key: "duration_minutes", label: "Cook Time (minutes)", type: "number" },
          { key: "racks_count", label: "Rack Count", type: "number", defaultValue: racksCount, disabled: true },
          { key: "output_lot_number", label: "Cooked Lot #", type: "text", placeholder: "e.g. COOK-2024-001", defaultValue: cookLotDefault },
          { key: "notes", label: "Notes / Observations", type: "textarea" },
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
        { key: "notes", label: "Notes / Observations", type: "textarea" },
      ],
    });
  }

  if (capKey === "packaging") {
      // For sous vide flows, gaylords are already tracked at the packing stage.
      // The packaging stage asks for case count and allows splitting remainder.
      const caseWeightLbs = product?.case_weight_lbs || 1;
      const totalOutputLbs = stage?.input_qty_lbs || 0;
      const maxFullCases = caseWeightLbs > 0 ? Math.floor(totalOutputLbs / caseWeightLbs) : 0;
      const remainderLbs = totalOutputLbs - (maxFullCases * caseWeightLbs);

      steps.push({
        id: "packaging",
        label: "Packaging Confirmation",
        fields: [
          { key: "output_qty_lbs", label: "Total Output Weight (lbs)", type: "number", defaultValue: stage?.input_qty_lbs, disabled: true },
          { key: "packages_produced", label: "Cases to Package (Finished Product)", type: "number", defaultValue: maxFullCases, hint: `Max: ${maxFullCases} full cases (${remainderLbs.toFixed(2)} lbs remainder)` },
          { key: "lot_number", label: "Finished Goods Lot #", type: "text", defaultValue: stage?.input_lot_number || "" },
          { key: "finished_product_splits", label: "Split Remainder into Other Product (optional)", type: "finished_product_split" },
          { key: "notes", label: "Notes / Observations", type: "textarea" },
        ],
      });
    }

  // Generic fallback for any capability not explicitly handled above
  const knownKeys = ["chopping", "linking", "cooking", "chilling", "packaging", "racking", "racking_product", "tumble", "tumbling", "mixer"];
  if (!knownKeys.includes(capKey)) {
    steps.push({
      id: "generic",
      label: "Stage Details",
      fields: [
        { key: "output_qty_lbs", label: "Output Qty (lbs)", type: "number" },
        { key: "output_lot_number", label: "Output Lot #", type: "text", placeholder: "e.g. STAGE-2024-001" },
      ],
    });
  }



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

  // For tumble stages: detect whether a racking step immediately follows (so tumbling
  // becomes a simple seasoning step and racking controls cook-batch splitting).
  const { data: wizardFlow = null } = useQuery({
    queryKey: ["wizardFlow", stage?.order_id],
    queryFn: async () => {
      const orders = await base44.entities.ProductionOrder.filter({ id: stage.order_id });
      const order = orders[0];
      if (!order?.flow_id) return null;
      const flows = await base44.entities.ProductFlow.filter({ id: order.flow_id });
      return flows[0] || null;
    },
    enabled: open && !!stage && (capKey === "tumble" || capKey === "tumbling"),
  });
  const rackingFollows = (() => {
    if (!wizardFlow?.steps) return false;
    const sorted = [...wizardFlow.steps].sort((a, b) => a.step_number - b.step_number);
    const next = sorted.find(s => s.step_number > stage.step_number);
    return next?.capability_key === "racking" || next?.capability_key === "racking_product";
  })();

  const { data: cureBucket = null } = useQuery({
    queryKey: ["cureBucket", product?.cure_bucket_id],
    queryFn: async () => {
      if (!product?.cure_bucket_id) return null;
      const buckets = await base44.entities.InventoryBucket.filter({ id: product.cure_bucket_id });
      return buckets[0] || null;
    },
    enabled: open && capKey === "chopping" && !!product?.cure_bucket_id,
  });

  const { data: cureInventory = [] } = useQuery({
    queryKey: ["cureInventory", cureBucket?.id],
    queryFn: () => base44.entities.RawInventory.filter({ bucket_id: cureBucket?.id }),
    staleTime: 0,
    gcTime: 0,
    enabled: open && capKey === "chopping" && !!cureBucket?.id,
  });

  // For packaging: fetch compatible hot dog products (same family) PLUS the original product
   const { data: compatibleHotdogProducts = [] } = useQuery({
     queryKey: ["compatibleHotdogs", product?.id],
     queryFn: async () => {
       if (!product?.is_hotdog || !product?.hotdog_family) return [];
       const allProducts = await base44.entities.Product.filter({ is_hotdog: true });
       return allProducts.filter(p =>
         p.is_hotdog &&
         p.hotdog_family === product.hotdog_family
       );
     },
     enabled: !!(open && capKey === "packaging" && product?.is_hotdog),
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
    ? buildMeasurementSteps(stage, product, capKey, casingBuckets, rackingFollows)
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
     const today_str = new Date().toISOString().slice(0, 10);

     try {
      if (usesIngredientBatches && currentBatch) {
        // For blending: complete one batch at a time w/ lot traceability
        const batchLbs = currentBatch.batchLbs;
        const blendOutputLot = form.output_lot_number || `BLEND-${Date.now()}`;
        const subBatch = {
          sub_batch_id: `blend-${currentBatch.batchNumber}-${Date.now()}`,
          label: `Blend Batch #${currentBatch.batchNumber}`,
          qty_lbs: batchLbs,
          lot_number: blendOutputLot,
          ingredients: currentBatch.ingredients.map(ing => ({
            bucket_name: ing.bucket_name,
            lot_allocations: ing.lot_allocations,
            lot_number: ing.lot_allocations?.length === 1 ? ing.lot_allocations[0].lot_number : (ing.lot_allocations?.map(a => a.lot_number).join(", ") || ""),
            actual_lbs: ing.lot_allocations?.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0) || 0,
          })),
          status: "completed",
        };

        // Update stage with this completed batch
        const updatedSubBatches = [...(stage.sub_batches || []), subBatch];

        await base44.entities.ProductionStage.update(stage.id, {
          sub_batches: updatedSubBatches,
          status: "in_progress",
          output_lot_number: blendOutputLot,
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
          const nextFlow = await base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);

          // Detect if this is a kielbasa-style flow with a mixer step
          const hasMixerStep = nextFlow?.steps?.some(s => s.capability_key === "mixer");

          // Separate pork and beef ingredients from this batch
          // Pork detection: name contains "pork", or category is "pork"
          const isPorkIngredient = (ing) =>
            ing.bucket_name?.toLowerCase().includes("pork") ||
            ing.category?.toLowerCase() === "pork";
          const porkIngredients = currentBatch.ingredients.filter(isPorkIngredient);
          const beefIngredients = currentBatch.ingredients.filter(ing => !isPorkIngredient(ing));

          const porkLbs = porkIngredients.reduce((s, ing) =>
            s + (ing.lot_allocations?.reduce((ss, a) => ss + (Number(a.actual_lbs) || 0), 0) || ing.required_lbs || 0), 0
          );
          const beefLbs = currentBatch.batchLbs - porkLbs;

          const porkLotNumber = porkIngredients[0]?.lot_allocations?.[0]?.lot_number || `${blendOutputLot}-PORK`;

          if (hasMixerStep) {
            // ── Kielbasa flow: route beef to chopping, pork to mixer ──
            // Use a stable per-batch tag so chopping completion can find its paired mixer
            const batchTag = `blend-batch-${currentBatch.batchNumber}`;
            const mixerStep = nextFlow?.steps?.find(s => s.capability_key === "mixer");
            const choppingStep = nextFlow?.steps?.find(s => s.capability_key === "chopping");

            const beefLotNumber = `${blendOutputLot}-BEEF`;

            // Create independent chopping stage for this batch's beef
            if (choppingStep && beefLbs > 0) {
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
                input_lot_number: beefLotNumber,
                // Tag so chopping completion can find this batch's paired mixer
                batch_tag: batchTag,
              });
            }

            // Create independent mixer stage for this batch's pork (locked until binder arrives)
            if (mixerStep && porkLbs > 0) {
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
                status: "locked",
                pork_lot_number: porkLotNumber,
                input_qty_lbs: parseFloat(porkLbs.toFixed(2)),
                input_lot_number: porkLotNumber,
                // Tag so chopping can find this exact mixer when unlocking it
                batch_tag: batchTag,
              });
            }

            // Create the linking stage for this batch (locked — unlocked by mixer output).
            // input_qty_lbs is set to 0 here; the mixer completion fills in the real combined qty.
            // If there is no mixer for this batch (all-beef, no pork), the linking stage is
            // unlocked directly with the beef qty so the flow doesn't stall.
            const linkingStep = nextFlow?.steps?.find(s => s.capability_key === "linking");
            if (linkingStep) {
              const hasMixer = porkLbs > 0;
              await base44.entities.ProductionStage.create({
                order_id: stage.order_id,
                order_number: stage.order_number,
                product_name: stage.product_name,
                step_number: linkingStep.step_number,
                capability_id: linkingStep.capability_id,
                capability_key: linkingStep.capability_key,
                capability_name: linkingStep.capability_name,
                work_profile_id: linkingStep.work_profile_id || "",
                work_profile_name: linkingStep.work_profile_name || "",
                status: hasMixer ? "locked" : "available", // unlocked by mixer, or immediately if no mixer
                input_qty_lbs: hasMixer ? 0 : parseFloat(beefLbs.toFixed(2)),
                input_lot_number: hasMixer ? "" : beefLotNumber, // replaced by mixer output lot when mixer runs
                // Tag so mixer completion can find this stage to update
                batch_tag: batchTag,
              });
            }
          } else {
            // ── Standard flow: create independent stage per batch ──
            const sortedFlowSteps = [...(nextFlow?.steps || [])].sort((a, b) => a.step_number - b.step_number);
            const nextStep = sortedFlowSteps.find(s => s.step_number > stage.step_number);
            if (nextStep) {
              await base44.entities.ProductionStage.create({
                order_id: stage.order_id,
                order_number: stage.order_number,
                product_name: stage.product_name,
                step_number: nextStep.step_number,
                capability_id: nextStep.capability_id,
                capability_key: nextStep.capability_key,
                capability_name: nextStep.capability_name,
                work_profile_id: nextStep.work_profile_id || "",
                work_profile_name: nextStep.work_profile_name || "",
                status: "available",
                input_qty_lbs: currentBatch.batchLbs,
                input_lot_number: blendOutputLot,
              });
            }
          }
        }

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["allStages"] });
        queryClient.invalidateQueries({ queryKey: ["orderStages", stage.order_id] });
        queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
        queryClient.invalidateQueries({ queryKey: ["blendingStages"] });

        // Only close wizard after final batch completion
        if (isLastBatch) {
          // Mark the blending stage itself as completed
          await base44.entities.ProductionStage.update(stage.id, {
            status: "completed",
            completed_at: new Date().toISOString(),
          });
          onCompleted?.();
          onClose();
        } else {
          // Advance to the next batch step
          setStep(s => s + 1);
        }
      } else if ((capKey === "tumble" || capKey === "tumbling") && rackingFollows) {
        // ── Tumble (seasoning only): racking controls cook batches. Create ONE racking stage ──
        const tumbledQty = form.output_qty_lbs || stage.input_qty_lbs || 0;
        const tumbledLot = form.output_lot_number || `TUMBLE-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`;
        await base44.entities.ProductionStage.update(stage.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          output_qty_lbs: tumbledQty,
          output_lot_number: tumbledLot,
          spice_mix_id: form.spice_mix_id || "",
          spice_mix_name: form.spice_mix_name || "",
          spice_mix_lot_number: form.spice_mix_lot_number || "",
          spice_mix_qty_lbs: form.spice_mix_qty_lbs || 0,
          duration_minutes: form.duration_minutes || null,
        });

        // Deduct spice FIFO if allocated
        if (form.spice_mix?.lots?.length) {
          base44.functions.invoke("deductRawInventoryOnBatchComplete", {
            stage_id: stage.id,
            ingredients: [{
              bucket_name: "Spice",
              actual_lbs: form.spice_mix_qty_lbs || 0,
              lot_allocations: form.spice_mix.lots,
            }],
          }).catch(err => console.warn("Inventory deduction failed:", err));
        }

        // Create / unlock the racking stage with the full tumbled quantity
        const sorted = [...(wizardFlow?.steps || [])].sort((a, b) => a.step_number - b.step_number);
        const rackingStep = sorted.find(s => s.step_number > stage.step_number);
        if (rackingStep) {
          const existing = await base44.entities.ProductionStage.filter({
            order_id: stage.order_id,
            capability_key: rackingStep.capability_key,
          });
          const lockedNext = existing.find(s => s.status === "locked");
          if (lockedNext) {
            await base44.entities.ProductionStage.update(lockedNext.id, {
              status: "available",
              input_qty_lbs: tumbledQty,
              input_lot_number: tumbledLot,
            });
          } else {
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
              input_qty_lbs: tumbledQty,
              input_lot_number: tumbledLot,
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: ["allStages"] });
        queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
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
          const linkingStep = nextFlow?.steps?.find(s => s.capability_key === "linking");
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
                input_lot_number: cookBatch.lotNumber,
                cook_batch_lot: cookBatch.lotNumber,
                // Carry rack count from the linking step config (racks_per_batch)
                racks_count: linkingStep?.racks_per_batch || 0,
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
        const today = new Date();
        const today_str = today.toISOString().slice(0, 10);
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

        // For chilling: calculate and store expiry_date on the stage so packaging can carry it forward
        if (capKey === "chilling") {
          const chillOrder = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
          if (chillOrder?.product_id) {
            const chillProduct = await base44.entities.Product.filter({ id: chillOrder.product_id }).then(r => r?.[0]);
            if (chillProduct?.shelf_life_days) {
              updates.expiry_date = new Date(today.getTime() + chillProduct.shelf_life_days * 86400000).toISOString().slice(0, 10);
            }
          }
        }

        await base44.entities.ProductionStage.update(stage.id, updates);

        // If this is packaging: push into the FG bucket AND create an InventoryItem lot
         if (capKey === "packaging") {
            const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
            if (order) {
              // today and today_str already defined above
              const datePart = today_str.replace(/-/g, "");
              const rand = Math.floor(Math.random() * 900 + 100);
              const baseFgLot = updates.lot_number || `FG-${datePart}-${(order.order_number || "").replace(/\D/g, "").slice(-4)}-${rand}`;

              const totalOutputLbs = updates.output_qty_lbs || stage.input_qty_lbs || 0;
              const packagesProduced = updates.packages_produced || 0;

              // Check if splits are defined (hot dog multi-product flow)
              const splits = form.finished_product_splits && form.finished_product_splits.length > 0 ? form.finished_product_splits : null;

              // Try to carry expiry date from the chilling stage that produced this packaging stage
              let expiryDate = null;
              if (stage.cook_batch_lot) {
                const allOrderStages = await base44.entities.ProductionStage.filter({ order_id: stage.order_id });
                const chillingStage = allOrderStages.find(
                  s => s.capability_key === "chilling" && s.cook_batch_lot === stage.cook_batch_lot && s.status === "completed"
                );
                expiryDate = chillingStage?.expiry_date || null;
              }

              // Helper function to distribute lots across products
              const distributeToProducts = async (splitConfigs) => {
                for (const splitConfig of splitConfigs) {
                  const targetProductId = splitConfig.product_id;
                  const productData = await base44.entities.Product.filter({ id: targetProductId }).then(r => r?.[0]);
                  const caseWeightLbs = productData?.case_weight_lbs || 0;
                  const splitLbs = (Number(splitConfig.quantity_cases) || 0) * caseWeightLbs;

                  if (splitLbs <= 0) continue;

                  const shelfLifeDays = productData?.shelf_life_days || null;

                  // Calculate expiry for this split
                  let splitExpiryDate = expiryDate;
                  if (!splitExpiryDate && shelfLifeDays) {
                    splitExpiryDate = new Date(today.getTime() + shelfLifeDays * 86400000).toISOString().slice(0, 10);
                  }

                  // Calculate cases for this split — use the quantity_cases directly from the split config
                  const casesProduced = Number(splitConfig.quantity_cases) || 0;

                  // Create a unique lot number for each split
                  const splitLotNumber = `${baseFgLot}-${productData?.sku || "SPLIT"}`.slice(0, 50);

                  // 1. Push into FinishedGoodsBucket (find or create)
                  const existingBuckets = await base44.entities.FinishedGoodsBucket.filter({ product_id: targetProductId });
                  const bucket = existingBuckets[0];

                  if (bucket) {
                    const newLots = [...(bucket.lots || []), {
                      lot_number: splitLotNumber,
                      production_date: today_str,
                      expiry_date: splitExpiryDate,
                      quantity_lbs: parseFloat(splitLbs.toFixed(2)),
                      cases: casesProduced,
                      order_number: order.order_number || "",
                      status: "available",
                    }];
                    await base44.entities.FinishedGoodsBucket.update(bucket.id, {
                      quantity_lbs: parseFloat(((bucket.quantity_lbs || 0) + splitLbs).toFixed(2)),
                      cases_on_hand: (bucket.cases_on_hand || 0) + casesProduced,
                      lots: newLots,
                    });
                  } else {
                    // Create bucket on the fly if missing
                    await base44.entities.FinishedGoodsBucket.create({
                      product_id: targetProductId || "",
                      product_name: productData?.name || splitConfig.product_name || "",
                      sku: productData?.sku || "",
                      product_number: productData?.product_number || "",
                      category: productData?.category || "",
                      quantity_lbs: parseFloat(splitLbs.toFixed(2)),
                      cases_on_hand: casesProduced,
                      case_weight_lbs: caseWeightLbs,
                      lots: [{
                        lot_number: splitLotNumber,
                        production_date: today_str,
                        expiry_date: splitExpiryDate,
                        quantity_lbs: parseFloat(splitLbs.toFixed(2)),
                        cases: casesProduced,
                        order_number: order.order_number || "",
                        status: "available",
                      }],
                      status: "active",
                    });
                  }

                  // 2. Also create InventoryItem for lot-level traceability
                  await base44.entities.InventoryItem.create({
                    product_id: targetProductId || "",
                    product_name: productData?.name || splitConfig.product_name || "",
                    sku: productData?.sku || "",
                    batch_id: stage.order_id,
                    batch_number: order.order_number || "",
                    lot_number: splitLotNumber,
                    quantity_lbs: parseFloat(splitLbs.toFixed(2)),
                    original_quantity_lbs: parseFloat(splitLbs.toFixed(2)),
                    status: "available",
                    production_date: today_str,
                    expiry_date: splitExpiryDate,
                    notes: `Split from packaging stage. Cook batch: ${stage.cook_batch_lot || stage.input_lot_number || ""}`,
                  });
                }
              };

              // Always create FG for original product with packages_produced cases
              const targetProductId = order.product_id;
              const productData = await base44.entities.Product.filter({ id: targetProductId }).then(r => r?.[0]);
              const shelfLifeDays = productData?.shelf_life_days || null;
              const caseWeightLbs = productData?.case_weight_lbs || 1;

              if (!expiryDate && shelfLifeDays) {
                expiryDate = new Date(today.getTime() + shelfLifeDays * 86400000).toISOString().slice(0, 10);
              }

              const casesProduced = Number(packagesProduced) || 0;
              const actualOutputLbs = casesProduced * caseWeightLbs;

              // Push original product to FG bucket
              const existingBuckets = await base44.entities.FinishedGoodsBucket.filter({ product_id: targetProductId });
              const bucket = existingBuckets[0];

              if (bucket) {
                const newLots = [...(bucket.lots || []), {
                  lot_number: baseFgLot,
                  production_date: today_str,
                  expiry_date: expiryDate,
                  quantity_lbs: parseFloat(actualOutputLbs.toFixed(2)),
                  cases: casesProduced,
                  order_number: order.order_number || "",
                  status: "available",
                }];
                await base44.entities.FinishedGoodsBucket.update(bucket.id, {
                  quantity_lbs: parseFloat(((bucket.quantity_lbs || 0) + actualOutputLbs).toFixed(2)),
                  cases_on_hand: (bucket.cases_on_hand || 0) + casesProduced,
                  lots: newLots,
                });
              } else {
                await base44.entities.FinishedGoodsBucket.create({
                  product_id: targetProductId || "",
                  product_name: productData?.name || stage.product_name || order.product_name || "",
                  sku: productData?.sku || "",
                  product_number: productData?.product_number || "",
                  category: productData?.category || "",
                  quantity_lbs: parseFloat(actualOutputLbs.toFixed(2)),
                  cases_on_hand: casesProduced,
                  case_weight_lbs: caseWeightLbs,
                  lots: [{
                    lot_number: baseFgLot,
                    production_date: today_str,
                    expiry_date: expiryDate,
                    quantity_lbs: parseFloat(actualOutputLbs.toFixed(2)),
                    cases: casesProduced,
                    order_number: order.order_number || "",
                    status: "available",
                  }],
                  status: "active",
                });
              }

              await base44.entities.InventoryItem.create({
                product_id: targetProductId || "",
                product_name: productData?.name || stage.product_name || order.product_name || "",
                sku: productData?.sku || "",
                batch_id: stage.order_id,
                batch_number: order.order_number || "",
                lot_number: baseFgLot,
                quantity_lbs: parseFloat(actualOutputLbs.toFixed(2)),
                original_quantity_lbs: parseFloat(actualOutputLbs.toFixed(2)),
                status: "available",
                production_date: today_str,
                expiry_date: expiryDate,
                notes: `Created from packaging stage. Cook batch: ${stage.cook_batch_lot || stage.input_lot_number || ""}`,
              });

              // If splits exist, also distribute to split products
              if (splits && splits.length > 0) {
                const parsedSplits = splits.map(s => typeof s === 'string' ? JSON.parse(s) : s);
                await distributeToProducts(parsedSplits);
              }

              queryClient.invalidateQueries({ queryKey: ["inventory"] });
              queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
            }
         }

        // ── Mixer special case: update paired linking stages with mixer output lot ──
        if (capKey === "mixer") {
          const mixerOutputLot = updates.output_lot_number || "";
          const mixerOutputQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
          if (mixerOutputLot) {
            // Find the linking stages for this order that are available/in_progress and not yet
            // assigned to a cook batch — update their input_lot_number to the mixer combined output
            const linkingStages = await base44.entities.ProductionStage.filter({
              order_id: stage.order_id,
              capability_key: "linking",
            });
            // Match by batch tag if available, else fall back to all unassigned linking stages
            const batchTagFromNotes = stage.batch_tag || stage.notes?.match(/blend-batch-\d+/)?.[0] || null;
            // Linking stages are "locked" when created by blending; mixer unlocks them
            const targetLinking = linkingStages.filter(s =>
              (s.status === "locked" || s.status === "available" || s.status === "in_progress") &&
              !s.cook_batch_lot
            );
            const pairedLinking = batchTagFromNotes
              ? targetLinking.filter(s => (s.batch_tag || s.notes || "").includes(batchTagFromNotes))
              : targetLinking;
            // If tag match found, update those; otherwise update all unassigned (single-batch flow)
            const stagesToUpdate = pairedLinking.length > 0 ? pairedLinking : targetLinking;
            for (const ls of stagesToUpdate) {
              await base44.entities.ProductionStage.update(ls.id, {
                status: "available",
                input_lot_number: mixerOutputLot,
                input_qty_lbs: parseFloat(mixerOutputQty.toFixed ? mixerOutputQty.toFixed(2) : mixerOutputQty),
              });
            }
          }
        }

        // Unlock next stage and pass lot traceability (or create it if it doesn't exist)
        const allStages = await base44.entities.ProductionStage.filter({ order_id: stage.order_id });
        let nextStage = allStages.find(s => s.step_number === stage.step_number + 1 && s.status !== "completed" && s.id !== stage.id);
        
        // For chilling, create a packaging stage if one doesn't exist for this cook batch
        if (capKey === "chilling") {
          const chillOrder = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
          if (chillOrder?.flow_id) {
            const chillFlow = await base44.entities.ProductFlow.filter({ id: chillOrder.flow_id }).then(r => r?.[0]);
            // Find packaging step by capability_key, not step_number (robust across multi-batch flows)
            const packFlowStep = chillFlow?.steps?.find(s => s.capability_key === "packaging");
            if (packFlowStep) {
              const cooledQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
              const cooledLot = updates.output_lot_number || stage.input_lot_number || "";
              const cookBatchLotKey = stage.cook_batch_lot || cooledLot;
              // Only create if no packaging stage for this cook batch already exists (completed or not)
              const existingPackStages = await base44.entities.ProductionStage.filter({
                order_id: stage.order_id,
                capability_key: "packaging",
                cook_batch_lot: cookBatchLotKey,
              });
              if (existingPackStages.length === 0) {
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
                  input_qty_lbs: cooledQty,
                  input_lot_number: cooledLot,
                  cook_batch_lot: cookBatchLotKey,
                });
              }
            }
          }
        }

        // For cooking stage, create chilling stages
         // Detect flow type by checking if stage's cook_batch_lot suggests multi-batch
         if (capKey === "cooking") {
           const cookOrder = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
           if (cookOrder?.flow_id) {
             const cookFlow = await base44.entities.ProductFlow.filter({ id: cookOrder.flow_id }).then(r => r?.[0]);
             const chillFlowStep = cookFlow?.steps?.find(s => s.capability_key === "chilling");
             if (chillFlowStep) {
               // Detect multi-batch: if cookPlan exists OR if stage.cook_batch_lot matches CB* pattern
               const isMultiBatch = cookPlan?.cookBatches?.length > 0 || /^CB\d+/.test(stage.cook_batch_lot || "");

               if (isMultiBatch && cookPlan?.cookBatches?.length > 0) {
                 // Multi-batch with active cookPlan: save sub_batches and create per-batch chilling
                 const cookedSubBatches = cookPlan.cookBatches.map((batch) => ({
                   sub_batch_id: `cooked-batch-${batch.cookBatchNumber}-${Date.now()}`,
                   label: `Cook Batch #${batch.cookBatchNumber}`,
                   qty_lbs: parseFloat(batch.lbs.toFixed(2)),
                   status: "completed",
                   cook_batch_number: batch.cookBatchNumber,
                 }));
                 await base44.entities.ProductionStage.update(stage.id, {
                   sub_batches: cookedSubBatches,
                 });
                 for (const batch of cookPlan.cookBatches) {
                   const batchQty = parseFloat(batch.lbs.toFixed(2));
                   const lotNum = `CB${batch.cookBatchNumber}-${stage.order_number}-${today_str}`;
                   const existingChillStages = await base44.entities.ProductionStage.filter({
                     order_id: stage.order_id,
                     capability_key: "chilling",
                     cook_batch_lot: lotNum,
                   });
                   if (existingChillStages.length === 0) {
                     await base44.entities.ProductionStage.create({
                       order_id: stage.order_id,
                       order_number: stage.order_number,
                       product_name: stage.product_name,
                       step_number: chillFlowStep.step_number,
                       capability_id: chillFlowStep.capability_id,
                       capability_key: chillFlowStep.capability_key,
                       capability_name: chillFlowStep.capability_name,
                       work_profile_id: chillFlowStep.work_profile_id || "",
                       work_profile_name: chillFlowStep.work_profile_name || "",
                       status: "available",
                       input_qty_lbs: batchQty,
                       input_lot_number: lotNum,
                       cook_batch_lot: lotNum,
                     });
                   }
                 }
               } else if (isMultiBatch && /^CB\d+/.test(stage.cook_batch_lot)) {
                 // Multi-batch detected from existing stage.cook_batch_lot (cooking opened later, no cookPlan)
                 const outputQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
                 const existingChillStages = await base44.entities.ProductionStage.filter({
                   order_id: stage.order_id,
                   capability_key: "chilling",
                   cook_batch_lot: stage.cook_batch_lot,
                 });
                 if (existingChillStages.length === 0) {
                   await base44.entities.ProductionStage.create({
                     order_id: stage.order_id,
                     order_number: stage.order_number,
                     product_name: stage.product_name,
                     step_number: chillFlowStep.step_number,
                     capability_id: chillFlowStep.capability_id,
                     capability_key: chillFlowStep.capability_key,
                     capability_name: chillFlowStep.capability_name,
                     work_profile_id: chillFlowStep.work_profile_id || "",
                     work_profile_name: chillFlowStep.work_profile_name || "",
                     status: "available",
                     input_qty_lbs: parseFloat(outputQty.toFixed ? outputQty.toFixed(2) : outputQty),
                     input_lot_number: stage.cook_batch_lot,
                     cook_batch_lot: stage.cook_batch_lot,
                   });
                 }
               } else {
                 // Single-batch flow (sous vide or single cooking): create one chilling stage
                 const outputQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
                 const cookOutputLot = updates.output_lot_number || stage.input_lot_number || `COOK-${stage.order_number}-${today_str}`;
                 const cookBatchKey = stage.cook_batch_lot || cookOutputLot;
                 const existingChillStages = await base44.entities.ProductionStage.filter({
                   order_id: stage.order_id,
                   capability_key: "chilling",
                   cook_batch_lot: cookBatchKey,
                 });
                 if (existingChillStages.length === 0) {
                   await base44.entities.ProductionStage.create({
                     order_id: stage.order_id,
                     order_number: stage.order_number,
                     product_name: stage.product_name,
                     step_number: chillFlowStep.step_number,
                     capability_id: chillFlowStep.capability_id,
                     capability_key: chillFlowStep.capability_key,
                     capability_name: chillFlowStep.capability_name,
                     work_profile_id: chillFlowStep.work_profile_id || "",
                     work_profile_name: chillFlowStep.work_profile_name || "",
                     status: "available",
                     input_qty_lbs: parseFloat(outputQty.toFixed ? outputQty.toFixed(2) : outputQty),
                     input_lot_number: cookOutputLot,
                     cook_batch_lot: cookBatchKey,
                   });
                 }
               }
             }
           }
         }

        // For mixer: linking stages are already updated above — skip generic next-stage unlock
        // For chopping: create independent linking stage instead of updating one
        if (capKey === "mixer") {
          // Already handled above — no further stage routing needed
        } else if (capKey === "chopping") {
          const choppingOrder = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
          if (choppingOrder?.flow_id) {
            const choppingFlow = await base44.entities.ProductFlow.filter({ id: choppingOrder.flow_id }).then(r => r?.[0]);
            const chopOutputQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
            const chopOutputLot = updates.output_lot_number || stage.input_lot_number || "";

            // Kielbasa flow: chopping output goes to the mixer as binder
            const mixerFlowStep = choppingFlow?.steps?.find(s => s.capability_key === "mixer");
            if (mixerFlowStep) {
              // Find the exact locked mixer stage paired with THIS chopping batch via batch tag
              const existingMixerStages = await base44.entities.ProductionStage.filter({
                order_id: stage.order_id,
                capability_key: "mixer",
              });
              const batchTagFromNotes = stage.batch_tag || stage.notes?.match(/blend-batch-\d+/)?.[0] || null;
              const lockedMixerStage = batchTagFromNotes
                ? existingMixerStages.find(s => s.status === "locked" && (s.batch_tag || s.notes || "").includes(batchTagFromNotes))
                : existingMixerStages.find(s => s.status === "locked");
              if (lockedMixerStage) {
                await base44.entities.ProductionStage.update(lockedMixerStage.id, {
                  binder_lot_number: chopOutputLot,
                  binder_qty_lbs: chopOutputQty,
                  status: "available",
                });
              }
            } else {
              // Standard non-kielbasa chopping: create the next stage (e.g. linking directly)
              const sortedSteps = [...(choppingFlow?.steps || [])].sort((a, b) => a.step_number - b.step_number);
              const nextStep = sortedSteps.find(s => s.step_number > stage.step_number);
              if (nextStep) {
                await base44.entities.ProductionStage.create({
                  order_id: stage.order_id,
                  order_number: stage.order_number,
                  product_name: stage.product_name,
                  step_number: nextStep.step_number,
                  capability_id: nextStep.capability_id,
                  capability_key: nextStep.capability_key,
                  capability_name: nextStep.capability_name,
                  work_profile_id: nextStep.work_profile_id || "",
                  work_profile_name: nextStep.work_profile_name || "",
                  status: "available",
                  input_qty_lbs: chopOutputQty,
                  input_lot_number: chopOutputLot,
                });
              }
            }
          }
        } else if ((capKey === "racking" || capKey === "racking_product") && cookPlan?.cookBatches?.length) {
          // Racking → Cooking: create one cooking stage per cook batch (320 lbs/rack, 3 racks/batch).
          // Each cook batch carries its own lot + rack count all the way to cooking.
          const rackOrder = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
          const rackFlow = rackOrder?.flow_id
            ? await base44.entities.ProductFlow.filter({ id: rackOrder.flow_id }).then(r => r?.[0])
            : null;
          const cookStep = rackFlow?.steps?.find(s => s.capability_key === "cooking");
          if (cookStep) {
            const existingCook = await base44.entities.ProductionStage.filter({
              order_id: stage.order_id,
              capability_key: "cooking",
            });
            for (const cb of cookPlan.cookBatches) {
              if (existingCook.some(s => s.cook_batch_lot === cb.lotNumber)) continue;
              await base44.entities.ProductionStage.create({
                order_id: stage.order_id,
                order_number: stage.order_number,
                product_name: stage.product_name,
                step_number: cookStep.step_number,
                capability_id: cookStep.capability_id,
                capability_key: cookStep.capability_key,
                capability_name: cookStep.capability_name,
                work_profile_id: cookStep.work_profile_id || "",
                work_profile_name: cookStep.work_profile_name || "",
                status: "available",
                input_qty_lbs: cb.lbs,
                input_lot_number: cb.lotNumber,
                cook_batch_lot: cb.lotNumber,
                racks_count: cb.racks,
              });
            }
          }
        } else if (nextStage?.status === "locked") {
          // For other stages: update existing locked stage
          const rawQty = updates.output_qty_lbs || stage.input_qty_lbs || 0;
          const productYield = product?.yield_percent;
          if (!productYield) console.warn(`Product missing yield_percent; using default 85%`);
          const yieldFraction = (productYield ?? 85) / 100;
          const nextInputQty = capKey === "cooking" ? parseFloat((rawQty * yieldFraction).toFixed(2)) : rawQty;
          
          let nextInputLot = "";
          if (capKey === "packaging") {
            nextInputLot = updates.lot_number || "";
          } else if (capKey === "cooking" || capKey === "chilling" || capKey === "racking") {
            nextInputLot = updates.output_lot_number || stage.cook_batch_lot || stage.input_lot_number || "";
          } else {
            nextInputLot = stage.cook_batch_lot || stage.input_lot_number || "";
          }

          await base44.entities.ProductionStage.update(nextStage.id, {
            status: "available",
            input_qty_lbs: nextInputQty,
            input_lot_number: nextInputLot,
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
             cureInventory={cureInventory}
             compatibleHotdogProducts={compatibleHotdogProducts}
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
             autoCalculatedCases={capKey === "packaging" ? Math.floor((stage?.input_qty_lbs || 0) / (product?.case_weight_lbs || 1)) : 0}
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

// Sub-components moved to ./StageWizardSteps.jsx