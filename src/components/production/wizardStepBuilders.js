import { fullChopBatchLbs } from "@/lib/blendBatchMath";

// ─── Build ingredient batches (blending) with multiple batches ────────────────
export function buildIngredientBatchesMultiple(stage, product, capKey, numBatches) {
  if (capKey !== "blending") return [];

  const totalLbs = stage.input_qty_lbs || 0;
  // Full chop-batch weight — shared helper so the wizard's batch count and per-batch
  // weights always match the order form and blending dashboard.
  const batchSize = fullChopBatchLbs(product);
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
export function buildMeasurementSteps(stage, product, capKey, casingBuckets = [], usesStandardLots = false) {
  const steps = [];
  // When standardized lots are on, every stage's output lot is auto-generated and locked
  // at completion — so the operator-typed lot fields are hidden from the wizard entirely.
  const hideLotField = usesStandardLots;

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
        ...(hideLotField ? [] : [{ key: "output_lot_number", label: "Chopping Output Lot #", type: "text", placeholder: "e.g. CHOP-2024-001" }]),
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

  // Tumbling is handled entirely by the dedicated TumbleWizard component.

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
        ...(hideLotField ? [] : [{ key: "output_lot_number", label: "Linker Batch Lot #", type: "text", placeholder: "e.g. MIX-2024-001" }]),
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
      // Racks are now selected from released racks in the SmokehouseCookBatchBuilder.
      steps.push({
        id: "cook",
        label: "Cook Parameters",
        fields: [
          { key: "temperature_f", label: "Cook End Temperature (°F)", type: "number" },
          { key: "duration_minutes", label: "Cook Time (minutes)", type: "number" },
          ...(hideLotField ? [] : [{ key: "output_lot_number", label: "Cooked Lot #", type: "text", placeholder: "e.g. COOK-2024-001", defaultValue: cookLotDefault }]),
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
        { key: "temperature_f", label: "Exit Temp (°F)", type: "number" },
        { key: "duration_minutes", label: "Chill Duration (minutes)", type: "number" },
        ...(hideLotField ? [] : [{ key: "output_lot_number", label: "Chilled Lot #", type: "text", placeholder: "e.g. CHILL-2024-001", defaultValue: chillLotDefault }]),
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
          ...(hideLotField ? [] : [{ key: "lot_number", label: "Finished Goods Lot #", type: "text", defaultValue: stage?.input_lot_number || "" }]),
          { key: "finished_product_splits", label: "Package Remainder as Other Product (same category)", type: "finished_product_split" },
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