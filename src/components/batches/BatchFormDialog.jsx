import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function BatchFormDialog({ open, onClose, onSave, flows, rawMaterials }) {
  const [form, setForm] = useState({
    batch_number: `B-${Date.now().toString(36).toUpperCase()}`,
    flow_id: "", flow_name: "", product_id: "", product_name: "",
    quantity_kg: "", raw_material_lots: [], notes: "",
    production_date: format(new Date(), "yyyy-MM-dd"),
    status: "pending", current_step: 0, step_records: []
  });

  const activeFlows = flows.filter(f => f.status === "active");

  const handleFlowChange = (flowId) => {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) return;
    const stepRecords = (flow.steps || []).map(step => ({
      step_order: step.order,
      step_name: step.name,
      status: "pending",
      started_at: null, completed_at: null,
      temp_recorded_c: null, notes: "", completed_by: "", passed_inspection: null
    }));
    setForm(prev => ({
      ...prev,
      flow_id: flowId,
      flow_name: flow.name,
      product_id: flow.product_id,
      product_name: flow.product_name,
      total_steps: (flow.steps || []).length,
      step_records: stepRecords
    }));
  };

  const toggleRawMaterial = (lot) => {
    setForm(prev => ({
      ...prev,
      raw_material_lots: prev.raw_material_lots.includes(lot)
        ? prev.raw_material_lots.filter(l => l !== lot)
        : [...prev.raw_material_lots, lot]
    }));
  };

  const handleSave = () => {
    const flow = flows.find(f => f.id === form.flow_id);
    const product = flow ? null : null; // product info already set
    const expiryDays = 14; // default
    onSave({
      ...form,
      quantity_kg: form.quantity_kg ? Number(form.quantity_kg) : undefined,
      expiry_date: form.production_date 
        ? format(new Date(new Date(form.production_date).getTime() + expiryDays * 86400000), "yyyy-MM-dd")
        : undefined,
    });
  };

  const approvedMaterials = rawMaterials.filter(m => m.status === "approved" || m.status === "in_use");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start New Batch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Batch Number</Label>
              <Input value={form.batch_number} onChange={e => setForm(prev => ({ ...prev, batch_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Production Date</Label>
              <Input type="date" value={form.production_date} onChange={e => setForm(prev => ({ ...prev, production_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Production Flow *</Label>
            <Select value={form.flow_id} onValueChange={handleFlowChange}>
              <SelectTrigger><SelectValue placeholder="Select an active flow" /></SelectTrigger>
              <SelectContent>
                {activeFlows.map(f => <SelectItem key={f.id} value={f.id}>{f.name} — {f.product_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeFlows.length === 0 && (
              <p className="text-xs text-destructive">No active flows. Create and activate a flow first.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Quantity (kg)</Label>
            <Input type="number" value={form.quantity_kg} onChange={e => setForm(prev => ({ ...prev, quantity_kg: e.target.value }))} placeholder="0.0" />
          </div>

          {approvedMaterials.length > 0 && (
            <div className="space-y-2">
              <Label>Link Raw Materials</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {approvedMaterials.map(m => (
                  <label key={m.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted text-sm">
                    <input
                      type="checkbox"
                      checked={form.raw_material_lots.includes(m.lot_number)}
                      onChange={() => toggleRawMaterial(m.lot_number)}
                      className="rounded"
                    />
                    <span className="font-mono text-xs">{m.lot_number}</span>
                    <span className="text-muted-foreground truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Optional batch notes..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.flow_id}>Start Batch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}