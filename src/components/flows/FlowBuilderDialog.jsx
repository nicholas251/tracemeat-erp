import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GripVertical, Plus, X, ChevronUp, ChevronDown } from "lucide-react";

export default function FlowBuilderDialog({ open, onClose, onSave, flow, products, capabilities, workProfiles }) {
  const [form, setForm] = useState({ name: "", product_id: "", product_name: "", steps: [], status: "draft", notes: "" });

  useEffect(() => {
    if (flow) setForm(flow);
    else setForm({ name: "", product_id: "", product_name: "", steps: [], status: "draft", notes: "" });
  }, [flow, open]);

  const capabilityEnabled = (capId) => form.steps.some(s => s.capability_id === capId);

  const toggleCapability = (cap) => {
    if (capabilityEnabled(cap.id)) {
      setForm(f => ({ ...f, steps: f.steps.filter(s => s.capability_id !== cap.id) }));
    } else {
      const nextStep = (form.steps.length > 0 ? Math.max(...form.steps.map(s => s.step_number)) : 0) + 1;
      setForm(f => ({
        ...f,
        steps: [...f.steps, {
          step_number: nextStep,
          capability_id: cap.id,
          capability_key: cap.key,
          capability_name: cap.name,
          work_profile_id: "",
          work_profile_name: "",
          merge_batches: false,
          merge_ratio: cap.allows_merge ? 2 : undefined,
          racks_per_batch: cap.tracks_racks ? 3 : undefined,
          notes: ""
        }].sort((a, b) => a.step_number - b.step_number)
      }));
    }
  };

  const updateStep = (capId, field, value) => {
    setForm(f => ({
      ...f,
      steps: f.steps.map(s => s.capability_id === capId ? { ...s, [field]: value } : s)
    }));
  };

  const moveStep = (capId, dir) => {
    const steps = [...form.steps].sort((a, b) => a.step_number - b.step_number);
    const idx = steps.findIndex(s => s.capability_id === capId);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= steps.length) return;
    const newSteps = steps.map((s, i) => {
      if (i === idx) return { ...s, step_number: steps[swapIdx].step_number };
      if (i === swapIdx) return { ...s, step_number: steps[idx].step_number };
      return s;
    });
    setForm(f => ({ ...f, steps: newSteps.sort((a, b) => a.step_number - b.step_number) }));
  };

  const handleProductSelect = (pid) => {
    const p = products.find(p => p.id === pid);
    setForm(f => ({ ...f, product_id: pid, product_name: p?.name || "" }));
  };

  const handleProfileSelect = (capId, profileId) => {
    const p = workProfiles.find(p => p.id === profileId);
    updateStep(capId, "work_profile_id", profileId);
    updateStep(capId, "work_profile_name", p?.name || "");
  };

  const handleSave = () => {
    if (!form.name || form.steps.length === 0) return;
    onSave(form);
  };

  const orderedSteps = [...form.steps].sort((a, b) => a.step_number - b.step_number);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{flow ? "Edit Flow" : "Build New Flow"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Flow Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Hot Dog Flow" />
            </div>
            <div className="space-y-1.5">
              <Label>Product (optional)</Label>
              <Select value={form.product_id} onValueChange={handleProductSelect}>
                <SelectTrigger><SelectValue placeholder="Link to product..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Capability Toggles */}
          <div className="space-y-2">
            <Label>Enable Capabilities</Label>
            <p className="text-xs text-muted-foreground">Toggle on the steps this product requires. Then configure each enabled step below.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {capabilities.map(cap => (
                <div
                  key={cap.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${capabilityEnabled(cap.id) ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                  onClick={() => toggleCapability(cap)}
                >
                  <span className="text-sm font-medium">{cap.name}</span>
                  <Switch checked={capabilityEnabled(cap.id)} onCheckedChange={() => toggleCapability(cap)} />
                </div>
              ))}
            </div>
          </div>

          {/* Step Configuration */}
          {orderedSteps.length > 0 && (
            <div className="space-y-2">
              <Label>Configure & Order Steps</Label>
              <div className="space-y-2">
                {orderedSteps.map((step, idx) => {
                  const cap = capabilities.find(c => c.id === step.capability_id);
                  return (
                    <Card key={step.capability_id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1 pt-1">
                          <button onClick={() => moveStep(step.capability_id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-center text-muted-foreground">{step.step_number}</span>
                          <button onClick={() => moveStep(step.capability_id, 1)} disabled={idx === orderedSteps.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{step.capability_name}</p>
                            {cap?.allows_merge && <Badge variant="outline" className="text-xs">Merge capable</Badge>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Work Profile</Label>
                              <Select value={step.work_profile_id} onValueChange={v => handleProfileSelect(step.capability_id, v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign profile..." /></SelectTrigger>
                                <SelectContent>
                                  {workProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {cap?.allows_merge && (
                              <div className="flex items-center gap-2 pt-4">
                                <Switch
                                  checked={step.merge_batches}
                                  onCheckedChange={v => updateStep(step.capability_id, "merge_batches", v)}
                                />
                                <Label className="text-xs">Merge batches</Label>
                              </div>
                            )}
                          </div>
                          {step.merge_batches && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Merge ratio (inputs → 1)</Label>
                                <Input type="number" value={step.merge_ratio || 2} onChange={e => updateStep(step.capability_id, "merge_ratio", Number(e.target.value))} className="h-7 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Racks per output batch</Label>
                                <Input type="number" value={step.racks_per_batch || 3} onChange={e => updateStep(step.capability_id, "racks_per_batch", Number(e.target.value))} className="h-7 text-xs" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || form.steps.length === 0}>
            {flow ? "Update Flow" : "Save Flow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}