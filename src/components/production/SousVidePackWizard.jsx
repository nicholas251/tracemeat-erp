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
import { CheckCircle2, Circle, Package, AlertCircle, AlertTriangle } from "lucide-react";

const RACK_LBS = 610;
const RACKS_PER_COOK_BATCH = 3;

// ─── helpers ────────────────────────────────────────────────────────────────

function getFifoLots(inventoryRows, bucketId) {
  return [...inventoryRows]
    .filter(r => r.bucket_id === bucketId && (r.available_qty || 0) > 0)
    .sort((a, b) => {
      const da = a.received_date || a.created_date || "";
      const db = b.received_date || b.created_date || "";
      return da < db ? -1 : da > db ? 1 : 0;
    });
}

// Build lot object from selection or raw inventory row
function buildLotEntry(rawRow) {
  return {
    raw_inventory_id: rawRow.id,
    lot_number: rawRow.lot_number || "",
    remaining_qty: rawRow.available_qty ?? 0,
  };
}

// Extract last raw lot from rack data
function getLastRawLot(rackData) {
  return rackData?.raw_lots?.length > 0 ? rackData.raw_lots[rackData.raw_lots.length - 1] : null;
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

// ─── main component ──────────────────────────────────────────────────────────

export default function SousVidePackWizard({ stage, open, onClose, onCompleted }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editingRack, setEditingRack] = useState(null);
  const [editForm, setEditForm] = useState({ lot_number: "", notes: "", lbs: "", short_weight_reason: "" });
  const [lotChangeConfirmed, setLotChangeConfirmed] = useState(false);
  const [lotChangedFrom, setLotChangedFrom] = useState(null);
  const [splitLotConfirmation, setSplitLotConfirmation] = useState(null);
  const [selectedSplitLotId, setSelectedSplitLotId] = useState(null);
  const [splitConfirmedRackNumber, setSplitConfirmedRackNumber] = useState(null);

  // ── Step 1 state: lot selection ──
  const [selectedLots, setSelectedLots] = useState({}); // { [bucket_id]: { raw_inventory_id, lot_number, available_qty } }
  const [manualBucketId, setManualBucketId] = useState(null);

  // ── Lot exhausted / next lot picker state ──
  // When a lot runs out mid-production, we block further racks until a new lot is chosen
  const [needsNewLot, setNeedsNewLot] = useState(false); // show the "select next lot" prompt
  const [nextLotSelection, setNextLotSelection] = useState({}); // { [bucket_id]: { raw_inventory_id, lot_number, available_qty } }

  // ── Active lot tracking (per bucket, updated as lots are consumed) ──
  // activeLots: { [bucket_id]: { raw_inventory_id, lot_number, remaining_qty } }
  // Persisted in stage.cook_batch_lot field as JSON for recovery on remount
  const [activeLots, setActiveLots] = useState({});

  // ── Fetch fresh stage from DB every time dialog opens ──
  const { data: freshStage, refetch: refetchStage } = useQuery({
    queryKey: ["svStage", stage?.id],
    queryFn: () => base44.entities.ProductionStage.filter({ id: stage.id }).then(r => r?.[0]),
    enabled: open && !!stage?.id,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const stageData = freshStage ?? stage;
  const lotsConfirmed = !!((freshStage?.input_lot_number ?? stage?.input_lot_number)?.trim());

  // ── Fetch related data ──
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

  // Auto-select FIFO lot for each bucket on load (initial lot selection)
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
      // Try to parse saved active lots from pork_lot_number field (repurposed as JSON store)
      let saved = null;
      try { saved = stageData?.pork_lot_number ? JSON.parse(stageData.pork_lot_number) : null; } catch {}
      if (saved) {
        // Refresh remaining quantities from live inventory
        const restored = {};
        for (const [bucketId, info] of Object.entries(saved)) {
          const liveRow = rawInventory.find(r => r.id === info.raw_inventory_id);
          if (liveRow) {
            restored[bucketId] = { raw_inventory_id: liveRow.id, lot_number: liveRow.lot_number || "", remaining_qty: liveRow.available_qty };
          }
        }
        if (Object.keys(restored).length > 0) setActiveLots(restored);
      } else {
        // First time opening after lot confirmation — initialize activeLots from selected lots
        // We can't restore exact remaining from the initial lot, so use live inventory qty
        const initial = {};
        for (const b of effectiveBuckets) {
          const lots = getFifoLots(rawInventory, b.bucket_id);
          if (lots.length > 0) {
            initial[b.bucket_id] = { raw_inventory_id: lots[0].id, lot_number: lots[0].lot_number || "", remaining_qty: lots[0].available_qty };
          }
        }
        if (Object.keys(initial).length > 0) setActiveLots(initial);
      }
    }
  }, [lotsConfirmed, rawInventory.length, effectiveBuckets.length]);

  // ── Plan & rack state ──
  const plan = useMemo(() => stageData ? buildPlan(stageData.input_qty_lbs || 0) : null, [stageData?.input_qty_lbs]);

  const completedRacks = useMemo(() => {
    const map = {};
    for (const sb of stageData?.sub_batches || []) {
      const rackNum = sb.rack_number ?? (sb.sub_batch_id?.startsWith("rack-") ? parseInt(sb.sub_batch_id.split("-")[1]) : null);
      if (rackNum) {
        map[rackNum] = { completed: true, lbs: sb.lbs ?? sb.qty_lbs ?? RACK_LBS, lot_number: sb.lot_number || "", raw_lots: sb.raw_lots || [], notes: sb.notes || "", short_weight_reason: sb.short_weight_reason || "", cook_batch_number: sb.cook_batch_number };
      }
    }
    return map;
  }, [stageData?.sub_batches]);

  if (!plan || !stageData) return null;

  const completedCount = plan.racks.filter(r => completedRacks[r.rackNumber]?.completed).length;
  const lotsValid = effectiveBuckets.length > 0 && effectiveBuckets.every(b => selectedLots[b.bucket_id]?.raw_inventory_id);

  // ─── Step 1: Confirm lots — just record the lot, deduct first rack's worth only when rack completes ──
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
      });

      queryClient.invalidateQueries({ queryKey: ["rawInventory"] });
      await refetchStage();
    } catch (error) {
      console.error("Error in handleConfirmLots:", error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Step 2: Open rack edit form ──────────────────────────────────────────
  const openEditRack = (rack, autoConfirmLotChange = false) => {
    const existing = completedRacks[rack.rackNumber];
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    setEditForm({
      lot_number: existing?.lot_number || `R${rack.rackNumber}-${today}`,
      notes: existing?.notes || "",
      lbs: existing?.lbs ?? rack.lbs,
      short_weight_reason: existing?.short_weight_reason || "",
    });

    const primaryBucketId = effectiveBuckets[0]?.bucket_id;
    const rackLbs = existing?.lbs ?? rack.lbs;

    // Check if user already confirmed a lot switch for this rack (don't show split dialog again)
    if (splitConfirmedRackNumber === rack.rackNumber) {
      // Skip lot change warning if auto-confirmed from split
      if (!autoConfirmLotChange) {
        const currentActiveLotNumber = activeLots[primaryBucketId]?.lot_number;
        const lastRawLot = getLastRawLot(completedRacks[rack.rackNumber - 1]);
        const lotChanged = lastRawLot && currentActiveLotNumber && lastRawLot !== currentActiveLotNumber;
        setLotChangedFrom(lotChanged ? lastRawLot : null);
      }
      setLotChangeConfirmed(autoConfirmLotChange);
      setEditingRack(rack);
      return;
    }

    // Check if current lot has enough inventory to complete this rack
    const primaryActive = activeLots[primaryBucketId];
    const hasEnoughInCurrentLot = primaryActive?.remaining_qty >= rackLbs;

    // If not enough, show split confirmation
    if (!hasEnoughInCurrentLot && primaryActive?.remaining_qty > 0) {
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
    const lastRawLot = getLastRawLot(completedRacks[rack.rackNumber - 1]);
    const lotChanged = lastRawLot && currentActiveLotNumber && lastRawLot !== currentActiveLotNumber;
    setLotChangedFrom(lotChanged ? lastRawLot : null);
    setLotChangeConfirmed(autoConfirmLotChange);
    setEditingRack(rack);
  };

  // ─── Handle split lot confirmation (when mid-rack lot exhaustion occurs) ──
  // User confirmed the split and selected the lot — deduct from old lot, switch to selected lot
  const handleConfirmSplitLot = async () => {
    if (!splitLotConfirmation || !selectedSplitLotId) {
      console.warn("Split confirmation missing data", { splitLotConfirmation, selectedSplitLotId });
      return;
    }

    // Set saving early to prevent double-clicks or race conditions
    setSaving(true);
    try {
      const rackNumber = splitLotConfirmation.rackNumber;
      const lbs = splitLotConfirmation.weightNeeded;
      const primaryBucketId = effectiveBuckets[0]?.bucket_id;
      const currentActive = activeLots[primaryBucketId];

      // Step 1: Deduct remaining from old lot (consume it fully)
      if (currentActive?.raw_inventory_id) {
        const deductAmount = splitLotConfirmation.currentRemaining;
        const oldLotNewQty = Math.max(0, parseFloat((currentActive.remaining_qty - deductAmount).toFixed(2)));
        await base44.entities.RawInventory.update(currentActive.raw_inventory_id, {
          available_qty: oldLotNewQty,
          status: oldLotNewQty <= 0 ? "depleted" : "in_use",
        });
      }

      // Step 2: Deduct remaining needed from new lot
      const selectedLotRow = await base44.entities.RawInventory.filter({ id: selectedSplitLotId }).then(r => r?.[0]);
      if (selectedLotRow) {
        const remainingNeeded = lbs - splitLotConfirmation.currentRemaining;
        const newLotNewQty = Math.max(0, parseFloat((selectedLotRow.available_qty - remainingNeeded).toFixed(2)));
        await base44.entities.RawInventory.update(selectedSplitLotId, {
          available_qty: newLotNewQty,
          status: newLotNewQty <= 0 ? "depleted" : "in_use",
        });

        // Step 3: Switch active lot to the new lot
        const updatedActiveLots = { ...activeLots };
        updatedActiveLots[primaryBucketId] = {
          raw_inventory_id: selectedLotRow.id,
          lot_number: selectedLotRow.lot_number || "",
          remaining_qty: newLotNewQty,
        };
        setActiveLots(updatedActiveLots);

        // Persist the updated active lots
        await base44.entities.ProductionStage.update(stageData.id, {
          pork_lot_number: JSON.stringify(updatedActiveLots),
        });
      }



      // Step 5: Close split confirmation dialog
      setSplitLotConfirmation(null);
      setSelectedSplitLotId(null);

      // Step 6: Refresh inventory to reflect deductions
      await refetchInventory();

      // Step 7: Mark split as confirmed for this rack to prevent re-triggering
      // (Note: already set at line 358, but confirming sequencing)

      // Step 8: Open the rack form for final weight/notes entry
      const rackToOpen = plan.racks.find(r => r.rackNumber === rackNumber);
      if (rackToOpen) {
        setSplitConfirmedRackNumber(rackNumber);
        await new Promise(r => setTimeout(r, 50));
        openEditRack(rackToOpen, true);
      }
    } catch (error) {
      console.error("Error in handleConfirmSplitLot:", error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Switch to next lot (manual override — used when lot exhausted exactly on a rack boundary) ──
  // Note: mid-rack splits are handled automatically in handleCompleteRack.
  // This prompt only fires when a rack completes and the lot hits exactly 0.
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

      // Persist updated active lots (no deduction — rack was already fully deducted)
      await base44.entities.ProductionStage.update(stageData.id, {
        pork_lot_number: JSON.stringify(newActive),
      });

      await refetchInventory();
    } catch (error) {
      console.error("Error in handleConfirmNextLot:", error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Check for mid-rack split (lot exhaustion during rack completion) ──
  // Uses provided activeLots state (should be refreshed before calling)
  const checkSplitLotNeeded = (rackNum, lbs, lotsToCheck) => {
    const primaryBucketId = effectiveBuckets[0]?.bucket_id;
    const primaryActive = lotsToCheck[primaryBucketId];

    if (primaryActive?.remaining_qty < lbs) {
      const nextLots = getFifoLots(rawInventory, primaryBucketId).filter(l => l.id !== primaryActive?.raw_inventory_id);
      if (nextLots.length > 0) {
        const nextLot = nextLots[0];
        return {
          rackNumber: rackNum,
          currentLotNumber: primaryActive?.lot_number,
          currentRemaining: primaryActive?.remaining_qty,
          weightNeeded: lbs,
          availableLots: nextLots,
        };
      }
    }
    return null;
  };

  // ─── Step 2: Save completed rack — deduct actual weight from active lot(s) ──
  // Handles split deduction: if the active lot doesn't cover the full rack weight,
  // it deducts what's left from it, then automatically pulls the remainder from the next FIFO lot.
  const handleCompleteRack = async (skipSplitCheck = false) => {
    if (!editingRack) return;

    const rackNum = editingRack.rackNumber;
    const lbs = parseFloat(editForm.lbs) || editingRack.lbs;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const lot = editForm.lot_number.trim() || `SV-R${rackNum}-${today}`;

    try {
      // ── Refresh active lots from DB to ensure remaining_qty is current ──
      const freshActiveLots = { ...activeLots };
      for (const b of effectiveBuckets) {
        const current = activeLots[b.bucket_id];
        if (current?.raw_inventory_id) {
          const freshRow = await base44.entities.RawInventory.filter({ id: current.raw_inventory_id }).then(r => r?.[0]);
          if (freshRow) {
            freshActiveLots[b.bucket_id] = {
              raw_inventory_id: freshRow.id,
              lot_number: freshRow.lot_number || "",
              remaining_qty: freshRow.available_qty ?? 0,
            };
          }
        }
      }

        // ── Check if we'll need to split across lots before doing anything ──
      // Skip if user already confirmed the split via the split dialog
      if (!skipSplitCheck && splitConfirmedRackNumber !== rackNum) {
        const splitNeeded = checkSplitLotNeeded(rackNum, lbs, freshActiveLots);
        if (splitNeeded) {
          setSplitLotConfirmation(splitNeeded);
          return;
        }
      }

      // ── Save cook batch number before closing form ──
      const currentCookBatchNumber = editingRack.cookBatchNumber;

      // ── Close rack form, then proceed with deduction ──
      setEditingRack(null);
      setSaving(true);

      // ── Deduct rack weight from active lot(s), splitting across lots if needed ──
      const newActiveLots = { ...freshActiveLots };
      for (const b of effectiveBuckets) {
        let active = newActiveLots[b.bucket_id];
        if (!active?.raw_inventory_id) continue;

        let remaining = lbs;

        const freshRow = await base44.entities.RawInventory.filter({ id: active.raw_inventory_id }).then(r => r?.[0]);
        const currentQty = freshRow?.available_qty ?? 0;
        const takeFromFirst = Math.min(currentQty, remaining);
        const firstNewQty = parseFloat((currentQty - takeFromFirst).toFixed(2));

        await base44.entities.RawInventory.update(active.raw_inventory_id, {
          available_qty: firstNewQty,
          status: firstNewQty <= 0 ? "depleted" : "in_use",
        });
        newActiveLots[b.bucket_id] = { ...active, remaining_qty: firstNewQty };
        remaining = parseFloat((remaining - takeFromFirst).toFixed(2));

        if (remaining > 0.01) {
          const nextLots = getFifoLots(rawInventory, b.bucket_id).filter(l => l.id !== active.raw_inventory_id);
          if (nextLots.length > 0) {
            const nextLot = nextLots[0];
            const nextFreshRow = await base44.entities.RawInventory.filter({ id: nextLot.id }).then(r => r?.[0]);
            const nextCurrentQty = nextFreshRow?.available_qty ?? 0;
            const takeFromNext = Math.min(nextCurrentQty, remaining);
            const nextNewQty = parseFloat((nextCurrentQty - takeFromNext).toFixed(2));

            await base44.entities.RawInventory.update(nextLot.id, {
              available_qty: nextNewQty,
              status: nextNewQty <= 0 ? "depleted" : "in_use",
            });
            remaining = parseFloat((remaining - takeFromNext).toFixed(2));
          }
        }
      }
      setActiveLots(newActiveLots);

      const lotExhausted = primaryBucketId && newActiveLots[primaryBucketId] && newActiveLots[primaryBucketId].remaining_qty < 1;

      const latestStage = await base44.entities.ProductionStage.filter({ id: stageData.id }).then(r => r?.[0]);

      const rawLotsUsed = [...new Set(
        Object.values(newActiveLots).map(al => al.lot_number).filter(Boolean)
      )];

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
        cook_batch_number: currentCookBatchNumber,
        status: "completed",
      };

      const existingSubs = latestStage?.sub_batches || stageData.sub_batches || [];
      const newSubs = [...existingSubs.filter(sb => sb.rack_number !== rackNum), newSubBatch];

      const newCompleted = {};
      for (const sb of newSubs) {
        if (sb.rack_number) newCompleted[sb.rack_number] = { completed: true, lbs: sb.qty_lbs || sb.lbs || RACK_LBS, lot_number: sb.lot_number || "" };
      }

      await base44.entities.ProductionStage.update(stageData.id, {
        sub_batches: newSubs,
        pork_lot_number: JSON.stringify(newActiveLots),
      });

      const allRacksDone = plan.racks.every(r => newCompleted[r.rackNumber]?.completed);
      if (allRacksDone) {
        await base44.entities.ProductionStage.update(stageData.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          output_qty_lbs: parseFloat(plan.racks.reduce((s, r) => s + (newCompleted[r.rackNumber]?.lbs || r.lbs), 0).toFixed(2)),
          racks_count: plan.totalRacks,
          sub_batches: newSubs,
        });
      }

      await refetchStage();
      const refreshedStage = await base44.entities.ProductionStage.filter({ id: stageData.id }).then(r => r?.[0]);

      const cookBatch = plan.cookBatches.find(cb => cb.cookBatchNumber === currentCookBatchNumber);
      if (cookBatch && refreshedStage?.sub_batches) {
        const allRackNums = cookBatch.racks.map(r => r.rackNumber);
        const refreshedMap = {};
        for (const sb of refreshedStage.sub_batches) {
          if (sb.rack_number) refreshedMap[sb.rack_number] = { completed: true, lbs: sb.qty_lbs || sb.lbs || RACK_LBS, lot_number: sb.lot_number || "" };
        }
        const allDone = allRackNums.every(rn => refreshedMap[rn]?.completed);

        if (allDone) {
          const cookBatchLot = `SV-CB${currentCookBatchNumber}-${stageData.order_number}-${today}`;

          const existingCookStages = await base44.entities.ProductionStage.filter({
            order_id: stageData.order_id,
            capability_key: "cooking",
          });
          const alreadyExists = existingCookStages.some(s => s.cook_batch_lot === cookBatchLot);

          if (!alreadyExists) {
            const orderData = await base44.entities.ProductionOrder.filter({ id: stageData.order_id }).then(r => r?.[0]);
            const flowData = orderData?.flow_id ? await base44.entities.ProductFlow.filter({ id: orderData.flow_id }).then(r => r?.[0]) : null;
            const cookStep = flowData?.steps?.find(s => s.capability_key === "cooking");
            const cookBatchLbs = allRackNums.reduce((s, rn) => s + (refreshedMap[rn]?.lbs || RACK_LBS), 0);

            const rackLots = allRackNums.map(rn => refreshedMap[rn]?.lot_number).filter(Boolean);
            const uniqueRackLots = [...new Set(rackLots)];
            const rawLots = Object.values(newActiveLots).map(al => al.lot_number).filter(Boolean);
            const allLots = [...new Set([...rawLots, ...uniqueRackLots])];

            let cookProfileId = cookStep?.work_profile_id;
            let cookProfileName = cookStep?.work_profile_name;
            if (!cookProfileId) {
              const allProfiles = await base44.entities.WorkProfile.filter({ status: "active" });
              const cookProfile = allProfiles.find(p => (p.capability_keys || []).includes("cooking"));
              if (cookProfile) {
                cookProfileId = cookProfile.id;
                cookProfileName = cookProfile.name;
              }
            }

            await base44.entities.ProductionStage.create({
              order_id: stageData.order_id,
              order_number: stageData.order_number,
              product_name: stageData.product_name,
              step_number: refreshedStage.step_number + 1,
              capability_id: cookStep?.capability_id || "",
              capability_key: "cooking",
              capability_name: "Cooking",
              work_profile_id: cookProfileId || "",
              work_profile_name: cookProfileName || "",
              status: "available",
              input_qty_lbs: parseFloat(cookBatchLbs.toFixed(2)),
              racks_count: allRackNums.length,
              cook_batch_lot: cookBatchLot,
              input_lot_number: cookBatchLot,
              notes: `Cook Batch #${currentCookBatchNumber} — Racks ${allRackNums.join(", ")} — Raw lots: ${allLots.join(", ")}`,
            });
          }
        }
      }

      await refetchInventory();
      queryClient.invalidateQueries({ queryKey: ["orderStages", stageData.order_id] });
      queryClient.invalidateQueries({ queryKey: ["allStages"] });
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });

      setSaving(false);
      setSplitLotConfirmation(null);
      setSplitConfirmedRackNumber(null);

      if (lotExhausted && !allRacksDone) {
        setNeedsNewLot(true);
      }

      if (allRacksDone) onCompleted?.();
    } catch (error) {
      console.error("Error in handleCompleteRack:", error);
      setEditingRack(null);
      setSaving(false);
    }
  };

  const handleClose = () => {
    setEditingRack(null);
    setSplitConfirmedRackNumber(null);
    onClose();
  };

  // Primary active lot info for display
  const primaryBucketId = effectiveBuckets.length > 0 ? effectiveBuckets[0].bucket_id : null;
  const primaryActiveLot = primaryBucketId ? activeLots[primaryBucketId] : null;

  // ─── Render ───────────────────────────────────────────────────────────────
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
            <div className="ml-auto shrink-0">
              <Badge variant="outline" className="text-xs">{completedCount}/{plan.totalRacks} done</Badge>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* ── Step 1: Raw material lots ── */}
            <div className={`rounded-xl border-2 p-4 space-y-3 ${lotsConfirmed ? "border-chart-2/40 bg-chart-2/5" : "border-amber-300 bg-amber-50/40"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {lotsConfirmed
                    ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                    : <AlertCircle className="w-4 h-4 text-amber-500" />
                  }
                  <p className="font-bold text-sm">Step 1 — Confirm Raw Material</p>
                </div>
                {lotsConfirmed && <Badge className="bg-chart-2/15 text-chart-2 border-0 text-xs">Confirmed</Badge>}
              </div>

              {/* Confirmed summary with live remaining */}
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

              {/* Bucket picker (not yet confirmed) */}
              {!lotsConfirmed && (
                <div className="space-y-3">
                  {blendBuckets.length === 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Select Protein Bucket</Label>
                      <Select value={manualBucketId || ""} onValueChange={v => { setManualBucketId(v); setSelectedLots({}); }}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Choose a bucket…" />
                        </SelectTrigger>
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
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select lot (FIFO)…" />
                          </SelectTrigger>
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

            {/* ── Lot exhausted — must select next lot ── */}
            {lotsConfirmed && needsNewLot && (
              <div className="rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="font-bold text-sm text-destructive">Lot Exhausted — Select Next Lot to Continue</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  The current lot has been fully consumed. Please select the next lot to continue packing the remaining racks.
                </p>
                {effectiveBuckets.map(bucket => {
                  const freshLots = getFifoLots(rawInventory, bucket.bucket_id);
                  const sel = nextLotSelection[bucket.bucket_id];
                  return (
                    <div key={bucket.bucket_id} className="space-y-1.5">
                      <Label className="text-xs font-semibold">{bucket.bucket_name} — Next Lot</Label>
                      <Select
                        value={sel?.raw_inventory_id || ""}
                        onValueChange={val => {
                          const row = rawInventory.find(r => r.id === val);
                          if (row) setNextLotSelection(prev => ({ ...prev, [bucket.bucket_id]: { raw_inventory_id: row.id, lot_number: row.lot_number || "", available_qty: row.available_qty } }));
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select next lot…" />
                        </SelectTrigger>
                        <SelectContent>
                          {freshLots.length === 0 && <SelectItem value="__none__" disabled>No more inventory available</SelectItem>}
                          {freshLots.map((lot, i) => (
                            <SelectItem key={lot.id} value={lot.id}>
                              {i === 0 ? "⭑ " : ""}{lot.lot_number || lot.id} — {lot.available_qty} lbs
                              {lot.received_date ? ` (rcvd ${lot.received_date})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {sel?.lot_number && (
                        <div className="rounded bg-muted/40 border px-3 py-1.5 text-xs flex justify-between">
                          <span className="font-mono font-semibold">{sel.lot_number}</span>
                          <span className="text-muted-foreground">{sel.available_qty} lbs on hand</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button
                  className="w-full h-9 gap-2"
                  disabled={saving || !effectiveBuckets.every(b => nextLotSelection[b.bucket_id]?.raw_inventory_id)}
                  onClick={handleConfirmNextLot}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Switching…" : "Switch to Next Lot & Continue"}
                </Button>
              </div>
            )}

            {/* ── Step 2: Cook batches / racks ── */}
            {lotsConfirmed && plan.cookBatches.map(cb => {
              const completedInBatch = cb.racks.filter(r => completedRacks[r.rackNumber]?.completed).length;
              const batchComplete = completedInBatch === cb.racks.length;

              return (
                <div key={cb.cookBatchNumber} className={`rounded-xl border-2 ${batchComplete ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-card"}`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      {batchComplete
                        ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                        : <Circle className="w-4 h-4 text-muted-foreground" />
                      }
                      <p className="font-bold text-sm">Cook Batch #{cb.cookBatchNumber}</p>
                      <span className="text-xs text-muted-foreground">{cb.totalLbs} lbs · {cb.racks.length} racks</span>
                    </div>
                    {batchComplete
                      ? <Badge className="bg-chart-2/15 text-chart-2 border-0 text-xs">Sent to Cooking</Badge>
                      : <Badge variant="outline" className="text-xs">{completedInBatch}/{cb.racks.length} racks</Badge>
                    }
                  </div>

                  {/* Rack grid — hidden when batch is complete */}
                  {!batchComplete && (
                    <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {cb.racks.map(rack => {
                        const rd = completedRacks[rack.rackNumber];
                        const done = !!rd?.completed;
                        // Block tapping if lot is exhausted and needs a new one
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
                              {done
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                                : blocked
                                  ? <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                                  : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              }
                              <span className="text-xs font-bold">Rack #{rack.rackNumber}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{done ? `${rd.lbs} lbs` : `~${rack.lbs} lbs`}</p>
                            {done && rd.raw_lots?.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {rd.raw_lots.map((rl, i) => (
                                  <p key={i} className="text-xs font-mono text-chart-2 truncate">{rl}</p>
                                ))}
                              </div>
                            )}
                            {done && !rd.raw_lots?.length && rd.lot_number && <p className="text-xs font-mono text-chart-2 truncate">{rd.lot_number}</p>}
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
        </DialogContent>
      </Dialog>

      {/* Split lot confirmation dialog */}
      {splitLotConfirmation && (
        <Dialog open={!!splitLotConfirmation} onOpenChange={open => { if (!open) { setSplitLotConfirmation(null); setSelectedSplitLotId(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm Lot Switch for Rack #{splitLotConfirmation.rackNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">Current lot will be exhausted:</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-700">Lot:</span>
                    <span className="font-mono font-semibold text-amber-900">{splitLotConfirmation.currentLotNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">Will deduct:</span>
                    <span className="font-semibold text-amber-900">{splitLotConfirmation.currentRemaining.toFixed(1)} lbs</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Select lot for remaining {(splitLotConfirmation.weightNeeded - splitLotConfirmation.currentRemaining).toFixed(1)} lbs</Label>
                <Select value={selectedSplitLotId || ""} onValueChange={setSelectedSplitLotId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose a lot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {splitLotConfirmation.availableLots?.map((lot, i) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {i === 0 ? "⭑ " : ""}{lot.lot_number || lot.id} — {lot.available_qty} lbs
                        {lot.received_date ? ` (rcvd ${lot.received_date})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setSplitLotConfirmation(null); setSelectedSplitLotId(null); }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 gap-2"
                  onClick={handleConfirmSplitLot}
                  disabled={saving || !selectedSplitLotId}
                >
                  {saving ? "Switching…" : "Confirm & Continue"}
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

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Actual Weight (lbs)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="610"
                  value={editForm.lbs || ""}
                  onChange={e => {
                    const val = e.target.value.trim();
                    const num = val ? parseFloat(val) : 0;
                    setEditForm(f => ({ ...f, lbs: isNaN(num) ? 0 : Math.min(610, Math.max(0, num)) }));
                  }}
                  className="h-11"
                />
              </div>

              {parseFloat(editForm.lbs) > 0 && parseFloat(editForm.lbs) < RACK_LBS && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-amber-600">Short Weight Reason (required)</Label>
                  <Textarea
                    value={editForm.short_weight_reason}
                    onChange={e => setEditForm(f => ({ ...f, short_weight_reason: e.target.value }))}
                    placeholder="Why is this rack below 610 lbs?"
                    className="h-16"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Lot Number</Label>
                <Input
                  value={editForm.lot_number}
                  onChange={e => setEditForm(f => ({ ...f, lot_number: e.target.value }))}
                  placeholder={`SV-R${editingRack.rackNumber}-...`}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Notes (optional)</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any observations…"
                  className="h-16"
                />
              </div>

              {/* Lot change confirmation — shown when the active lot switched since the previous rack */}
              {lotChangedFrom && (
                <div className={`rounded-lg border-2 p-3 space-y-2 ${lotChangeConfirmed ? "border-chart-2/40 bg-chart-2/5" : "border-amber-400 bg-amber-50"}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${lotChangeConfirmed ? "text-chart-2" : "text-amber-500"}`} />
                    <div>
                      <p className="text-xs font-bold text-amber-700">Lot Change Detected</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Previous rack used lot <span className="font-mono font-semibold">{lotChangedFrom}</span>.
                        This rack will use lot <span className="font-mono font-semibold">{primaryActiveLot?.lot_number}</span>.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lotChangeConfirmed}
                      onChange={e => setLotChangeConfirmed(e.target.checked)}
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="text-xs font-semibold">I confirm the correct lot is loaded for this rack</span>
                  </label>
                </div>
              )}

              {editingRack.rackNumber === plan.cookBatches.find(cb => cb.cookBatchNumber === editingRack.cookBatchNumber)?.racks.slice(-1)[0]?.rackNumber && (
                <div className="flex items-start gap-2 rounded-lg bg-chart-1/10 border border-chart-1/20 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-chart-1 shrink-0 mt-0.5" />
                  <p className="text-xs text-chart-1 font-medium">
                    Last rack in Cook Batch #{editingRack.cookBatchNumber} — completing it will automatically send the batch to cooking.
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