import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const holdReasons = [
  { value: "temperature_deviation", label: "Temperature Deviation" },
  { value: "contamination_suspect", label: "Contamination Suspect" },
  { value: "labeling_error", label: "Labeling Error" },
  { value: "foreign_material", label: "Foreign Material" },
  { value: "quality_issue", label: "Quality Issue" },
  { value: "regulatory_hold", label: "Regulatory Hold" },
  { value: "customer_complaint", label: "Customer Complaint" },
  { value: "other", label: "Other" },
];

const severityLevels = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const holdTypes = [
  { value: "batch", label: "Production Batch" },
  { value: "raw_material", label: "Raw Material" },
  { value: "finished_goods", label: "Finished Goods" },
];

export default function HoldFormDialog({ open, onClose, onSave, batches = [], rawMaterials = [], finishedGoods = [], preselectedBatch }) {
  const [holdType, setHoldType] = useState(preselectedBatch ? "batch" : "batch");

  const [form, setForm] = useState({
    batch_id: preselectedBatch?.id || "",
    batch_number: preselectedBatch?.batch_number || "",
    product_name: preselectedBatch?.product_name || "",
    hold_reason: "quality_issue",
    hold_description: "",
    severity: "medium",
    status: "on_hold",
    held_date: new Date().toISOString(),
    quantity_affected_kg: preselectedBatch?.quantity_kg || "",
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleHoldTypeChange = (type) => {
    setHoldType(type);
    setForm(prev => ({
      ...prev,
      batch_id: "",
      batch_number: "",
      product_name: "",
      quantity_affected_kg: "",
      item_type: type,
    }));
  };

  const handleBatchChange = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    if (batch) {
      setForm(prev => ({
        ...prev,
        batch_id: batchId,
        batch_number: batch.batch_number,
        product_name: batch.product_name,
        quantity_affected_kg: batch.quantity_kg || "",
        item_type: "batch",
      }));
    }
  };

  const handleRawMaterialChange = (itemId) => {
    const item = rawMaterials.find(r => r.id === itemId);
    if (item) {
      setForm(prev => ({
        ...prev,
        batch_id: itemId,
        batch_number: item.lot_number,
        product_name: item.name,
        quantity_affected_kg: item.available_qty_lbs ? (item.available_qty_lbs * 0.453592).toFixed(1) : "",
        item_type: "raw_material",
      }));
    }
  };

  const handleFinishedGoodsChange = (itemId) => {
    const item = finishedGoods.find(i => i.id === itemId);
    if (item) {
      setForm(prev => ({
        ...prev,
        batch_id: itemId,
        batch_number: item.lot_number || item.batch_number,
        product_name: item.product_name,
        quantity_affected_kg: item.quantity_lbs ? (item.quantity_lbs * 0.453592).toFixed(1) : "",
        item_type: "finished_goods",
      }));
    }
  };

  const handleSave = () => {
    onSave({
      ...form,
      item_type: holdType,
      quantity_affected_kg: form.quantity_affected_kg ? Number(form.quantity_affected_kg) : undefined,
    });
  };

  const isValid = form.batch_id && form.hold_description;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Place Item on Hold</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Hold Type Selector */}
          {!preselectedBatch && (
            <div className="space-y-2">
              <Label>Hold Type *</Label>
              <Select value={holdType} onValueChange={handleHoldTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {holdTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Item Selector based on type */}
          {!preselectedBatch && holdType === "batch" && (
            <div className="space-y-2">
              <Label>Batch *</Label>
              <Select value={form.batch_id} onValueChange={handleBatchChange}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {batches.filter(b => b.status !== "rejected").map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.batch_number} — {b.product_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!preselectedBatch && holdType === "raw_material" && (
            <div className="space-y-2">
              <Label>Raw Material *</Label>
              <Select value={form.batch_id} onValueChange={handleRawMaterialChange}>
                <SelectTrigger><SelectValue placeholder="Select raw material" /></SelectTrigger>
                <SelectContent>
                  {rawMaterials.filter(r => r.status !== "rejected" && r.status !== "depleted").map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.lot_number} — {r.name} ({r.supplier})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!preselectedBatch && holdType === "finished_goods" && (
            <div className="space-y-2">
              <Label>Finished Goods Lot *</Label>
              <Select value={form.batch_id} onValueChange={handleFinishedGoodsChange}>
                <SelectTrigger><SelectValue placeholder="Select finished goods lot" /></SelectTrigger>
                <SelectContent>
                  {finishedGoods.filter(i => i.status === "available" || i.status === "reserved").map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.lot_number || i.batch_number} — {i.product_name} ({(i.quantity_lbs || 0).toLocaleString()} lbs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show selected item info */}
          {preselectedBatch && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <strong>{form.batch_number}</strong> — {form.product_name}
            </div>
          )}
          {!preselectedBatch && form.batch_id && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <strong>{form.batch_number}</strong> — {form.product_name}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={form.hold_reason} onValueChange={v => update("hold_reason", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {holdReasons.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => update("severity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {severityLevels.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Quantity Affected (kg)</Label>
            <Input type="number" value={form.quantity_affected_kg} onChange={e => update("quantity_affected_kg", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea value={form.hold_description} onChange={e => update("hold_description", e.target.value)} placeholder="Describe the issue in detail..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Place on Hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}