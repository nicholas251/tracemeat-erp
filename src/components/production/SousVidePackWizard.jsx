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
        map[rackNum] = { completed: true, lbs: sb.lbs ?? sb.qty_lbs ?? RACK_LBS, lot_number: sb.lot_number || "", notes: sb.notes || "", short_weight_reason: sb.short_weight_reason || "", cook_batch_number: sb.cook_batch_number };
      }
    }
    return map;
  }, [stageData?.sub_batches]);

  if (!plan || !stageData) return null;

  const completedCount = plan.racks.filter(r => completedRacks[r.rackNumber]?.completed).length;
  const lotsValid = effectiveBuckets.length > 0 && effectiveBuckets.every(b => selectedLots[b.bucket_id]?.raw_inventory_id);

  // ── Compute total lbs already deducted (from completed racks) per bucket ──
  // For a single-bucket product, all rack lbs come from one bucket
  const totalDeductedLbs = plan.racks
    .filter(r => completedRacks[r.rackNumber]?.completed)
    .reduce((s, r) => s + (completedRacks[r.rackNumber]?.lbs || r.lbs), 0);

  // ─── Step 1: Confirm lots — just record the lot, deduct first rack's worth only when rack completes ──
  const handleConfirmLots = async () => {
    setSaving(true);
    const primaryLot = selectedLots[effectiveBuckets[0]?.bucket_id]?.lot_number || "";

    // Initialize activeLots from selected lots
    const initial = {};
    for (const b of effectiveBuckets) {
      const sel = selectedLots[b.bucket_id];
      if (sel?.raw_inventory_id) {
        const freshRow = await base44.entities.RawInventory.filter({ id: sel.raw_inventory_id }).then(r => r?.[0]);
        initial[b.bucket_id] = {
          raw_inventory_id: sel.raw_inventory_id,
          lot_number: sel.lot_number,
          remaining_qty: freshRow?.available_qty ?? sel.available_qty ?? 0,
        };
      }
    }
    setActiveLots(initial);

    await base44.entities.ProductionStage.update(stageData.id, {
      input_lot_number: primaryLot,
      status: "in_progress",
      started_at: stageData.started_at || new Date().toISOString(),
      // Persist active lots as JSON so we can restore on remount
      pork_lot_number: JSON.stringify(initial),
    });

    queryClient.invalidateQueries({ queryKey: ["rawInventory"] });
    await refetchStage();
    setSaving(false);
  };

  // ─── Step 2: Open rack edit form ──────────────────────────────────────────
  const openEditRack = (rack) => {
    const existing = completedRacks[rack.rackNumber];
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    setEditForm({
      lot_number: existing?.lot_number || `R${rack.rackNumber}-${today}`,
      notes: existing?.notes || "",
      lbs: existing?.lbs ?? rack.lbs,
      short_weight_reason: existing?.short_weight_reason || "",
    });
    setEditingRack(rack);
  };

  // ─── Switch to next lot ───────────────────────────────────────────────────
  const handleConfirmNextLot = async () => {
    setSaving(true);
    const newActive = { ...activeLots };

    for (const b of effectiveBuckets) {
      const sel = nextLotSelection[b.bucket_id];
      if (!sel?.raw_inventory_id) continue;
      const freshRow = await base44.entities.RawInventory.filter({ id: sel.raw_inventory_id }).then(r => r?.[0]);
      newActive[b.bucket_id] = {
        raw_inventory_id: sel.raw_inventory_id,
        lot_number: sel.lot_number,
        remaining_qty: freshRow?.available_qty ?? sel.available_qty ?? 0,
      };
    }

    setActiveLots(newActive);
    setNextLotSelection({});
    setNeedsNewLot(false);

    // Persist updated active lots
    await base44.entities.ProductionStage.update(stageData.id, {
      pork_lot_number: JSON.stringify(newActive),
    });

    await refetchInventory();
    setSaving(false);
  };

  // ─── Step 2: Save completed rack — deduct actual weight from active lot ────
  const handleCompleteRack = async () => {
    if (!editingRack) return;
    setSaving(true);

    const rackNum = editingRack.rackNumber;
    const lbs = parseFloat(editForm.lbs) || editingRack.lbs;
    const lot = editForm.lot_number.trim() || `SV-R${rackNum}-${Date.now()}`;

    // ── Deduct actual rack weight from active lot(s) ──
    const newActiveLots = { ...activeLots };
    for (const b of effectiveBuckets) {
      const active = newActiveLots[b.bucket_id];
      if (!active?.raw_inventory_id) continue;

      // Fetch the freshest available qty from DB
      const freshRow = await base44.entities.RawInventory.filter({ id: active.raw_inventory_id }).then(r => r?.[0]);
      const currentQty = freshRow?.available_qty ?? 0;
      const newQty = Math.max(0, currentQty - lbs);

      await base44.entities.RawInventory.update(active.raw_inventory_id, {
        available_qty: parseFloat(newQty.toFixed(2)),
        status: newQty <= 0 ? "depleted" : "in_use",
      });

      newActiveLots[b.bucket_id] = { ...active, remaining_qty: newQty };
    }
    setActiveLots(newActiveLots);

    // Check if any active lot is now exhausted (or close to it — less than 1 rack worth)
    const primaryBucketId = effectiveBuckets[0]?.bucket_id;
    const primaryActive = newActiveLots[primaryBucketId];
    const lotExhausted = primaryActive && primaryActive.remaining_qty < 1;

    // Always fetch the freshest stage from DB before merging sub_batches
    const latestStage = await base44.entities.ProductionStage.filter({ id: stageData.id }).then(r => r?.[0]);

    const newSubBatch = {
      sub_batch_id: `rack-${rackNum}`,
      rack_number: rackNum,
      label: `Rack #${rackNum}`,
      lbs,
      qty_lbs: lbs,
      lot_number: lot,
      notes: editForm.notes,
      short_weight_reason: lbs < RACK_LBS ? editForm.short_weight_reason : null,
      cook_batch_number: editingRack.cookBatchNumber,
      status: "completed",
    };

    const existingSubs = latestStage?.sub_batches || stageData.sub_batches || [];
    const newSubs = [...existingSubs.filter(sb => sb.rack_number !== rackNum), newSubBatch];

    const newCompleted = {};
    for (const sb of newSubs) {
      if (sb.rack_number) newCompleted[sb.rack_number] = { completed: true, lbs: sb.lbs || RACK_LBS, lot_number: sb.lot_number || "" };
    }

    // Save rack progress + persist updated active lots
    await base44.entities.ProductionStage.update(stageData.id, {
      sub_batches: newSubs,
      pork_lot_number: JSON.stringify(newActiveLots),
    });

    // Check if cook batch is now complete → create cooking stage
    const cookBatch = plan.cookBatches.find(cb => cb.cookBatchNumber === editingRack.cookBatchNumber);
    if (cookBatch) {
      const allRackNums = cookBatch.racks.map(r => r.rackNumber);
      const allDone = allRackNums.every(rn => newCompleted[rn]?.completed);

      if (allDone) {
        const existingCookStages = await base44.entities.ProductionStage.filter({
          order_id: stageData.order_id,
          capability_key: "cooking",
        });
        const alreadyExists = existingCookStages.some(s => s.notes?.includes(`Cook Batch #${editingRack.cookBatchNumber}`));

        if (!alreadyExists) {
          const orderData = await base44.entities.ProductionOrder.filter({ id: stageData.order_id }).then(r => r?.[0]);
          const flowData = orderData?.flow_id ? await base44.entities.ProductFlow.filter({ id: orderData.flow_id }).then(r => r?.[0]) : null;
          const cookStep = flowData?.steps?.find(s => s.capability_key === "cooking");
          const cookBatchLbs = allRackNums.reduce((s, rn) => s + (newCompleted[rn]?.lbs || RACK_LBS), 0);

          await base44.entities.ProductionStage.create({
            order_id: stageData.order_id,
            order_number: stageData.order_number,
            product_name: stageData.product_name,
            step_number: stageData.step_number + 1,
            capability_id: cookStep?.capability_id || "",
            capability_key: "cooking",
            capability_name: "Cooking",
            work_profile_id: cookStep?.work_profile_id || "",
            work_profile_name: cookStep?.work_profile_name || "",
            status: "available",
            input_qty_lbs: parseFloat(cookBatchLbs.toFixed(2)),
            racks_count: allRackNums.length,
            input_lot_number: `SV-CB${editingRack.cookBatchNumber}-${Date.now()}`,
            notes: `Cook Batch #${editingRack.cookBatchNumber} — Racks ${allRackNums.join(", ")}`,
          });
        }
      }
    }

    // Check if ALL racks done → complete the stage
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
    await refetchInventory();
    queryClient.invalidateQueries({ queryKey: ["orderStages", stageData.order_id] });
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });

    setSaving(false);
    setEditingRack(null);

    // After closing the rack dialog, check if lot is now exhausted and more racks remain
    if (lotExhausted && !allRacksDone) {
      setNeedsNewLot(true);
    }

    if (allRacksDone) onCompleted?.();
  };

  const handleClose = () => {
    setEditingRack(null);
    onClose();
  };

  // Primary active lot info for display
  const primaryBucketId = effectiveBuckets[0]?.bucket_id;
  const primaryActiveLot = activeLots[primaryBucketId];

  // Next-lot FIFO candidates (exclude currently active lot)
  const nextLotCandidates = primaryBucketId
    ? getFifoLots(rawInventory, primaryBucketId).filter(l => l.id !== primaryActiveLot?.raw_inventory_id)
    : [];

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
                            {done && rd.lot_number && <p className="text-xs font-mono text-chart-2 truncate">{rd.lot_number}</p>}
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
                  value={editForm.lbs}
                  onChange={e => setEditForm(f => ({ ...f, lbs: Math.min(610, Math.max(0, parseFloat(e.target.value) || 0)) }))}
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
                    (parseFloat(editForm.lbs) < RACK_LBS && !editForm.short_weight_reason?.trim())
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