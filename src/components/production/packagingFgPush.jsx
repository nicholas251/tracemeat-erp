import { base44 } from "@/api/base44Client";

// ── Packaging → Finished Goods push ──────────────────────────────────────────
// Extracted from StageWizard.handleComplete to keep that file editable. Pushes the
// packaged output into FinishedGoodsBucket + InventoryItem records, including any
// "package remainder as other product" splits. Behavior is unchanged from the
// original inline implementation.
export async function pushPackagingToFinishedGoods({ stage, updates, form, queryClient }) {
  const today = new Date();
  const today_str = today.toISOString().slice(0, 10);

  const order = await base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]);
  if (!order) return;

  const datePart = today_str.replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900 + 100);
  const baseFgLot = updates.lot_number || `FG-${datePart}-${(order.order_number || "").replace(/\D/g, "").slice(-4)}-${rand}`;

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

  // Helper function to distribute lots across products.
  // IMPORTANT: multiple splits can target the SAME product. We must not re-read the
  // FinishedGoodsBucket fresh on each iteration (a stale read would make the 2nd split
  // overwrite the 1st). Instead we cache each bucket the first time we touch it and keep
  // mutating that cached copy, persisting the accumulated result.
  const distributeToProducts = async (splitConfigs) => {
    const bucketCache = {}; // product_id -> { record, isNew }
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

      // 1. Push into FinishedGoodsBucket (find or create) — use the cache so repeated
      //    splits for the same product accumulate instead of overwriting each other.
      const lotEntry = {
        lot_number: splitLotNumber,
        production_date: today_str,
        expiry_date: splitExpiryDate,
        quantity_lbs: parseFloat(splitLbs.toFixed(2)),
        cases: casesProduced,
        order_number: order.order_number || "",
        status: "available",
      };

      if (!bucketCache[targetProductId]) {
        const existingBuckets = await base44.entities.FinishedGoodsBucket.filter({ product_id: targetProductId });
        bucketCache[targetProductId] = existingBuckets[0]
          ? { record: { ...existingBuckets[0], lots: [...(existingBuckets[0].lots || [])] }, isNew: false }
          : {
              record: {
                product_id: targetProductId || "",
                product_name: productData?.name || splitConfig.product_name || "",
                sku: productData?.sku || "",
                product_number: productData?.product_number || "",
                category: productData?.category || "",
                quantity_lbs: 0,
                cases_on_hand: 0,
                case_weight_lbs: caseWeightLbs,
                lots: [],
                status: "active",
              },
              isNew: true,
            };
      }

      const cached = bucketCache[targetProductId];
      cached.record.quantity_lbs = parseFloat(((cached.record.quantity_lbs || 0) + splitLbs).toFixed(2));
      cached.record.cases_on_hand = (cached.record.cases_on_hand || 0) + casesProduced;
      cached.record.lots = [...(cached.record.lots || []), lotEntry];

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

    // Persist all accumulated bucket changes once per product (create or update).
    for (const { record, isNew } of Object.values(bucketCache)) {
      if (isNew) {
        await base44.entities.FinishedGoodsBucket.create(record);
      } else {
        await base44.entities.FinishedGoodsBucket.update(record.id, {
          quantity_lbs: record.quantity_lbs,
          cases_on_hand: record.cases_on_hand,
          lots: record.lots,
        });
      }
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

  // ── Unfinished case carry-over ──────────────────────────────────────────────
  // If the operator parked a leftover remainder, create an OPEN UnfinishedCase record
  // carrying its lot contributions + the original run's expiry (preserved when added back).
  if (form.unfinished_allocated && (form.unfinished_remainder_lbs || 0) > 0.001) {
    await base44.entities.UnfinishedCase.create({
      product_id: targetProductId || "",
      product_name: productData?.name || stage.product_name || order.product_name || "",
      sku: productData?.sku || "",
      category: productData?.category || "",
      lbs: parseFloat((form.unfinished_remainder_lbs || 0).toFixed(2)),
      lot_contributions: (form.unfinished_remainder_lots || []).filter(c => (c.lbs || 0) > 0),
      source_order_id: stage.order_id,
      source_order_number: order.order_number || "",
      source_stage_id: stage.id,
      production_date: today_str,
      expiry_date: expiryDate,
      status: "open",
    });
  }

  // ── Consume carry-overs pulled into this run ────────────────────────────────
  // Carry-overs the operator selected at packing are now packed — mark them consumed,
  // stamping which order absorbed them. Their original expiry on the record is untouched.
  for (const id of (form.carryover_ids || [])) {
    await base44.entities.UnfinishedCase.update(id, {
      status: "consumed",
      consumed_order_id: stage.order_id,
      consumed_order_number: order.order_number || "",
      consumed_at: new Date().toISOString(),
    });
  }

  queryClient.invalidateQueries({ queryKey: ["inventory"] });
  queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
  queryClient.invalidateQueries({ queryKey: ["openCarryOvers"] });
  queryClient.invalidateQueries({ queryKey: ["allCarryOvers"] });
}