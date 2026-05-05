import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import FlowStepEditor from "./FlowStepEditor";

export default function FlowFormDialog({ open, onClose, onSave, flow, products }) {
  const [form, setForm] = useState(flow || {
    name: "", product_id: "", product_name: "", steps: [], status: "draft", version: 1
  });

  const addStep = () => {
    setForm(prev => ({
      ...prev,
      steps: [...(prev.steps || []), {
        order: (prev.steps || []).length + 1,
        name: "", description: "", station: "",
        target_temp_c: null, max_duration_min: null,
        requires_inspection: false, ccp: false, is_metal_detection: false
      }]
    }));
  };

  const updateStep = (index, updatedStep) => {
    const newSteps = [...form.steps];
    newSteps[index] = { ...updatedStep, order: index + 1 };
    setForm(prev => ({ ...prev, steps: newSteps }));
  };

  const removeStep = (index) => {
    const newSteps = form.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    setForm(prev => ({ ...prev, steps: newSteps }));
  };

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === productId);
    setForm(prev => ({ ...prev, product_id: productId, product_name: product?.name || "" }));
  };

  const handleSave = () => {
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{flow ? "Edit Flow" : "New Production Flow"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Flow Name *</Label>
              <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Ground Beef Standard" />
            </div>
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={form.product_id} onValueChange={handleProductChange}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Processing Steps</Label>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
              </Button>
            </div>
            <div className="space-y-3">
              {(form.steps || []).length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No steps yet. Click "Add Step" to build your production flow.
                </div>
              ) : (
                form.steps.map((step, i) => (
                  <FlowStepEditor key={i} step={step} index={i} onChange={updateStep} onRemove={removeStep} />
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.product_id}>
            {flow ? "Update" : "Create"} Flow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}