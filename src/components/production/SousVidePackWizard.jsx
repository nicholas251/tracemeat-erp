import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Package, AlertCircle, AlertTriangle, Archive } from "lucide-react";

const RACK_LBS = 610;
const GAYLORD_LBS = 1000;
const RACKS_PER_COOK_BATCH = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFifoLots(inventoryRows, bucketId) {
  return [...inventoryRows]
    .filter(r => r.bucket_id === bucketId && (r.available_qty || 0) > 0)
    .sort((a, b) => {
      const da = a.received_date || a.created_date || "";
      const db = b.received_date || b.created_date || "";
      return da < db ? -1 : da > db ? 1 : 0;
    });
}

function buildLotEntry(rawRow) {
  return {
    raw_inventory_id: rawRow.id,
    lot_number: rawRow.lot_number || "",
    remaining_qty: rawRow.available_qty ?? 0,
  };
}

function buildPlan(totalLbs) {
  const totalRacks = Math.ceil(totalLbs / RACK_LBS);
  const racks = Array.from({ length: totalRacks }, (_, i) => {
    const isLast = i === totalRacks - 1;
    return {
      rackNumber: i + 1,
      lbs: parseFloat((isLast ? totalLbs - RACK_LBS * i : RACK_LBS).toFixed(2)),
      cookBatchIndex: Math.floor(i / RACKS_PER_COOK_BATCH),
      cookBatchNumber: Math.floor(i / RACKS_PER_COOK_BATCH) + 1,
    };
  });
  const totalCookBatches = Math.ceil(totalRacks / RACKS_PER_COOK_BATCH);
  const cookBatches = Array.from({ length: totalCookBatches }, (_, i) => {
    const batchRacks = racks.filter(r => r.cookBatchIndex === i);
    return {
      cookBatchNumber: i + 1,
      racks: batchRacks,
      totalLbs: parseFloat(batchRacks.reduce((s, r) => s + r.lbs, 0).toFixed(2)),
    };
  });
  return { racks, cookBatches, totalRacks };
}

/**
 * Given current gaylords array and a rack just completed, distribute rackLbs
 * into gaylords, splitting across boundaries as needed.
 * Returns { updatedGaylords, contributions: [{gaylord_number, qty_lbs}] }
 */
function distributeRackToGaylords(gaylords, rackLbs, cookBatchLot, orderNumber) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const updated = gaylords.map(g => ({ ...g, source_rack_numbers: [...(g.source_rack_numbers || [])], source_cook_batch_lots: [...(g.source_cook_batch_lots || [])] }));
  const contributions = [];
  let remaining = rackLbs;

  while (remaining > 0.001) {
    // Find the current open gaylord
    let openGaylord = updated.find(g => g.status === "open");

    // None open — create a new one
    if (!openGaylord) {
      const nextNum = updated.length + 1;
      openGaylord = {
        gaylord_number: nextNum,
        lot_number: `GAY-${orderNumber}-${today}-${nextNum}`,
        qty_lbs: 0,
        status: "open",
        sealed_at: null,
        source_rack_numbers: [],
        source_cook_batch_lots: [],
        is_mixed_lot: false,
      };
      updated.push(openGaylord);
    }

    const spaceLeft = parseFloat((GAYLORD_LBS - openGaylord.qty_lbs).toFixed(2));
    const addQty = parseFloat(Math.min(remaining, spaceLeft).toFixed(2));

    openGaylord.qty_lbs = parseFloat((openGaylord.qty_lbs + addQty).toFixed(2));
    contributions.push({ gaylord_number: openGaylord.gaylord_number, qty_lbs: addQty });

    // Track cook batch lot
    if (cookBatchLot && !openGaylord.source_cook_batch_lots.includes(cookBatchLot)) {
      openGaylord.source_cook_batch_lots.push(cookBatchLot);
    }
    openGaylord.is_mixed_lot = openGaylord.source_cook_batch_lots.length > 1;

    remaining = parseFloat((remaining - addQty).toFixed(2));

    // Seal if full (within 0.1 lb tolerance)
    if (openGaylord.qty_lbs >= GAYLORD_LBS - 0.1) {
      openGaylord.status = "sealed";
      openGaylord.sealed_at = new Date().toISOString();
    }
  }

  return { updatedGaylords: updated, contributions };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SousVidePackWizard({ stage, open, onClose, onCompleted }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editingRack, setEditingRack] = useState(null);
  const [editForm, setEditForm] = useState({ lot_number: "", notes: "", lbs: "", short_weight_reason: "" });
  const [lotChangeConfirmed, setLotChangeConfirmed] = useState(false);
  const [lotChangedFrom, setLotChangedFrom] = useState(null);
  const [splitLotConfirmation, setSplitLotConfirmation] = useState(null);
  const [selectedSplitLotId, setSelectedSplitLotId] = useState(null);
  const [expandedBatches, setExpandedBatches] = useState({});
  const [needsNewLot, setNeedsNewLot] = useState(false);
  const [nextLotSelection, setNextLotSelection] = useState({});
  const [selectedLots, setSelectedLots] = useState({});
  const [manualBucketId, setManualBucketId] = useState(null);
  const [activeLots, setActiveLots] = useState({});

  // ── Fresh stage from DB ──
  const { data: freshStage, refetch: refetchStage } = useQuery({
    queryKey: ["svStage", stage?.id],
    queryFn: () => base44.entities.ProductionStage.filter({ id: stage.id }).then(r => r?.[0]),
    enabled: open && !!stage?.id,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const stageData = freshStage ?? stage;
  const lotsConfirmed = !!((freshStage?.input_lot_number ?? stage?.input_lot_number)?.trim());

  const { data: order } = useQuery({
    queryKey: ["svOrder", stageData?.order_id],
    queryFn: () => base44.entities.ProductionOrder.filter({ id: stageData.order_id }).then(r => r?.[0]),
    enabled: open && !!stageData?.order_id,
    staleTime: 30000,
  });

  const { data: product } = useQuery({
    queryKey: ["svProduct", order?.product_id],
    queryFn: () => base44.entities.Product.filter({ id: order.product_id }).then(r => r?.[0]),
    enabled: !!order?.product_id,
    staleTime: Infinity,
  });

  const blendBuckets = product?.blend_ingredients || [];

  const { data: allProteinBuckets = [] } = useQuery({
    queryKey: ["proteinBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "protein" }),
    enabled: open && blendBuckets.length === 0,
    staleTime: Infinity,
  });

  const bucketIds = blendBuckets.length > 0
    ? blendBuckets.map(b => b.bucket_id)
    : manualBucketId ? [manualBucketId] : [];

  const { data: rawInventory = [], refetch: refetchInventory } = useQuery({
    queryKey: ["rawInventory", bucketIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(bucketIds.map(id => base44.entities.RawInventory.filter({ bucket_id: id })));
      return results.flat();
    },
    enabled: open && bucketIds.length > 0,
    staleTime: 0,
  });

  const effectiveBuckets = blendBuckets.length > 0
    ? blendBuckets
    : manualBucketId
      ? [{ bucket_id: manualBucketId, bucket_name: allProteinBuckets.find(b => b.id === manualBucketId)?.name || manualBucketId, quantity_lbs: stageData?.input_qty_lbs }]
      : [];

  // Auto-select FIFO lot for each bucket on load
  useEffect(() => {
    if (rawInventory.length > 0 && effectiveBuckets.length > 0 && Object.keys(selectedLots).length === 0 && !lotsConfirmed) {
      const auto = {};
      for (const b of effectiveBuckets) {
        const lots = getFifoLots(rawInventory, b.bucket_id);
        if (lots.length > 0) {
          auto[b.bucket_id] = { raw_inventory_id: lots[0].id, lot_number: lots[0].lot_number || "", available_qty: lots[0].available_qty };
        }
      }
      if (Object.keys(auto).length > 0) setSelectedLots(auto);
    }
  }, [rawInventory.length, effectiveBuckets.length, lotsConfirmed]);

  // Restore activeLots from DB when re-opening a confirmed stage
  useEffect(() => {
    if (lotsConfirmed && rawInventory.length > 0 && effectiveBuckets.length > 0 && Object.keys(activeLots).length === 0) {
      let saved = null;
      try { saved = stageData?.pork_lot_number ? JSON.parse(stageData.pork_lot_number) : null; } catch {}
      if (saved) {
        const restored = {};
        for (const [bucketId, info] of Object.entries(saved)) {
          const liveRow = rawInventory.find(r => r.id === info.raw_inventory_id);
          if (liveRow) restored[bucketId] = { raw_inventory_id: liveRow.id, lot_number: liveRow.lot_number || "", remaining_qty: liveRow.available_qty };
        }
        if (Object.keys(restored).length > 0) setActiveLots(restored);
      } else {
        const initial = {};
        for (const b of effectiveBuckets) {
          const lots = getFifoLots(rawInventory, b.bucket_id);
          if (lots.length > 0) initial[b.bucket_id] = { raw_inventory_id: lots[0].id, lot_number: lots[0].lot_number || "", remaining_qty: lots[0].available_qty };
        }
        if (Object.keys(initial).length > 0) setActiveLots(initial);
      }
    }
  }, [lotsConfirmed, rawInventory.length, effectiveBuckets.length]);

  // ── Plan & rack/gaylord state ──
  const plan = useMemo(() => stageData ? buildPlan(stageData.input_qty_lbs || 0) : null, [stageData?.input_qty_lbs]);

  const completedRacks = useMemo(() => {
    const map = {};
    for (const sb of stageData?.sub_batches || []) {
      const rackNum = sb.rack_number ?? (sb.sub_batch_id?.startsWith("rack-") ? parseInt(sb.sub_batch_id.split("-")[1]) : null);
      if (rackNum) {
        map[rackNum] = {
          completed: true,
          lbs: sb.lbs ?? sb.qty_lbs ?? RACK_LBS,
          lot_number: sb.lot_number || "",
          raw_lots: sb.raw_lots || [],
          notes: sb.notes || "",
          short_weight_reason: sb.short_weight_reason || "",
          cook_batch_number: sb.cook_batch_number,
          gaylord_contributions: sb.gaylord_contributions || [],
        };
      }
    }
    return map;
  }, [stageData?.sub_batches]);

  // Live gaylords from DB
  const gaylords = stageData?.gaylords || [];

  if (!plan || !stageData) return null;

  const completedCount = plan.racks.filter(r => completedRacks[r.rackNumber]?.completed).length;
  const lotsValid = effectiveBuckets.length > 0 && effectiveBuckets.every(b => selectedLots[b.bucket_id]?.raw_inventory_id);
  const primaryBucketId = effectiveBuckets.length > 0 ? effectiveBuckets[0].bucket_id : null;
  const primaryActiveLot = primaryBucketId ? activeLots[primaryBucketId] : null;

  // ─── Step 1: Confirm lots ──────────────────────────────────────────────────
  const handleConfirmLots = async () => {
    setSaving(true);
    try {
      const primaryLot = selectedLots[effectiveBuckets[0]?.bucket_id]?.lot_number || "";
      const initial = {};
      for (const b of effectiveBuckets) {
        const sel = selectedLots[b.bucket_id];
        if (sel?.raw_inventory_id) {
          const freshRow = await base44.entities.RawInventory.filter({ id: sel.raw_inventory_id }).then(r => r?.[0]);
          initial[b.bucket_id] = buildLotEntry(freshRow || sel);
        }
      }
      setActiveLots(initial);
      await base44.entities.ProductionStage.update(stageData.id, {
        input_lot_number: primaryLot,
        status: "in_progress",
        started_at: stageData.started_at || new Date().toISOString(),
        pork_lot_number: JSON.stringify(initial),
        gaylords: [], // initialize empty gaylords array
      });
      queryClient.invalidateQueries({ queryKey: ["rawInventory"] });
      await refetchStage();
    } finally {
      setSaving(false);
    }
  };

  // ─── Open rack edit form ──────────────────────────────────────────────────
  const openEditRack = (rack) => {
    const existing = completedRacks[rack.rackNumber];
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    setEditForm({
      lot_number: existing?.lot_number || `SV-R${rack.rackNumber}-${today}`,
      notes: existing?.notes || "",
      lbs: existing?.lbs ?? rack.lbs,
      short_weight_reason: existing?.short_weight_reason || "",
    });

    const primaryActive = activeLots[primaryBucketId];
    const rackLbs = existing?.lbs ?? rack.lbs;

    // Check if split needed before opening dialog
    if (primaryActive && primaryActive.remaining_qty < rackLbs && primaryActive.remaining_qty > 0) {
      const nextLots = getFifoLots(rawInventory, primaryBucketId).filter(l => l.id !== primaryActive.raw_inventory_id);
      if (nextLots.length > 0) {
        setSelectedSplitLotId(nextLots[0].id);
        setSplitLotConfirmation({
          rackNumber: rack.rackNumber,
          currentLotNumber: primaryActive.lot_number,
          currentRemaining: primaryActive.remaining_qty,
          weightNeeded: rackLbs,
          availableLots: nextLots,
        });
        return;
      }
    }

    // Detect lot change from previous rack
    const currentActiveLotNumber = activeLots[primaryBucketId]?.lot_number;
    const prevRack = completedRacks[rack.rackNumber - 1];
    const lastRawLot = prevRack?.raw_lots?.length > 0 ? prevRack.raw_lots[prevRack.raw_lots.length - 1] : null;
    const lotChanged = lastRawLot && currentActiveLotNumber && lastRawLot !== currentActiveLotNumber;
    setLotChangedFrom(lotChanged ? lastRawLot : null);
    setLotChangeConfirmed(false);
    setEditingRack(rack);
  };

  // ─── Core: save rack + update gaylords + maybe create cook stage ──────────
  const saveRackAndUpdateGaylords = async ({ rackNum, lbs, lot, rawLotsUsed, cookBatchNumber, currentActiveLots }) => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const cookBatchLot = `SV-CB${cookBatchNumber}-${stageData.order_number}-${today}`;

    // Get latest stage from DB for sub_batches + gaylords (avoid stale reads)
    const latestStage = await base44.entities.ProductionStage.filter({ id: stageData.id }).then(r => r?.[0]);
    const existingSubs = latestStage?.sub_batches || [];
    const existingGaylords = latestStage?.gaylords || [];

    // ── Distribute rack lbs into gaylords ──
    const { updatedGaylords, contributions } = distributeRackToGaylords(
      existingGaylords, lbs, cookBatchLot, stageData.order_number
    );

    // Add rack_number back to gaylord source arrays
    for (const contrib of contributions) {
      const g = updatedGaylords.find(g => g.gaylord_number === contrib.gaylord_number);
      if (g && !g.source_rack_numbers.includes(rackNum)) {
        g.source_rack_numbers.push(rackNum);
      }
    }

    // ── Build new sub_batch with gaylord_contributions ──
    const newSubBatch = {
      sub_batch_id: `rack-${rackNum}`,
      rack_number: rackNum,
      label: `Rack #${rackNum}`,
      lbs,
      qty_lbs: lbs,
      lot_number: lot,
      raw_lots: rawLotsUsed,
      notes: editForm.notes,
      short_weight_reason: lbs < RACK_LBS ? editForm.short_weight_reason : null,
      cook_batch_number: cookBatchNumber,
      status: "completed",
      gaylord_contributions: contributions,
    };

    const newSubs = [...existingSubs.filter(sb => sb.rack_number !== rackNum), newSubBatch];
    const newCompleted = {};
    for (const sb of newSubs) {
      if (sb.rack_number) newCompleted[sb.rack_number] = { completed: true, lbs: sb.qty_lbs || sb.lbs || RACK_LBS };
    }

    // ── Save sub_batches + gaylords + active lots ──
    await base44.entities.ProductionStage.update(stageData.id, {
      sub_batches: newSubs,
      gaylords: updatedGaylords,
      pork_lot_number: JSON.stringify(currentActiveLots),
    });

    // ── Check if cook batch is complete → create cooking stage ──
    const cookBatch = plan.cookBatches.find(cb => cb.cookBatchNumber === cookBatchNumber);
    if (cookBatch) {
      const batchRackNums = cookBatch.racks.map(r => r.rackNumber);
      const batchComplete = batchRackNums.every(rn => newCompleted[rn]?.completed);
      if (batchComplete) {
        const existingCookStages = await base44.entities.ProductionStage.filter({
          order_id: stageData.order_id,
          capability_key: "cooking",
        });
        const alreadyExists = existingCookStages.some(s => s.cook_batch_lot === cookBatchLot);
        if (!alreadyExists) {
          const orderData = await base44.entities.ProductionOrder.filter({ id: stageData.order_id }).then(r => r?.[0]);
          const flowData = orderData?.flow_id ? await base44.entities.ProductFlow.filter({ id: orderData.flow_id }).then(r => r?.[0]) : null;
          const cookStep = flowData?.steps?.find(s => s.capability_key === "cooking");
          let cookProfileId = cookStep?.work_profile_id;
          let cookProfileName = cookStep?.work_profile_name;
          if (!cookProfileId) {
            const allProfiles = await base44.entities.WorkProfile.filter({ status: "active" });
            const cookProfile = allProfiles.find(p => (p.capability_keys || []).includes("cooking"));
            if (cookProfile) { cookProfileId = cookProfile.id; cookProfileName = cookProfile.name; }
          }
          const cookBatchLbs = batchRackNums.reduce((s, rn) => s + (newCompleted[rn]?.lbs || RACK_LBS), 0);
          await base44.entities.ProductionStage.create({
            order_id: stageData.order_id,
            order_number: stageData.order_number,
            product_name: stageData.product_name,
            step_number: cookStep?.step_number ?? (latestStage.step_number + 1),
            capability_id: cookStep?.capability_id || "",
            capability_key: "cooking",
            capability_name: cookStep?.capability_name || "Cooking",
            work_profile_id: cookProfileId || "",
            work_profile_name: cookProfileName || "",
            status: "available",
            input_qty_lbs: parseFloat(cookBatchLbs.toFixed(2)),
            racks_count: batchRackNums.length,
            cook_batch_lot: cookBatchLot,
            input_lot_number: [...new Set(rawLotsUsed)].join(", "),
            notes: `Cook Batch #${cookBatchNumber} — Racks ${batchRackNums.join(", ")}`,
          });
        }
      }
    }

    // ── Check if all racks done → complete packing stage ──
    const allRacksDone = plan.racks.every(r => newCompleted[r.rackNumber]?.completed);
    if (allRacksDone) {
      // Seal any remaining open gaylord (last one may be less than 1000 lbs)
      const finalGaylords = updatedGaylords.map(g =>
        g.status === "open" ? { ...g, status: "sealed", sealed_at: new Date().toISOString() } : g
      );
      await base44.entities.ProductionStage.update(stageData.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        output_qty_lbs: parseFloat(plan.racks.reduce((s, r) => s + (newCompleted[r.rackNumber]?.lbs || r.lbs), 0).toFixed(2)),
        racks_count: plan.totalRacks,
        gaylords: finalGaylords,
      });
    }

    return { newCompleted, allRacksDone };
  };

  // ─── Complete rack (normal, single-lot case) ──────────────────────────────
  const handleCompleteRack = async () => {
    if (!editingRack) return;
    const rackNum = editingRack.rackNumber;
    const lbs = parseFloat(editForm.lbs) || editingRack.lbs;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const lot = editForm.lot_number.trim() || `SV-R${rackNum}-${today}`;

    setSaving(true);
    try {
      // Refresh active lots
      const freshActiveLots = { ...activeLots };
      for (const b of effectiveBuckets) {
        const current = activeLots[b.bucket_id];
        if (current?.raw_inventory_id) {
          const freshRow = await base44.entities.RawInventory.filter({ id: current.raw_inventory_id }).then(r => r?.[0]);
          if (freshRow) freshActiveLots[b.bucket_id] = { raw_inventory_id: freshRow.id, lot_number: freshRow.lot_number || "", remaining_qty: freshRow.available_qty ?? 0 };
        }
      }

      // Check split still needed after refresh
      const primaryActive = freshActiveLots[primaryBucketId];
      if (primaryActive && primaryActive.remaining_qty < lbs && primaryActive.remaining_qty > 0.001) {
        const nextLots = getFifoLots(rawInventory, primaryBucketId).filter(l => l.id !== primaryActive.raw_inventory_id);
        if (nextLots.length > 0) {
          setSplitLotConfirmation({ rackNumber: rackNum, currentLotNumber: primaryActive.lot_number, currentRemaining: primaryActive.remaining_qty, weightNeeded: lbs, availableLots: nextLots });
          setSelectedSplitLotId(nextLots[0].id);
          setEditingRack(null);
          setSaving(false);
          return;
        }
      }

      // Deduct from single lot
      const newActiveLots = { ...freshActiveLots };
      const active = newActiveLots[primaryBucketId];
      if (active?.raw_inventory_id) {
        const freshRow = await base44.entities.RawInventory.filter({ id: active.raw_inventory_id }).then(r => r?.[0]);
        const newQty = parseFloat((Math.max(0, (freshRow?.available_qty ?? 0) - lbs)).toFixed(2));
        await base44.entities.RawInventory.update(active.raw_inventory_id, {
          available_qty: newQty,
          status: newQty <= 0 ? "depleted" : "in_use",
        });
        newActiveLots[primaryBucketId] = { ...active, remaining_qty: newQty };
        setActiveLots(newActiveLots);
      }

      setEditingRack(null);

      const { allRacksDone } = await saveRackAndUpdateGaylords({
        rackNum,
        lbs,
        lot,
        rawLotsUsed: [active?.lot_number].filter(Boolean),
        cookBatchNumber: editingRack.cookBatchNumber,
        currentActiveLots: newActiveLots,
      });

      await refetchStage();
      await refetchInventory();
      queryClient.invalidateQueries({ queryKey: ["orderStages", stageData.order_id] });
      queryClient.invalidateQueries({ queryKey: ["allStages"] });

      if (allRacksDone) onCompleted?.();
    } finally {
      setSaving(false);
    }
  };

  // ─── Complete rack (split-lot case) ──────────────────────────────────────
  const handleConfirmSplitLot = async () => {
    if (!splitLotConfirmation || !selectedSplitLotId) return;
    const rackNum = splitLotConfirmation.rackNumber;
    const lbs = parseFloat(editForm.lbs) || splitLotConfirmation.weightNeeded;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const lot = editForm.lot_number.trim() || `SV-R${rackNum}-${today}`;
    const primaryActive = activeLots[primaryBucketId];

    setSaving(true);
    try {
      const fromLot1 = splitLotConfirmation.currentRemaining;
      const fromLot2 = parseFloat((lbs - fromLot1).toFixed(2));

      // Deplete lot 1
      if (primaryActive?.raw_inventory_id) {
        await base44.entities.RawInventory.update(primaryActive.raw_inventory_id, { available_qty: 0, status: "depleted" });
      }

      // Deduct from lot 2
      const lot2Row = await base44.entities.RawInventory.filter({ id: selectedSplitLotId }).then(r => r?.[0]);
      const lot2NewQty = parseFloat((Math.max(0, (lot2Row?.available_qty ?? 0) - fromLot2)).toFixed(2));
      await base44.entities.RawInventory.update(selectedSplitLotId, {
        available_qty: lot2NewQty,
        status: lot2NewQty <= 0 ? "depleted" : "in_use",
      });

      const newActiveLots = {
        ...activeLots,
        [primaryBucketId]: { raw_inventory_id: lot2Row.id, lot_number: lot2Row?.lot_number || "", remaining_qty: lot2NewQty },
      };
      setActiveLots(newActiveLots);

      const rawLotsUsed = [primaryActive?.lot_number, lot2Row?.lot_number].filter(Boolean);
      const cookBatchNumber = plan.racks.find(r => r.rackNumber === rackNum)?.cookBatchNumber;

      setSplitLotConfirmation(null);
      setSelectedSplitLotId(null);

      const { allRacksDone } = await saveRackAndUpdateGaylords({
        rackNum,
        lbs,
        lot,
        rawLotsUsed,
        cookBatchNumber,
        currentActiveLots: newActiveLots,
      });

      await refetchStage();
      await refetchInventory();
      queryClient.invalidateQueries({ queryKey: ["orderStages", stageData.order_id] });
      queryClient.invalidateQueries({ queryKey: ["allStages"] });

      if (allRacksDone) onCompleted?.();
    } finally {
      setSaving(false);
    }
  };

  // ─── Switch to next lot (lot fully exhausted at rack boundary) ────────────
  const handleConfirmNextLot = async () => {
    setSaving(true);
    try {
      const newActive = { ...activeLots };
      for (const b of effectiveBuckets) {
        const sel = nextLotSelection[b.bucket_id];
        if (!sel?.raw_inventory_id) continue;
        const freshRow = await base44.entities.RawInventory.filter({ id: sel.raw_inventory_id }).then(r => r?.[0]);
        newActive[b.bucket_id] = buildLotEntry(freshRow || sel);
      }
      setActiveLots(newActive);
      setNextLotSelection({});
      setNeedsNewLot(false);
      await base44.entities.ProductionStage.update(stageData.id, { pork_lot_number: JSON.stringify(newActive) });
      await refetchInventory();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { setEditingRack(null); setSplitLotConfirmation(null); onClose(); };

  // ─── Render ───────────────────────────────────────────────────────────────
  const openGaylord = gaylords.find(g => g.status === "open");
  const sealedGaylords = gaylords.filter(g => g.status === "sealed");
  const totalGaylordsCount = gaylords.length;
  const openGaylordFillPct = openGaylord ? Math.round((openGaylord.qty_lbs / GAYLORD_LBS) * 100) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-card shrink-0">
            <div className="w-10 h-10 rounded-xl bg-chart-1/15 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-chart-1" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold leading-tight">Sous Vide Pack — {stageData.product_name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Order <span className="font-semibold text-foreground">#{stageData.order_number}</span>
                &nbsp;·&nbsp;<span className="font-semibold text-foreground">{stageData.input_qty_lbs} lbs</span>
                &nbsp;·&nbsp;{plan.totalRacks} racks &nbsp;·&nbsp;{plan.cookBatches.length} cook batches
              </p>
            </div>
            <div className="ml-auto shrink-0 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{completedCount}/{plan.totalRacks} racks</Badge>
              {totalGaylordsCount > 0 && (
                <Badge className="bg-primary/10 text-primary border-0 text-xs">
                  <Archive className="w-3 h-3 mr-1" />{sealedGaylords.length}/{totalGaylordsCount} gaylords sealed
                </Badge>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Step 1: Lot confirmation */}
            <div className={`rounded-xl border-2 p-4 space-y-3 ${lotsConfirmed ? "border-chart-2/40 bg-chart-2/5" : "border-amber-300 bg-amber-50/40"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {lotsConfirmed ? <CheckCircle2 className="w-4 h-4 text-chart-2" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  <p className="font-bold text-sm">Step 1 — Confirm Raw Material Lot</p>
                </div>
                {lotsConfirmed && <Badge className="bg-chart-2/15 text-chart-2 border-0 text-xs">Confirmed</Badge>}
              </div>

              {lotsConfirmed && (
                <div className="space-y-1.5">
                  <div className="rounded bg-chart-2/5 border border-chart-2/20 px-3 py-2 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Starting Lot</span>
                    <span className="font-mono font-semibold">{stageData.input_lot_number}</span>
                  </div>
                  {primaryActiveLot && (
                    <div className="rounded bg-muted/40 border px-3 py-2 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground">Active Lot</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{primaryActiveLot.lot_number}</span>
                        <span className={`font-semibold ${primaryActiveLot.remaining_qty < RACK_LBS ? "text-destructive" : "text-chart-2"}`}>
                          {primaryActiveLot.remaining_qty.toFixed(1)} lbs remaining
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!lotsConfirmed && (
                <div className="space-y-3">
                  {blendBuckets.length === 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Select Protein Bucket</Label>
                      <Select value={manualBucketId || ""} onValueChange={v => { setManualBucketId(v); setSelectedLots({}); }}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Choose a bucket…" /></SelectTrigger>
                        <SelectContent>
                          {allProteinBuckets.filter(b => b.status === "active").map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {effectiveBuckets.map(bucket => {
                    const fifoLots = getFifoLots(rawInventory, bucket.bucket_id);
                    const sel = selectedLots[bucket.bucket_id];
                    return (
                      <div key={bucket.bucket_id} className="rounded border bg-white p-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold">{bucket.bucket_name}</span>
                          <span className="text-muted-foreground">{bucket.quantity_lbs || stageData.input_qty_lbs} lbs needed</span>
                        </div>
                        <Select
                          value={sel?.raw_inventory_id || ""}
                          onValueChange={val => {
                            const row = rawInventory.find(r => r.id === val);
                            if (row) setSelectedLots(prev => ({ ...prev, [bucket.bucket_id]: { raw_inventory_id: row.id, lot_number: row.lot_number || "", available_qty: row.available_qty } }));
                          }}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select lot (FIFO)…" /></SelectTrigger>
                          <SelectContent>
                            {fifoLots.length === 0 && <SelectItem value="__none__" disabled>No inventory available</SelectItem>}
                            {fifoLots.map((lot, i) => (
                              <SelectItem key={lot.id} value={lot.id}>
                                {i === 0 ? "⭑ " : ""}{lot.lot_number || lot.id} — {lot.available_qty} lbs
                                {lot.received_date ? ` (rcvd ${lot.received_date})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {sel?.lot_number && (
                          <div className="rounded bg-chart-1/8 border border-chart-1/20 px-3 py-1.5 text-xs flex justify-between">
                            <span className="font-mono font-semibold">{sel.lot_number}</span>
                            <span className="text-muted-foreground">{sel.available_qty} lbs on hand</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {effectiveBuckets.length > 0 && (
                    <Button className="w-full h-9 gap-2" disabled={!lotsValid || saving} onClick={handleConfirmLots}>
                      <CheckCircle2 className="w-4 h-4" />
                      {saving ? "Saving…" : "Confirm & Start Packing"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Lot exhausted prompt */}
            {lotsConfirmed && needsNewLot && (
              <div className="rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="font-bold text-sm text-destructive">Lot Exhausted — Select Next Lot</p>
                </div>
                {effectiveBuckets.map(bucket => {
                  const freshLots = getFifoLots(rawInventory, bucket.bucket_id);
                  const sel = nextLotSelection[bucket.bucket_id];
                  return (
                    <div key={bucket.bucket_id} className="space-y-1.5">
                      <Label className="text-xs font-semibold">{bucket.bucket_name} — Next Lot</Label>
                      <Select value={sel?.raw_inventory_id || ""} onValueChange={val => {
                        const row = rawInventory.find(r => r.id === val);
                        if (row) setNextLotSelection(prev => ({ ...prev, [bucket.bucket_id]: { raw_inventory_id: row.id, lot_number: row.lot_number || "", available_qty: row.available_qty } }));
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select next lot…" /></SelectTrigger>
                        <SelectContent>
                          {freshLots.length === 0 && <SelectItem value="__none__" disabled>No more inventory</SelectItem>}
                          {freshLots.map((lot, i) => (
                            <SelectItem key={lot.id} value={lot.id}>
                              {i === 0 ? "⭑ " : ""}{lot.lot_number || lot.id} — {lot.available_qty} lbs
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                <Button className="w-full h-9 gap-2" disabled={saving || !effectiveBuckets.every(b => nextLotSelection[b.bucket_id]?.raw_inventory_id)} onClick={handleConfirmNextLot}>
                  <CheckCircle2 className="w-4 h-4" />{saving ? "Switching…" : "Switch to Next Lot"}
                </Button>
              </div>
            )}

            {/* Step 2: Cook batches + Racks */}
            {lotsConfirmed && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step 2 — Rack Packing</p>
                {plan.cookBatches.map(cb => {
                  const completedInBatch = cb.racks.filter(r => completedRacks[r.rackNumber]?.completed).length;
                  const batchComplete = completedInBatch === cb.racks.length;
                  const isExpanded = expandedBatches[cb.cookBatchNumber];
                  return (
                    <div key={cb.cookBatchNumber} className={`rounded-xl border-2 ${batchComplete ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-card"}`}>
                      <div
                        className="flex items-center justify-between px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-white/50 transition-colors"
                        onClick={() => batchComplete && setExpandedBatches(p => ({ ...p, [cb.cookBatchNumber]: !p[cb.cookBatchNumber] }))}
                      >
                        <div className="flex items-center gap-2">
                          {batchComplete ? <CheckCircle2 className="w-4 h-4 text-chart-2" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                          <p className="font-bold text-sm">Cook Batch #{cb.cookBatchNumber}</p>
                          <span className="text-xs text-muted-foreground">{cb.totalLbs} lbs · {cb.racks.length} racks</span>
                        </div>
                        {batchComplete
                          ? <Badge className="bg-chart-2/15 text-chart-2 border-0 text-xs">Sent to Cooking</Badge>
                          : <Badge variant="outline" className="text-xs">{completedInBatch}/{cb.racks.length} racks</Badge>
                        }
                      </div>
                      {(!batchComplete || isExpanded) && (
                        <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {cb.racks.map(rack => {
                            const rd = completedRacks[rack.rackNumber];
                            const done = !!rd?.completed;
                            const blocked = !done && needsNewLot;
                            return (
                              <button
                                key={rack.rackNumber}
                                onClick={() => !done && !blocked && openEditRack(rack)}
                                disabled={done || blocked}
                                className={`text-left rounded-lg border-2 p-3 transition-all ${
                                  done
                                    ? "border-chart-2/40 bg-chart-2/8 cursor-default"
                                    : blocked
                                      ? "border-destructive/30 bg-destructive/5 cursor-not-allowed opacity-60"
                                      : "border-border hover:border-chart-1/50 hover:bg-chart-1/5 cursor-pointer active:scale-95"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  {done ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                                    : blocked ? <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                                    : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                  <span className="text-xs font-bold">Rack #{rack.rackNumber}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{done ? `${rd.lbs} lbs` : `~${rack.lbs} lbs`}</p>
                                {done && rd.raw_lots?.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {rd.raw_lots.map((rl, i) => <p key={i} className="text-xs font-mono text-chart-2 truncate">{rl}</p>)}
                                  </div>
                                )}
                                {done && rd.gaylord_contributions?.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {rd.gaylord_contributions.map((c, i) => (
                                      <p key={i} className="text-xs text-muted-foreground">→ Gaylord #{c.gaylord_number}: {c.qty_lbs} lbs</p>
                                    ))}
                                  </div>
                                )}
                                {!done && !blocked && <p className="text-xs text-chart-1 font-semibold mt-0.5">Tap to complete</p>}
                                {blocked && <p className="text-xs text-destructive font-semibold mt-0.5">Select new lot first</p>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gaylord tracker */}
            {lotsConfirmed && gaylords.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gaylord Tracker</p>
                {/* Active gaylord fill bar */}
                {openGaylord && (
                  <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-primary" />
                        <p className="font-bold text-sm">Gaylord #{openGaylord.gaylord_number} — Filling</p>
                        {openGaylord.is_mixed_lot && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Mixed Lot</Badge>
                        )}
                      </div>
                      <span className="text-sm font-bold text-primary">{openGaylord.qty_lbs.toFixed(1)} / {GAYLORD_LBS} lbs</span>
                    </div>
                    {/* Fill progress bar */}
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${openGaylordFillPct}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{openGaylordFillPct}% full · {(GAYLORD_LBS - openGaylord.qty_lbs).toFixed(1)} lbs remaining space</span>
                      <span className="font-mono">Lot: {openGaylord.lot_number}</span>
                    </div>
                    {openGaylord.source_cook_batch_lots?.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Cook batch lots: </span>
                        <span className="font-mono font-semibold">{openGaylord.source_cook_batch_lots.join(" + ")}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sealed gaylords */}
                {sealedGaylords.length > 0 && (
                  <div className="space-y-2">
                    {sealedGaylords.map(g => (
                      <div key={g.gaylord_number} className="rounded-lg border border-chart-2/30 bg-chart-2/5 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" />
                          <div>
                            <p className="text-sm font-bold">Gaylord #{g.gaylord_number}</p>
                            <p className="text-xs font-mono text-muted-foreground">{g.lot_number}</p>
                          </div>
                          {g.is_mixed_lot && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Mixed Lot</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{g.qty_lbs.toFixed(1)} lbs</p>
                          {g.source_cook_batch_lots?.length > 1 && (
                            <p className="text-xs text-muted-foreground">{g.source_cook_batch_lots.length} cook batches</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Split lot dialog */}
      {splitLotConfirmation && (
        <Dialog open={!!splitLotConfirmation} onOpenChange={open => { if (!open) { setSplitLotConfirmation(null); setSelectedSplitLotId(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Complete Rack #{splitLotConfirmation.rackNumber} — Split Lot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">Lot 1 will be exhausted:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-700">Lot Number</span>
                    <span className="font-mono font-semibold">{splitLotConfirmation.currentLotNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">Quantity used</span>
                    <span className="font-semibold">{splitLotConfirmation.currentRemaining.toFixed(1)} lbs</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Lot 2 (select below)</Label>
                <Select value={selectedSplitLotId || ""} onValueChange={setSelectedSplitLotId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Choose next lot…" /></SelectTrigger>
                  <SelectContent>
                    {splitLotConfirmation.availableLots?.map((lot, i) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {i === 0 ? "⭑ " : ""}{lot.lot_number || lot.id} — {lot.available_qty} lbs
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSplitLotId && (
                  <div className="rounded bg-muted/40 border px-3 py-2 text-xs flex justify-between">
                    <span className="text-muted-foreground">Quantity from Lot 2</span>
                    <span className="font-semibold">{(splitLotConfirmation.weightNeeded - splitLotConfirmation.currentRemaining).toFixed(1)} lbs</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Actual Rack Weight (lbs)</Label>
                <Input type="number" step="1" value={editForm.lbs || ""} onChange={e => setEditForm(f => ({ ...f, lbs: parseFloat(e.target.value) || 0 }))} className="h-10" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Rack Lot Number</Label>
                <Input value={editForm.lot_number} onChange={e => setEditForm(f => ({ ...f, lot_number: e.target.value }))} placeholder={`SV-R${splitLotConfirmation.rackNumber}-...`} className="h-10" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Notes (optional)</Label>
                <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any observations…" className="h-12" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setSplitLotConfirmation(null); setSelectedSplitLotId(null); }} disabled={saving}>Cancel</Button>
                <Button className="flex-1 bg-chart-2 hover:bg-chart-2/90 gap-2" onClick={handleConfirmSplitLot} disabled={saving || !selectedSplitLotId || !editForm.lbs}>
                  {saving ? "Completing…" : "Complete Rack"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Rack completion dialog */}
      {editingRack && (
        <Dialog open={!!editingRack} onOpenChange={open => { if (!open) setEditingRack(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Complete Rack #{editingRack.rackNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="rounded-lg bg-muted/40 border px-3 py-2 text-sm text-muted-foreground">
                Cook Batch #{editingRack.cookBatchNumber} · Expected ~{editingRack.lbs} lbs
                {primaryActiveLot && (
                  <span className={`ml-2 font-semibold text-xs ${primaryActiveLot.remaining_qty < RACK_LBS ? "text-amber-600" : "text-chart-2"}`}>
                    · {primaryActiveLot.remaining_qty.toFixed(1)} lbs left in lot
                  </span>
                )}
              </div>

              {/* Gaylord preview — show where this rack will land */}
              {openGaylord && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs space-y-1">
                  <p className="font-semibold text-primary">Gaylord #{openGaylord.gaylord_number} — currently {openGaylord.qty_lbs.toFixed(1)} lbs</p>
                  {(() => {
                    const rackLbs = parseFloat(editForm.lbs) || editingRack.lbs;
                    const spaceLeft = GAYLORD_LBS - openGaylord.qty_lbs;
                    if (rackLbs <= spaceLeft) {
                      return <p className="text-muted-foreground">This rack fits entirely → Gaylord #{openGaylord.gaylord_number} will be {(openGaylord.qty_lbs + rackLbs).toFixed(1)} lbs{(openGaylord.qty_lbs + rackLbs >= GAYLORD_LBS - 0.1) ? " — will seal" : ""}</p>;
                    } else {
                      return <p className="text-amber-700 font-medium">Split: {spaceLeft.toFixed(1)} lbs → Gaylord #{openGaylord.gaylord_number} (seals), {(rackLbs - spaceLeft).toFixed(1)} lbs → Gaylord #{openGaylord.gaylord_number + 1} (new)</p>;
                    }
                  })()}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Actual Weight (lbs)</Label>
                <Input
                  type="number" step="1" min="1" max="610"
                  value={editForm.lbs || ""}
                  onChange={e => setEditForm(f => ({ ...f, lbs: parseFloat(e.target.value) || 0 }))}
                  className="h-11"
                />
              </div>

              {parseFloat(editForm.lbs) > 0 && parseFloat(editForm.lbs) < RACK_LBS && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-amber-600">Short Weight Reason (required)</Label>
                  <Textarea value={editForm.short_weight_reason} onChange={e => setEditForm(f => ({ ...f, short_weight_reason: e.target.value }))} placeholder="Why is this rack below 610 lbs?" className="h-16" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Rack Lot Number</Label>
                <Input value={editForm.lot_number} onChange={e => setEditForm(f => ({ ...f, lot_number: e.target.value }))} placeholder={`SV-R${editingRack.rackNumber}-...`} className="h-11" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Notes (optional)</Label>
                <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any observations…" className="h-16" />
              </div>

              {lotChangedFrom && (
                <div className={`rounded-lg border-2 p-3 space-y-2 ${lotChangeConfirmed ? "border-chart-2/40 bg-chart-2/5" : "border-amber-400 bg-amber-50"}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${lotChangeConfirmed ? "text-chart-2" : "text-amber-500"}`} />
                    <div>
                      <p className="text-xs font-bold text-amber-700">Lot Change Detected</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Previous rack used <span className="font-mono font-semibold">{lotChangedFrom}</span>.
                        This rack will use <span className="font-mono font-semibold">{primaryActiveLot?.lot_number}</span>.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={lotChangeConfirmed} onChange={e => setLotChangeConfirmed(e.target.checked)} className="w-4 h-4 accent-green-600" />
                    <span className="text-xs font-semibold">I confirm the correct lot is loaded</span>
                  </label>
                </div>
              )}

              {editingRack.rackNumber === plan.cookBatches.find(cb => cb.cookBatchNumber === editingRack.cookBatchNumber)?.racks.slice(-1)[0]?.rackNumber && (
                <div className="flex items-start gap-2 rounded-lg bg-chart-1/10 border border-chart-1/20 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-chart-1 shrink-0 mt-0.5" />
                  <p className="text-xs text-chart-1 font-medium">
                    Last rack in Cook Batch #{editingRack.cookBatchNumber} — completing it will send the batch to cooking.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditingRack(null)} disabled={saving}>Cancel</Button>
                <Button
                  className="flex-1 bg-chart-2 hover:bg-chart-2/90 gap-2"
                  onClick={handleCompleteRack}
                  disabled={
                    saving ||
                    !parseFloat(editForm.lbs) ||
                    (parseFloat(editForm.lbs) < RACK_LBS && !editForm.short_weight_reason?.trim()) ||
                    (!!lotChangedFrom && !lotChangeConfirmed)
                  }
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Saving…" : "Complete Rack"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}