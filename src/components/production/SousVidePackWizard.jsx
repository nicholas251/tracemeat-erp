import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, Package, ChevronRight, AlertCircle, Trash2, Plus } from "lucide-react";

const RACK_LBS = 610;
const RACKS_PER_COOK_BATCH = 3;
const COOK_BATCH_LBS = RACK_LBS * RACKS_PER_COOK_BATCH; // 1830

function buildFifoAllocations(inventoryRows, requiredLbs) {
  const sorted = [...inventoryRows]
    .filter(r => (r.available_qty || 0) > 0)
    .sort((a, b) => {
      const da = a.received_date || a.created_date || "";
      const db = b.received_date || b.created_date || "";
      return da < db ? -1 : da > db ? 1 : 0;
    });
  const allocations = [];
  let remaining = requiredLbs;
  for (const row of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(row.available_qty, remaining);
    allocations.push({ lot_number: row.lot_number || "", available_qty: row.available_qty, raw_inventory_id: row.id, actual_lbs: parseFloat(take.toFixed(2)) });
    remaining -= take;
  }
  if (allocations.length === 0 || remaining > 0.001) {
    allocations.push({ lot_number: "", available_qty: 0, raw_inventory_id: null, actual_lbs: parseFloat(remaining.toFixed(2)), insufficient: true });
  }
  return allocations;
}

function buildRackPlan(totalLbs) {
  const totalRacks = Math.ceil(totalLbs / RACK_LBS);
  const totalCookBatches = Math.ceil(totalRacks / RACKS_PER_COOK_BATCH);
  const racks = [];

  for (let i = 0; i < totalRacks; i++) {
    const isLastRack = i === totalRacks - 1;
    const rackLbs = isLastRack ? totalLbs - RACK_LBS * i : RACK_LBS;
    const cookBatchIndex = Math.floor(i / RACKS_PER_COOK_BATCH);
    racks.push({
      rackNumber: i + 1,
      lbs: parseFloat(rackLbs.toFixed(2)),
      cookBatchIndex,
      cookBatchNumber: cookBatchIndex + 1,
    });
  }

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

export default function SousVidePackWizard({ stage, open, onClose, onCompleted }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  // Track which racks are marked complete + their lot numbers and notes
  const [rackData, setRackData] = useState({});
  // Which rack is being edited
  const [editingRack, setEditingRack] = useState(null);
  const [editForm, setEditForm] = useState({ lot_number: "", notes: "", lbs: "" });
  // Raw material lot allocations for chicken
  const [lotAllocations, setLotAllocations] = useState(null);
  const [lotsConfirmed, setLotsConfirmed] = useState(false);

  const { data: order } = useQuery({
    queryKey: ["svOrder", stage?.order_id],
    queryFn: () => base44.entities.ProductionOrder.filter({ id: stage.order_id }).then(r => r?.[0]),
    enabled: open && !!stage,
  });

  const { data: flow } = useQuery({
    queryKey: ["svFlow", order?.flow_id],
    queryFn: () => base44.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]),
    enabled: !!order?.flow_id,
    staleTime: Infinity,
  });

  const { data: product } = useQuery({
    queryKey: ["svProduct", order?.product_id],
    queryFn: () => base44.entities.Product.filter({ id: order.product_id }).then(r => r?.[0]),
    enabled: !!order?.product_id,
    staleTime: Infinity,
  });

  // Derive the protein buckets this product uses from blend_ingredients
  const blendBuckets = product?.blend_ingredients || [];

  // Fetch raw inventory for all relevant buckets
  const { data: rawInventoryAll = [] } = useQuery({
    queryKey: ["rawInventory", blendBuckets.map(b => b.bucket_id).join(",")],
    queryFn: async () => {
      if (!blendBuckets.length) return [];
      const results = await Promise.all(
        blendBuckets.map(b => base44.entities.RawInventory.filter({ bucket_id: b.bucket_id }))
      );
      return results.flat();
    },
    enabled: open && blendBuckets.length > 0,
  });

  // Auto-init FIFO allocations once inventory + product loads
  useEffect(() => {
    if (rawInventoryAll.length > 0 && !lotAllocations && stage) {
      setLotAllocations(buildFifoAllocations(rawInventoryAll, stage.input_qty_lbs || 0));
    }
  }, [rawInventoryAll, lotAllocations, stage]);

  // Also restore confirmed state from saved stage data
  useEffect(() => {
    if (stage?.input_lot_number) {
      setLotsConfirmed(true);
    }
  }, [stage]);

  const plan = useMemo(() => {
    if (!stage) return null;
    return buildRackPlan(stage.input_qty_lbs || 0);
  }, [stage]);

  // Load persisted sub_batches from the stage to restore state
  const persistedRacks = useMemo(() => {
    const result = {};
    for (const sb of stage?.sub_batches || []) {
      if (sb.rack_number) {
        result[sb.rack_number] = { completed: true, lot_number: sb.lot_number || "", notes: sb.notes || "", lbs: sb.lbs || RACK_LBS };
      }
    }
    return result;
  }, [stage]);

  const effectiveRackData = { ...persistedRacks, ...rackData };

  const updateAllocation = (idx, field, value) => {
    setLotAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const addLotRow = () => {
    const total = (lotAllocations || []).reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0);
    setLotAllocations(prev => [...(prev || []), { lot_number: "", available_qty: 0, raw_inventory_id: null, actual_lbs: parseFloat(Math.max(0, (stage?.input_qty_lbs || 0) - total).toFixed(2)) }]);
  };

  const removeLotRow = (idx) => {
    setLotAllocations(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmLots = async () => {
    setSaving(true);
    // Save lot info onto stage and deduct raw inventory
    const primaryLot = lotAllocations?.[0]?.lot_number || "";
    await base44.entities.ProductionStage.update(stage.id, {
      input_lot_number: primaryLot,
    });
    // Deduct from each raw inventory lot
    for (const alloc of (lotAllocations || [])) {
      if (alloc.raw_inventory_id && alloc.actual_lbs > 0) {
        const row = rawInventoryAll.find(r => r.id === alloc.raw_inventory_id);
        if (row) {
          const newQty = Math.max(0, (row.available_qty || 0) - alloc.actual_lbs);
          await base44.entities.RawInventory.update(alloc.raw_inventory_id, {
            available_qty: parseFloat(newQty.toFixed(2)),
            status: newQty <= 0 ? "depleted" : "in_use",
          });
        }
      }
    }
    setLotsConfirmed(true);
    queryClient.invalidateQueries({ queryKey: ["rawInventory"] });
    setSaving(false);
  };

  const totalAllocated = (lotAllocations || []).reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0);
  const lotsValid = (lotAllocations || []).every(a => a.lot_number?.trim()) && Math.abs(totalAllocated - (stage?.input_qty_lbs || 0)) < 0.01;

  const openEditRack = (rack) => {
    setEditingRack(rack);
    const existing = effectiveRackData[rack.rackNumber];
    setEditForm({
      lot_number: existing?.lot_number || "",
      notes: existing?.notes || "",
      lbs: existing?.lbs ?? rack.lbs,
    });
  };

  const handleCompleteRack = async () => {
    if (!editingRack) return;
    setSaving(true);
    const rackNum = editingRack.rackNumber;
    const lbs = parseFloat(editForm.lbs) || editingRack.lbs;
    const lot = editForm.lot_number || `SV-R${rackNum}-${Date.now()}`;

    const updatedRackData = {
      ...effectiveRackData,
      [rackNum]: { completed: true, lot_number: lot, notes: editForm.notes, lbs },
    };
    setRackData(updatedRackData);

    // Build new sub_batches array
    const newSubBatch = {
      sub_batch_id: `rack-${rackNum}-${Date.now()}`,
      rack_number: rackNum,
      label: `Rack #${rackNum}`,
      lbs,
      lot_number: lot,
      notes: editForm.notes,
      cook_batch_number: editingRack.cookBatchNumber,
      status: "completed",
    };
    const existingSubs = (stage.sub_batches || []).filter(sb => sb.rack_number !== rackNum);
    const updatedSubs = [...existingSubs, newSubBatch];

    await base44.entities.ProductionStage.update(stage.id, {
      status: "in_progress",
      started_at: stage.started_at || new Date().toISOString(),
      sub_batches: updatedSubs,
    });

    // Check if the cook batch this rack belongs to is now complete
    const cookBatch = plan.cookBatches.find(cb => cb.cookBatchNumber === editingRack.cookBatchNumber);
    if (cookBatch) {
      const allRacksInBatch = cookBatch.racks.map(r => r.rackNumber);
      const completedInBatch = allRacksInBatch.filter(rn => updatedRackData[rn]?.completed);
      const batchComplete = completedInBatch.length === allRacksInBatch.length;

      if (batchComplete) {
        // Fire off a cooking stage for this cook batch
        const flowSteps = flow?.steps || [];
        const cookStep = flowSteps.find(s => s.capability_key === "cooking");
        if (cookStep) {
          const cookBatchLbs = cookBatch.racks.reduce((s, r) => s + (updatedRackData[r.rackNumber]?.lbs || r.lbs), 0);
          const cookBatchLot = `SV-CB${editingRack.cookBatchNumber}-${Date.now()}`;
          // Check if already created (guard against double-tap)
          const existingCookStages = await base44.entities.ProductionStage.filter({
            order_id: stage.order_id,
            capability_key: "cooking",
          });
          const alreadyExists = existingCookStages.some(s => s.notes?.includes(`Cook Batch #${editingRack.cookBatchNumber}`));
          if (!alreadyExists) {
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
              input_qty_lbs: parseFloat(cookBatchLbs.toFixed(2)),
              racks_count: allRacksInBatch.length,
              cook_batch_lot: cookBatchLot,
              input_lot_number: cookBatchLot,
              notes: `Cook Batch #${editingRack.cookBatchNumber} — Racks ${allRacksInBatch.join(", ")}`,
            });
          }
        }
      }
    }

    // Check if ALL racks are done → mark the sous vide pack stage as completed
    const allRacksDone = plan.racks.every(r => updatedRackData[r.rackNumber]?.completed);
    if (allRacksDone) {
      await base44.entities.ProductionStage.update(stage.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        output_qty_lbs: plan.racks.reduce((s, r) => s + (updatedRackData[r.rackNumber]?.lbs || r.lbs), 0),
        racks_count: plan.totalRacks,
        sub_batches: updatedSubs,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["orderStages", stage.order_id] });
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });

    setSaving(false);
    setEditingRack(null);
    onCompleted?.();
  };

  if (!plan) return null;

  const completedCount = plan.racks.filter(r => effectiveRackData[r.rackNumber]?.completed).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-card shrink-0">
          <div className="w-10 h-10 rounded-xl bg-chart-1/15 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-chart-1" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold leading-tight">Sous Vide Pack — {stage?.product_name}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order <span className="font-semibold text-foreground">#{stage?.order_number}</span>
              &nbsp;·&nbsp;<span className="font-semibold text-foreground">{stage?.input_qty_lbs} lbs</span>
              &nbsp;·&nbsp;{plan.totalRacks} racks &nbsp;·&nbsp; {plan.cookBatches.length} cook batches
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <Badge variant="outline" className="text-xs">
              {completedCount}/{plan.totalRacks} racks done
            </Badge>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Raw Material Lot Section */}
          <div className={`rounded-xl border-2 p-4 space-y-3 ${lotsConfirmed ? "border-chart-2/40 bg-chart-2/5" : "border-amber-300 bg-amber-50/30"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lotsConfirmed
                  ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                  : <AlertCircle className="w-4 h-4 text-amber-500" />
                }
                <p className="font-bold text-sm">{blendBuckets.map(b => b.bucket_name).join(", ") || "Raw Material"}</p>
                <span className="text-xs text-muted-foreground">{stage?.input_qty_lbs} lbs required</span>
              </div>
              {lotsConfirmed && <Badge className="bg-chart-2/15 text-chart-2 border-0 text-xs">Confirmed</Badge>}
            </div>

            {!lotsConfirmed && (
              <div className="space-y-2">
                {(lotAllocations || []).map((alloc, idx) => (
                  <div key={idx} className={`rounded border p-2 space-y-1.5 ${alloc.insufficient ? "border-amber-300 bg-amber-50" : "border-border bg-white"}`}>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Lot {idx + 1}</span>
                      {alloc.available_qty > 0 && <span>· {alloc.available_qty} lbs available</span>}
                      {(lotAllocations || []).length > 1 && (
                        <button onClick={() => removeLotRow(idx)} className="ml-auto hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Lot Number</Label>
                        <Input value={alloc.lot_number} onChange={e => updateAllocation(idx, "lot_number", e.target.value)} placeholder="e.g. 050626" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Qty (lbs)</Label>
                        <Input type="number" step="0.1" value={alloc.actual_lbs} onChange={e => updateAllocation(idx, "actual_lbs", Number(e.target.value))} className="h-9 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 border border-dashed text-xs" onClick={addLotRow}>
                    <Plus className="w-3 h-3" /> Add lot
                  </Button>
                  <span className={`font-semibold ${Math.abs(totalAllocated - (stage?.input_qty_lbs || 0)) < 0.01 ? "text-chart-2" : "text-amber-600"}`}>
                    {parseFloat(totalAllocated.toFixed(2))} / {stage?.input_qty_lbs} lbs
                  </span>
                </div>
                <Button className="w-full h-9 gap-2" disabled={!lotsValid || saving} onClick={handleConfirmLots}>
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Saving…" : "Confirm Raw Material Lots"}
                </Button>
              </div>
            )}

            {lotsConfirmed && (
              <div className="rounded bg-chart-2/5 border border-chart-2/20 divide-y text-xs">
                {(lotAllocations || []).map((a, i) => (
                  <div key={i} className="flex justify-between px-2 py-1.5">
                    <span className="font-mono text-muted-foreground">{a.lot_number}</span>
                    <span className="font-semibold">{a.actual_lbs} lbs</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {plan.cookBatches.map(cb => {
            const completedInBatch = cb.racks.filter(r => effectiveRackData[r.rackNumber]?.completed).length;
            const batchComplete = completedInBatch === cb.racks.length;

            return (
              <div key={cb.cookBatchNumber} className={`rounded-xl border-2 ${batchComplete ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    {batchComplete
                      ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                      : <Circle className="w-4 h-4 text-muted-foreground" />
                    }
                    <p className="font-bold text-sm">Cook Batch #{cb.cookBatchNumber}</p>
                    <span className="text-xs text-muted-foreground">{cb.totalLbs} lbs · {cb.racks.length} racks</span>
                  </div>
                  {batchComplete && (
                    <Badge className="bg-chart-2/15 text-chart-2 text-xs border-0">Sent to Cooking</Badge>
                  )}
                  {!batchComplete && completedInBatch > 0 && (
                    <Badge variant="outline" className="text-xs">{completedInBatch}/{cb.racks.length} complete</Badge>
                  )}
                </div>

                <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {cb.racks.map(rack => {
                    const rd = effectiveRackData[rack.rackNumber];
                    const done = rd?.completed;
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
                        {done && rd.lot_number && (
                          <p className="text-xs font-mono text-chart-2 truncate">{rd.lot_number}</p>
                        )}
                        {!done && (
                          <p className="text-xs text-chart-1 font-semibold mt-0.5">Tap to complete</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>

      {/* Rack completion dialog */}
      {editingRack && (
        <Dialog open={!!editingRack} onOpenChange={() => setEditingRack(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Complete Rack #{editingRack.rackNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="rounded-lg bg-muted/40 border px-3 py-2 text-sm">
                <p className="text-muted-foreground">Cook Batch #{editingRack.cookBatchNumber} · Expected ~{editingRack.lbs} lbs</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Actual Weight (lbs)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.lbs}
                  onChange={e => setEditForm(f => ({ ...f, lbs: e.target.value }))}
                  placeholder={String(editingRack.lbs)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Lot Number</Label>
                <Input
                  value={editForm.lot_number}
                  onChange={e => setEditForm(f => ({ ...f, lot_number: e.target.value }))}
                  placeholder={`e.g. SV-R${editingRack.rackNumber}-2024`}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Notes (optional)</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any observations..."
                  className="h-20"
                />
              </div>

              {editingRack.rackNumber === plan.racks.filter(r => r.cookBatchIndex === editingRack.cookBatchIndex).slice(-1)[0]?.rackNumber && (
                <div className="flex items-start gap-2 rounded-lg bg-chart-1/10 border border-chart-1/20 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-chart-1 shrink-0 mt-0.5" />
                  <p className="text-xs text-chart-1 font-medium">
                    This is the last rack in Cook Batch #{editingRack.cookBatchNumber}. Completing it will automatically send the cook batch to the cooking stage.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditingRack(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-chart-2 hover:bg-chart-2/90 gap-2"
                  onClick={handleCompleteRack}
                  disabled={saving || !editForm.lbs || !flow}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Saving…" : "Complete Rack"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}