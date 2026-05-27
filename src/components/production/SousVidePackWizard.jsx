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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Package, AlertCircle } from "lucide-react";

const RACK_LBS = 610;
const RACKS_PER_COOK_BATCH = 3;
const COOK_BATCH_LBS = RACK_LBS * RACKS_PER_COOK_BATCH; // 1830

function getFifoLotsForBucket(inventoryRows, bucketId) {
  return [...inventoryRows]
    .filter(r => r.bucket_id === bucketId && (r.available_qty || 0) > 0)
    .sort((a, b) => {
      const da = a.received_date || a.created_date || "";
      const db = b.received_date || b.created_date || "";
      return da < db ? -1 : da > db ? 1 : 0;
    });
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
  const [editForm, setEditForm] = useState({ lot_number: "", notes: "", lbs: "", short_weight_reason: "" });
  // Per-bucket selected lot: { [bucket_id]: { raw_inventory_id, lot_number, available_qty } }
  const [selectedLots, setSelectedLots] = useState({});
  const [lotsConfirmed, setLotsConfirmed] = useState(!!stage?.input_lot_number);
  // Seed immediately from prop so racks never flash empty while query loads
  const [updatedSubs, setUpdatedSubs] = useState(stage?.sub_batches || []);
  // Track which cook batches are expanded
  const [expandedBatches, setExpandedBatches] = useState({});

  // Fetch the latest stage data to ensure sub_batches are current
  const { data: freshStage, refetch: refetchStage } = useQuery({
    queryKey: ["svStage", stage?.id],
    queryFn: () => base44.entities.ProductionStage.filter({ id: stage.id }).then(r => r?.[0]),
    enabled: open && !!stage?.id,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Use fresh stage data if available, otherwise fall back to prop
  const currentStage = freshStage || stage;

  const { data: order } = useQuery({
    queryKey: ["svOrder", currentStage?.order_id],
    queryFn: () => base44.entities.ProductionOrder.filter({ id: currentStage.order_id }).then(r => r?.[0]),
    enabled: open && !!currentStage,
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

  // Use currentStage for all logic (for persistedRacks + form initialization)
  const stageToUse = currentStage || stage;

  // Derive the protein buckets this product uses from blend_ingredients
  const blendBuckets = product?.blend_ingredients || [];

  // If no blend_ingredients configured, allow manual bucket selection
  const [manualBucketId, setManualBucketId] = useState(null);

  // Fetch all protein inventory buckets for manual selection fallback
  const { data: allProteinBuckets = [] } = useQuery({
    queryKey: ["proteinBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "protein" }),
    enabled: open && blendBuckets.length === 0,
    staleTime: Infinity,
  });

  // Fetch raw inventory — for configured buckets OR for manually selected bucket
  const bucketIdsToFetch = blendBuckets.length > 0
    ? blendBuckets.map(b => b.bucket_id)
    : manualBucketId ? [manualBucketId] : [];

  const { data: rawInventoryAll = [] } = useQuery({
    queryKey: ["rawInventory", bucketIdsToFetch.join(",")],
    queryFn: async () => {
      if (!bucketIdsToFetch.length) return [];
      const results = await Promise.all(
        bucketIdsToFetch.map(id => base44.entities.RawInventory.filter({ bucket_id: id }))
      );
      return results.flat();
    },
    enabled: open && bucketIdsToFetch.length > 0,
  });

  // Effective buckets to show in the lot picker — either from product config or manual selection
  const effectiveBlendBuckets = blendBuckets.length > 0
    ? blendBuckets
    : manualBucketId
      ? [{ bucket_id: manualBucketId, bucket_name: allProteinBuckets.find(b => b.id === manualBucketId)?.name || manualBucketId, quantity_lbs: stageToUse?.input_qty_lbs }]
      : [];

  // Auto-select the FIFO (oldest) lot for each bucket when inventory loads
  useEffect(() => {
    if (rawInventoryAll.length > 0 && effectiveBlendBuckets.length > 0 && Object.keys(selectedLots).length === 0) {
      const autoSelected = {};
      for (const bucket of effectiveBlendBuckets) {
        const lots = getFifoLotsForBucket(rawInventoryAll, bucket.bucket_id);
        if (lots.length > 0) {
          autoSelected[bucket.bucket_id] = { raw_inventory_id: lots[0].id, lot_number: lots[0].lot_number || "", available_qty: lots[0].available_qty };
        }
      }
      if (Object.keys(autoSelected).length > 0) setSelectedLots(autoSelected);
    }
  }, [rawInventoryAll, blendBuckets]);

  // Also restore confirmed state from saved stage data
  useEffect(() => {
    if (stageToUse?.input_lot_number) {
      setLotsConfirmed(true);
    }
  }, [stageToUse?.input_lot_number]);

  // No longer auto-confirm when blend_ingredients is empty — show config notice instead

  // Sync updatedSubs only when freshStage arrives from the server (never use stale stage prop after mount)
  useEffect(() => {
    if (freshStage?.sub_batches) {
      setUpdatedSubs(freshStage.sub_batches);
    }
  }, [freshStage]);

  const plan = useMemo(() => {
    if (!stageToUse) return null;
    return buildRackPlan(stageToUse.input_qty_lbs || 0);
  }, [stageToUse?.input_qty_lbs]);

  // Load persisted sub_batches from updatedSubs (seeded from prop, updated by server)
  const persistedRacks = useMemo(() => {
    const result = {};
    for (const sb of updatedSubs) {
      if (sb.rack_number) {
        result[sb.rack_number] = { completed: true, lot_number: sb.lot_number || "", notes: sb.notes || "", lbs: sb.lbs || RACK_LBS, cook_batch_number: sb.cook_batch_number };
      }
    }
    return result;
  }, [updatedSubs]);

  const effectiveRackData = { ...persistedRacks, ...rackData };

  const handleConfirmLots = async () => {
    setSaving(true);
    const primaryLot = selectedLots[effectiveBlendBuckets[0]?.bucket_id]?.lot_number || "";
    await base44.entities.ProductionStage.update(stageToUse.id, { input_lot_number: primaryLot });
    // Deduct each bucket's quantity from the selected raw inventory lot
    for (const bucket of effectiveBlendBuckets) {
      const sel = selectedLots[bucket.bucket_id];
      if (sel?.raw_inventory_id) {
        const row = rawInventoryAll.find(r => r.id === sel.raw_inventory_id);
        if (row) {
          const deduct = bucket.quantity_lbs || 0;
          const newQty = Math.max(0, (row.available_qty || 0) - deduct);
          await base44.entities.RawInventory.update(sel.raw_inventory_id, {
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

  const hasBlendBuckets = effectiveBlendBuckets.length > 0;
  const lotsValid = hasBlendBuckets && effectiveBlendBuckets.every(b => selectedLots[b.bucket_id]?.lot_number?.trim());

  const toggleBatchExpanded = (batchNumber) => {
    setExpandedBatches(prev => ({
      ...prev,
      [batchNumber]: !prev[batchNumber]
    }));
  };

  const openEditRack = (rack) => {
    setEditingRack(rack);
    const existing = effectiveRackData[rack.rackNumber];
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    setEditForm({
      lot_number: existing?.lot_number || `R${rack.rackNumber}-${today}`,
      notes: existing?.notes || "",
      lbs: existing?.lbs ?? rack.lbs,
      short_weight_reason: existing?.short_weight_reason || "",
    });
  };

  const handleCompleteRack = async () => {
    if (!editingRack) return;
    setSaving(true);
    const rackNum = editingRack.rackNumber;
    const lbs = parseFloat(editForm.lbs) || editingRack.lbs;
    const lot = editForm.lot_number || `SV-R${rackNum}-${Date.now()}`;

    // Use freshest available sub_batches as the base
    const currentSubs = stageToUse.sub_batches?.length ? stageToUse.sub_batches : updatedSubs;
    
    // Build the new sub-batch entry
    const newSubBatch = {
      sub_batch_id: `rack-${rackNum}-${Date.now()}`,
      rack_number: rackNum,
      label: `Rack #${rackNum}`,
      lbs,
      lot_number: lot,
      notes: editForm.notes,
      short_weight_reason: lbs < 610 ? editForm.short_weight_reason : null,
      cook_batch_number: editingRack.cookBatchNumber,
      status: "completed",
    };
    
    // Build array from current source + add newly completed rack
    const newUpdatedSubs = [
      ...currentSubs.filter(sb => sb.rack_number !== rackNum),
      newSubBatch
    ];
    
    // Save to DB
    await base44.entities.ProductionStage.update(stageToUse.id, {
      status: "in_progress",
      started_at: stageToUse.started_at || new Date().toISOString(),
      sub_batches: newUpdatedSubs,
    });

    // Update local state for UI display
    setUpdatedSubs(newUpdatedSubs);

    // Build a merged view of all completed racks from the newly persisted sub_batches
    const mergedRackData = {};
    for (const sb of newUpdatedSubs) {
      if (sb.rack_number) {
        mergedRackData[sb.rack_number] = { completed: true, lot_number: sb.lot_number || "", notes: sb.notes || "", lbs: sb.lbs || RACK_LBS };
      }
    }

    // Check if the cook batch this rack belongs to is now complete
    const cookBatch = plan.cookBatches.find(cb => cb.cookBatchNumber === editingRack.cookBatchNumber);
    if (cookBatch) {
      const allRacksInBatch = cookBatch.racks.map(r => r.rackNumber);
      const completedInBatch = allRacksInBatch.filter(rn => mergedRackData[rn]?.completed);
      const batchComplete = completedInBatch.length > 0 && completedInBatch.length === allRacksInBatch.length;

      if (batchComplete) {
         // Fire off a cooking stage for this cook batch
         const cookBatchLbs = cookBatch.racks.reduce((s, r) => s + (mergedRackData[r.rackNumber]?.lbs || r.lbs), 0);
         const cookBatchLot = `SV-CB${editingRack.cookBatchNumber}-${Date.now()}`;

         // Check if already created (guard against double-tap)
         const existingCookStages = await base44.entities.ProductionStage.filter({
           order_id: stageToUse.order_id,
           capability_key: "cooking",
         });
         const alreadyExists = existingCookStages.some(s => s.notes?.includes(`Cook Batch #${editingRack.cookBatchNumber}`));

         if (!alreadyExists) {
           // Look up the cooking step from the flow to get work profile info
           const orderData = await base44.entities.ProductionOrder.filter({ id: stageToUse.order_id }).then(r => r?.[0]);
           const flowData = orderData?.flow_id ? await base44.entities.ProductFlow.filter({ id: orderData.flow_id }).then(r => r?.[0]) : null;
           const cookStep = flowData?.steps?.find(s => s.capability_key === "cooking");

           // Create cooking stage with all required fields from flow
           await base44.entities.ProductionStage.create({
             order_id: stageToUse.order_id,
             order_number: stageToUse.order_number,
             product_name: stageToUse.product_name,
             step_number: stageToUse.step_number + 1,
             capability_id: cookStep?.capability_id || "",
             capability_key: "cooking",
             capability_name: "Cooking",
             work_profile_id: cookStep?.work_profile_id || "",
             work_profile_name: cookStep?.work_profile_name || "",
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

    // Check if ALL racks are done → mark the sous vide pack stage as completed
    const allRacksDone = plan.racks.every(r => mergedRackData[r.rackNumber]?.completed);
    if (allRacksDone) {
      await base44.entities.ProductionStage.update(stageToUse.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        output_qty_lbs: plan.racks.reduce((s, r) => s + (mergedRackData[r.rackNumber]?.lbs || r.lbs), 0),
        racks_count: plan.totalRacks,
        sub_batches: newUpdatedSubs,
      });
    }

    await refetchStage();
    queryClient.invalidateQueries({ queryKey: ["orderStages", stageToUse.order_id] });
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });

    setSaving(false);
    setEditingRack(null);

    // Only call onCompleted if ALL racks are now done (stage fully complete)
    if (allRacksDone) {
      onCompleted?.();
    }
  };

  if (!plan) return null;

  const completedCount = plan.racks.filter(r => effectiveRackData[r.rackNumber]?.completed).length;

  const handleDialogClose = () => {
    setRackData({});
    setEditingRack(null);
    onClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-card shrink-0">
          <div className="w-10 h-10 rounded-xl bg-chart-1/15 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-chart-1" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold leading-tight">Sous Vide Pack — {stageToUse?.product_name}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order <span className="font-semibold text-foreground">#{stageToUse?.order_number}</span>
              &nbsp;·&nbsp;<span className="font-semibold text-foreground">{stageToUse?.input_qty_lbs} lbs</span>
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
          {/* Completed Cook Batches Section */}
          {plan.cookBatches.map(cb => {
            const completedInBatch = cb.racks.filter(r => effectiveRackData[r.rackNumber]?.completed).length;
            const batchComplete = completedInBatch === cb.racks.length && cb.racks.length > 0;
            const cookBatchSubBatches = updatedSubs?.filter(sb => sb.cook_batch_number === cb.cookBatchNumber) || [];
            
            if (!batchComplete) return null;
            
            const totalBatchLbs = cookBatchSubBatches.reduce((s, sb) => s + (sb.lbs || 0), 0);
            const cookBatchLot = cookBatchSubBatches[0]?.lot_number || `SV-CB${cb.cookBatchNumber}`;
            
            return (
              <div key={`completed-${cb.cookBatchNumber}`} className="rounded-xl border-2 border-chart-2/40 bg-chart-2/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-chart-2/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-chart-2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-chart-2">Cook Batch #{cb.cookBatchNumber} — Sent to Cooking</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {totalBatchLbs} lbs · {cb.racks.length} racks · Lot <span className="font-mono text-foreground">{cookBatchLot}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Raw Material Lot Section */}
          <div className={`rounded-xl border-2 p-4 space-y-3 ${lotsConfirmed ? "border-chart-2/40 bg-chart-2/5" : "border-amber-300 bg-amber-50/30"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lotsConfirmed
                  ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                  : <AlertCircle className="w-4 h-4 text-amber-500" />
                }
                <p className="font-bold text-sm">{effectiveBlendBuckets.map(b => b.bucket_name).join(", ") || "Raw Material"}</p>
                <span className="text-xs text-muted-foreground">{stageToUse?.input_qty_lbs} lbs required</span>
              </div>
              {lotsConfirmed && <Badge className="bg-chart-2/15 text-chart-2 border-0 text-xs">Confirmed</Badge>}
            </div>

            {!lotsConfirmed && blendBuckets.length === 0 && (
              <div className="space-y-2">
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

          {!lotsConfirmed && effectiveBlendBuckets.length > 0 && (
              <div className="space-y-3">
                {effectiveBlendBuckets.map(bucket => {
                  const fifoLots = getFifoLotsForBucket(rawInventoryAll, bucket.bucket_id);
                  const sel = selectedLots[bucket.bucket_id];
                  return (
                    <div key={bucket.bucket_id} className="rounded border bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold">{bucket.bucket_name}</p>
                        <span className="text-xs text-muted-foreground">{bucket.quantity_lbs} lbs required</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Select Lot (FIFO)</Label>
                        <Select
                          value={sel?.raw_inventory_id || ""}
                          onValueChange={val => {
                            const row = rawInventoryAll.find(r => r.id === val);
                            if (row) {
                              setSelectedLots(prev => ({
                                ...prev,
                                [bucket.bucket_id]: { raw_inventory_id: row.id, lot_number: row.lot_number || "", available_qty: row.available_qty }
                              }));
                            }
                          }}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select a lot…" />
                          </SelectTrigger>
                          <SelectContent>
                            {fifoLots.length === 0 && (
                              <SelectItem value="__none__" disabled>No inventory available</SelectItem>
                            )}
                            {fifoLots.map((lot, i) => (
                              <SelectItem key={lot.id} value={lot.id}>
                                {i === 0 ? "⭑ " : ""}{lot.lot_number || lot.id} — {lot.available_qty} lbs avail
                                {lot.received_date ? ` (rcvd ${lot.received_date})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {sel?.lot_number && (
                        <div className="rounded bg-chart-1/8 border border-chart-1/20 px-3 py-2 text-xs flex justify-between">
                          <span className="font-mono font-semibold">{sel.lot_number}</span>
                          <span className="text-muted-foreground">{sel.available_qty} lbs on hand</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button className="w-full h-9 gap-2" disabled={!lotsValid || saving} onClick={handleConfirmLots}>
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Saving…" : "Confirm Raw Material Lots"}
                </Button>
              </div>
          )}

            {lotsConfirmed && (
              <div className="rounded bg-chart-2/5 border border-chart-2/20 divide-y text-xs">
                {effectiveBlendBuckets.map(bucket => {
                  const sel = selectedLots[bucket.bucket_id];
                  return (
                    <div key={bucket.bucket_id} className="flex justify-between px-2 py-1.5">
                      <span className="text-muted-foreground">{bucket.bucket_name}</span>
                      <span className="font-mono font-semibold">{sel?.lot_number || stageToUse?.input_lot_number || "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {plan.cookBatches.map(cb => {
           const completedInBatch = cb.racks.filter(r => effectiveRackData[r.rackNumber]?.completed).length;
           const batchComplete = completedInBatch === cb.racks.length && cb.racks.length > 0;
           const isExpanded = expandedBatches[cb.cookBatchNumber] !== false; // Default expanded

           // Skip completed batches—they're shown in the completed section above
           if (batchComplete) return null;

           return (
             <div key={cb.cookBatchNumber} className={`rounded-xl border-2 border-border bg-card`}>
                <button
                  onClick={() => toggleBatchExpanded(cb.cookBatchNumber)}
                  className="w-full flex items-center justify-between px-4 pt-3 pb-2 hover:bg-muted/30 transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-2">
                    {batchComplete
                      ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                      : <Circle className="w-4 h-4 text-muted-foreground" />
                    }
                    <p className="font-bold text-sm">Cook Batch #{cb.cookBatchNumber}</p>
                    <span className="text-xs text-muted-foreground">{cb.totalLbs} lbs · {cb.racks.length} racks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {completedInBatch > 0 && (
                      <Badge variant="outline" className="text-xs">{completedInBatch}/{cb.racks.length} racks complete</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
                  </div>
                </button>

                {isExpanded && <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                </div>}
              </div>
            );
          })}
        </div>
      </DialogContent>

      </Dialog>

      {/* Rack completion dialog — rendered OUTSIDE the outer Dialog to prevent close bubbling */}
      {editingRack && (
        <Dialog open={!!editingRack} onOpenChange={(isOpen) => { if (!isOpen) setEditingRack(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Complete Rack #{editingRack.rackNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="rounded-lg bg-muted/40 border px-3 py-2 text-sm">
                <p className="text-muted-foreground">Cook Batch #{editingRack.cookBatchNumber} · Expected ~{editingRack.lbs} lbs</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Actual Weight (lbs) — Max 610</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="610"
                  value={editForm.lbs}
                  onChange={e => {
                    const val = e.target.value === "" ? "" : Math.min(610, Math.max(0, parseInt(e.target.value, 10) || 0));
                    setEditForm(f => ({ ...f, lbs: val }));
                  }}
                  placeholder={String(editingRack.lbs)}
                  className="h-11"
                />
              </div>

              {editForm.lbs && parseInt(editForm.lbs, 10) < 610 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-amber-600">Reason for Short Weight (required)</Label>
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
                  disabled={saving || !editForm.lbs || (parseInt(editForm.lbs, 10) < 610 && !editForm.short_weight_reason?.trim())}
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