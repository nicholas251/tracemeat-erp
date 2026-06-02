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
import { CheckCircle2, Clock, Play, Wand2 } from "lucide-react";
import SubBatchManager from "./SubBatchManager";
import StageWizard from "./StageWizard";

// Stages that have full wizard logic — completion MUST go through StageWizard
const WIZARD_ONLY_CAPS = ["blending", "chopping", "mixer", "linking", "tumble", "tumbling", "racking", "cooking", "chilling", "packaging"];

export default function StageActionDialog({ stage, open, onClose, onUpdated, allowedCapabilityKeys = null }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const isWizardStage = WIZARD_ONLY_CAPS.includes(stage?.capability_key);

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
    // Use sorted next-step lookup rather than fragile step_number+1 arithmetic
    const sortedStages = [...allStages].sort((a, b) => a.step_number - b.step_number);
    const nextStage = sortedStages.find(s => s.step_number > currentStep && s.status !== "completed");
    if (nextStage && nextStage.status === "locked") {
      await base44.entities.ProductionStage.update(nextStage.id, {
        status: "available",
        input_qty_lbs: outputQty || 0
      });
    }
    // Re-fetch fresh state to accurately determine order completion
    const freshStages = await base44.entities.ProductionStage.filter({ order_id: orderId });
    const allCompleted = freshStages.every(s => s.status === "completed");
    if (allCompleted) {
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

  const isAvailable = stage?.status === "available";
  const isInProgress = stage?.status === "in_progress";
  const isCompleted = stage?.status === "completed";

  // If allowedCapabilityKeys is provided, block editing stages outside the operator's role
  const isReadOnly = allowedCapabilityKeys !== null && !allowedCapabilityKeys.includes(stage?.capability_key);

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stage?.capability_name}
            <Badge variant="outline" className="capitalize text-xs">{stage?.status?.replace("_", " ")}</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{stage?.product_name} · Order #{stage?.order_number} · Step {stage?.step_number}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Access guard */}
          {isReadOnly && (
            <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground border">
              This stage belongs to a different work role. You can view it but cannot make changes.
            </div>
          )}

          {/* Status Actions */}
          {!isCompleted && !isReadOnly && (
            <div className="flex gap-2">
              {/* Wizard-capable stages: always open StageWizard for start AND complete */}
              {isWizardStage && (isAvailable || isInProgress) && (
                <Button onClick={() => { onClose(); setWizardOpen(true); }} className="gap-2 flex-1" disabled={saving}>
                  <Wand2 className="w-4 h-4" /> {isInProgress ? "Continue Stage" : "Start Stage"}
                </Button>
              )}
              {/* Non-wizard stages: simple status buttons */}
              {!isWizardStage && isAvailable && (
                <Button onClick={() => handleStatusChange("in_progress")} className="gap-2 flex-1" disabled={saving}>
                  <Play className="w-4 h-4" /> Start Stage
                </Button>
              )}
              {!isWizardStage && isInProgress && (
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
          {!isReadOnly && (isInProgress || isCompleted) && (
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
          {!isReadOnly && cap?.tracks_spice_mix && isInProgress && (
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
          {!isReadOnly && cap?.tracks_temp && isInProgress && (
            <div className="space-y-1.5">
              <Label>Temperature (°C)</Label>
              <Input type="number" step="0.1" value={form.temperature_c || ""} onChange={e => setForm(f => ({ ...f, temperature_c: Number(e.target.value) }))} />
            </div>
          )}

          {/* Time tracking */}
          {!isReadOnly && cap?.tracks_time && isInProgress && (
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={form.duration_minutes || ""} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
            </div>
          )}

          {/* Rack tracking */}
          {!isReadOnly && cap?.tracks_racks && isInProgress && (
            <div className="space-y-1.5">
              <Label>Rack Count</Label>
              <Input type="number" value={form.racks_count || ""} onChange={e => setForm(f => ({ ...f, racks_count: Number(e.target.value) }))} />
            </div>
          )}

          {/* Sub-batch manager for linking/merge steps */}
          {!isReadOnly && (cap?.allows_merge || stage?.capability_key === "linking") && isInProgress && (
            <SubBatchManager
              stage={stage}
              subBatches={form.sub_batches || []}
              onChange={subs => setForm(f => ({ ...f, sub_batches: subs }))}
            />
          )}

          {/* Quality check */}
          {!isReadOnly && isInProgress && (
            <div className="flex items-center gap-3">
              <Switch
                checked={form.quality_check_passed || false}
                onCheckedChange={v => setForm(f => ({ ...f, quality_check_passed: v }))}
              />
              <Label>Quality check passed</Label>
            </div>
          )}

          {/* Notes */}
          {!isReadOnly && (
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-16" placeholder="Any observations..." />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!isReadOnly && !isWizardStage && (isInProgress || isCompleted) && (
            <Button onClick={handleSave} disabled={saving}>Save Changes</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* StageWizard handles all completion logic for wizard-capable stages */}
    {wizardOpen && stage && (
      <StageWizard
        stage={stage}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCompleted={() => {
          setWizardOpen(false);
          onUpdated();
        }}
      />
    )}
    </>
  );
}