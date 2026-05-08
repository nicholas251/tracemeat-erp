import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Clock, Play } from "lucide-react";
import SubBatchManager from "./SubBatchManager";

export default function StageActionDialog({ stage, open, onClose, onUpdated }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (stage) setForm({ ...stage });
  }, [stage]);

  const { data: spiceMixes = [] } = useQuery({
    queryKey: ["spiceMixes"],
    queryFn: () => base44.entities.SpiceMix.filter({ status: "active" }),
    enabled: open && stage?.capability_key === "chopping",
  });

  const { data: capabilities = [] } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => base44.entities.Capability.filter({ status: "active" }),
    enabled: open,
  });

  const cap = capabilities.find(c => c.key === stage?.capability_key);

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    const updates = { ...form, status: newStatus };
    if (newStatus === "in_progress" && !form.started_at) updates.started_at = new Date().toISOString();
    if (newStatus === "completed") {
      updates.completed_at = new Date().toISOString();
      // unlock next stage
      await unlockNextStage(stage.order_id, stage.step_number, updates.output_qty_lbs);
    }
    await base44.entities.ProductionStage.update(stage.id, updates);
    setSaving(false);
    onUpdated();
  };

  const unlockNextStage = async (orderId, currentStep, outputQty) => {
    const allStages = await base44.entities.ProductionStage.filter({ order_id: orderId });
    const nextStage = allStages.find(s => s.step_number === currentStep + 1);
    if (nextStage && nextStage.status === "locked") {
      await base44.entities.ProductionStage.update(nextStage.id, {
        status: "available",
        input_qty_lbs: outputQty || 0
      });
    }
    // Update order status if all completed
    const allCompleted = allStages.every(s => s.id === nextStage?.id ? true : s.status === "completed");
    if (allCompleted && !nextStage) {
      await base44.entities.ProductionOrder.update(orderId, { status: "completed" });
    } else {
      await base44.entities.ProductionOrder.update(orderId, { status: "in_progress" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.ProductionStage.update(stage.id, form);
    setSaving(false);
    onUpdated();
  };

  const isLocked = stage?.status === "locked";
  const isAvailable = stage?.status === "available";
  const isInProgress = stage?.status === "in_progress";
  const isCompleted = stage?.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stage?.capability_name}
            <Badge variant="outline" className="capitalize text-xs">{stage?.status?.replace("_", " ")}</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{stage?.product_name} · Order #{stage?.order_number} · Step {stage?.step_number}</p>
        </DialogHeader>

        {isLocked && (
          <div className="py-6 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Waiting on prior stage</p>
            <p className="text-sm mt-1">This stage will unlock once the previous step is completed.</p>
          </div>
        )}

        {!isLocked && <div className="space-y-4">
          {/* Status Actions */}
          {!isCompleted && (
            <div className="flex gap-2">
              {isAvailable && (
                <Button onClick={() => handleStatusChange("in_progress")} className="gap-2 flex-1" disabled={saving}>
                  <Play className="w-4 h-4" /> Start Stage
                </Button>
              )}
              {isInProgress && (
                <Button onClick={() => handleStatusChange("completed")} className="gap-2 flex-1 bg-chart-2 hover:bg-chart-2/90" disabled={saving}>
                  <CheckCircle2 className="w-4 h-4" /> Mark Complete
                </Button>
              )}
              {isInProgress && (
                <Button variant="outline" onClick={() => handleStatusChange("on_hold")} disabled={saving}>
                  <Clock className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          {/* Weight tracking */}
          {(isInProgress || isCompleted) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Input Qty (lbs)</Label>
                <Input type="number" step="0.1" value={form.input_qty_lbs || ""} onChange={e => setForm(f => ({ ...f, input_qty_lbs: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Output Qty (lbs)</Label>
                <Input type="number" step="0.1" value={form.output_qty_lbs || ""} onChange={e => setForm(f => ({ ...f, output_qty_lbs: Number(e.target.value) }))} />
              </div>
            </div>
          )}

          {/* Spice mix (chopping) */}
          {cap?.tracks_spice_mix && isInProgress && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Spice Mix</Label>
                <Select value={form.spice_mix_id || ""} onValueChange={v => {
                  const mix = spiceMixes.find(m => m.id === v);
                  setForm(f => ({ ...f, spice_mix_id: v, spice_mix_name: mix?.name || "" }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select mix..." /></SelectTrigger>
                  <SelectContent>{spiceMixes.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Spice Mix Qty (lbs)</Label>
                <Input type="number" step="0.1" value={form.spice_mix_qty_lbs || ""} onChange={e => setForm(f => ({ ...f, spice_mix_qty_lbs: Number(e.target.value) }))} />
              </div>
            </div>
          )}

          {/* Temp tracking */}
          {cap?.tracks_temp && isInProgress && (
            <div className="space-y-1.5">
              <Label>Temperature (°C)</Label>
              <Input type="number" step="0.1" value={form.temperature_c || ""} onChange={e => setForm(f => ({ ...f, temperature_c: Number(e.target.value) }))} />
            </div>
          )}

          {/* Time tracking */}
          {cap?.tracks_time && isInProgress && (
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={form.duration_minutes || ""} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
            </div>
          )}

          {/* Rack tracking */}
          {cap?.tracks_racks && isInProgress && (
            <div className="space-y-1.5">
              <Label>Rack Count</Label>
              <Input type="number" value={form.racks_count || ""} onChange={e => setForm(f => ({ ...f, racks_count: Number(e.target.value) }))} />
            </div>
          )}

          {/* Sub-batch manager for linking/merge steps */}
          {(cap?.allows_merge || stage?.capability_key === "linking") && isInProgress && (
            <SubBatchManager
              stage={stage}
              subBatches={form.sub_batches || []}
              onChange={subs => setForm(f => ({ ...f, sub_batches: subs }))}
            />
          )}

          {/* Quality check */}
          {isInProgress && (
            <div className="flex items-center gap-3">
              <Switch
                checked={form.quality_check_passed || false}
                onCheckedChange={v => setForm(f => ({ ...f, quality_check_passed: v }))}
              />
              <Label>Quality check passed</Label>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-16" placeholder="Any observations..." />
          </div>
        </div>}

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!isLocked && (isInProgress || isCompleted) && (
            <Button onClick={handleSave} disabled={saving}>Save Changes</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}