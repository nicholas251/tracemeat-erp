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
import { CheckCircle2, Circle, Package, AlertCircle } from "lucide-react";

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

  // ── Fetch fresh stage from DB every time dialog opens ──
  const { data: freshStage, refetch: refetchStage } = useQuery({
    queryKey: ["svStage", stage?.id],
    queryFn: () => base44.entities.ProductionStage.filter({ id: stage.id }).then(r => r?.[0]),
    enabled: open && !!stage?.id,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const stageData = freshStage || stage;
  const lotsConfirmed = !!stageData?.input_lot_number;

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

  const { data: rawInventory = [] } = useQuery({
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

  // ── Plan & rack state derived from DB ──
  const plan = useMemo(() => stageData ? buildPlan(stageData.input_qty_lbs || 0) : null, [stageData?.input_qty_lbs]);

  // Rack completion state comes purely from sub_batches in the DB
  const completedRacks = useMemo(() => {
    const map = {};
    for (const sb of stageData?.sub_batches || []) {
      if (sb.rack_number) {
        map[sb.rack_number] = { completed: true, lbs: sb.lbs || RACK_LBS, lot_number: sb.lot_number || "", notes: sb.notes || "", short_weight_reason: sb.short_weight_reason || "", cook_batch_number: sb.cook_batch_number };
      }
    }
    return map;
  }, [stageData?.sub_batches]);

  if (!plan || !stageData) return null;

  const completedCount = plan.racks.filter(r => completedRacks[r.rackNumber]?.completed).length;
  const lotsValid = effectiveBuckets.length > 0 && effectiveBuckets.every(b => selectedLots[b.bucket_id]?.raw_inventory_id);

  // ─── Step 1: Confirm lots (deduct all inventory upfront) ──────────────────
  const handleConfirmLots = async () => {
    setSaving(true);
    const primaryLot = selectedLots[effectiveBuckets[0]?.bucket_id]?.lot_number || "";

    // Deduct all inventory now (upfront), proportional to stage qty
    for (const b of effectiveBuckets) {
      const sel = selectedLots[b.bucket_id];
      if (!sel?.raw_inventory_id) continue;
      const freshRow = await base44.entities.RawInventory.filter({ id: sel.raw_inventory_id }).then(r => r?.[0]);
      if (freshRow) {
        const deduct = b.quantity_lbs || stageData.input_qty_lbs || 0;
        const newQty = Math.max(0, (freshRow.available_qty || 0) - deduct);
        await base44.entities.RawInventory.update(sel.raw_inventory_id, {
          available_qty: parseFloat(newQty.toFixed(2)),
          status: newQty <= 0 ? "depleted" : "in_use",
        });
      }
    }

    await base44.entities.ProductionStage.update(stageData.id, {
      input_lot_number: primaryLot,
      status: "in_progress",
      started_at: stageData.started_at || new Date().toISOString(),
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

  // ─── Step 2: Save completed rack ─────────────────────────────────────────
  const handleCompleteRack = async () => {
    if (!editingRack) return;
    setSaving(true);

    const rackNum = editingRack.rackNumber;
    const lbs = parseFloat(editForm.lbs) || editingRack.lbs;
    const lot = editForm.lot_number.trim() || `SV-R${rackNum}-${Date.now()}`;

    const newSubBatch = {
      sub_batch_id: `rack-${rackNum}`,
      rack_number: rackNum,
      label: `Rack #${rackNum}`,
      lbs,
      lot_number: lot,
      notes: editForm.notes,
      short_weight_reason: lbs < RACK_LBS ? editForm.short_weight_reason : null,
      cook_batch_number: editingRack.cookBatchNumber,
      status: "completed",
    };

    // Merge with existing sub_batches (replace same rack_number if re-saving)
    const existingSubs = stageData.sub_batches || [];
    const newSubs = [...existingSubs.filter(sb => sb.rack_number !== rackNum), newSubBatch];

    // Build updated completed map for logic checks
    const newCompleted = {};
    for (const sb of newSubs) {
      if (sb.rack_number) newCompleted[sb.rack_number] = { completed: true, lbs: sb.lbs || RACK_LBS, lot_number: sb.lot_number || "" };
    }

    // Save rack progress
    await base44.entities.ProductionStage.update(stageData.id, {
      sub_batches: newSubs,
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
    queryClient.invalidateQueries({ queryKey: ["orderStages", stageData.order_id] });
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });

    setSaving(false);
    setEditingRack(null);

    if (allRacksDone) onCompleted?.();
  };

  const handleClose = () => {
    setEditingRack(null);
    onClose();
  };

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

              {/* Confirmed summary */}
              {lotsConfirmed && (
                <div className="rounded bg-chart-2/5 border border-chart-2/20 px-3 py-2 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">Input Lot</span>
                  <span className="font-mono font-semibold">{stageData.input_lot_number}</span>
                </div>
              )}

              {/* Bucket picker (not yet confirmed) */}
              {!lotsConfirmed && (
                <div className="space-y-3">
                  {/* Manual bucket selection if product has no blend_ingredients */}
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

                  {/* Per-bucket lot pickers */}
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
                      {saving ? "Saving…" : "Confirm & Deduct Inventory"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ── Step 2: Cook batches / racks ── */}
            {lotsConfirmed && plan.cookBatches.map(cb => {
              const completedInBatch = cb.racks.filter(r => completedRacks[r.rackNumber]?.completed).length;
              const batchComplete = completedInBatch === cb.racks.length;

              return (
                <div key={cb.cookBatchNumber} className={`rounded-xl border-2 ${batchComplete ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-card"}`}>
                  {/* Batch header */}
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

                  {/* Rack grid */}
                  <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {cb.racks.map(rack => {
                      const rd = completedRacks[rack.rackNumber];
                      const done = !!rd?.completed;
                      return (
                        <button
                          key={rack.rackNumber}
                          onClick={() => !done && openEditRack(rack)}
                          disabled={done}
                          className={`text-left rounded-lg border-2 p-3 transition-all ${
                            done
                              ? "border-chart-2/40 bg-chart-2/8 cursor-default"
                              : "border-border hover:border-chart-1/50 hover:bg-chart-1/5 cursor-pointer active:scale-95"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            {done
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                              : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            }
                            <span className="text-xs font-bold">Rack #{rack.rackNumber}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{done ? `${rd.lbs} lbs` : `~${rack.lbs} lbs`}</p>
                          {done && rd.lot_number && <p className="text-xs font-mono text-chart-2 truncate">{rd.lot_number}</p>}
                          {!done && <p className="text-xs text-chart-1 font-semibold mt-0.5">Tap to complete</p>}
                        </button>
                      );
                    })}
                  </div>
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