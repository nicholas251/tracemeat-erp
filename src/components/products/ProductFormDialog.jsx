import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const categories = [
  { value: "beef", label: "Beef" },
  { value: "pork", label: "Pork" },
  { value: "poultry", label: "Poultry" },
  { value: "lamb", label: "Lamb" },
  { value: "mixed", label: "Mixed" },
  { value: "ready_to_eat", label: "Ready to Eat" },
  { value: "other", label: "Other" },
];

const packagingTypes = [
  { value: "vacuum_sealed", label: "Vacuum Sealed" },
  { value: "tray_wrap", label: "Tray Wrap" },
  { value: "bulk_box", label: "Bulk Box" },
  { value: "retail_pack", label: "Retail Pack" },
  { value: "case_ready", label: "Case Ready" },
  { value: "chub", label: "Chub" },
];

export default function ProductFormDialog({ open, onClose, onSave, product }) {
  const [form, setForm] = useState(product || {
    name: "", sku: "", category: "beef", description: "",
    packaging_type: "vacuum_sealed", case_weight_lbs: "", shelf_life_days: "",
    storage_temp_c: "", status: "draft", allergens: [], regulatory_codes: [],
    ingredients: []
  });

  const handleSave = () => {
    onSave({
      ...form,
      case_weight_lbs: form.case_weight_lbs ? Number(form.case_weight_lbs) : undefined,
      shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : undefined,
      storage_temp_c: form.storage_temp_c ? Number(form.storage_temp_c) : undefined,
    });
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Ground Beef 80/20" />
          </div>
          <div className="space-y-2">
            <Label>SKU *</Label>
            <Input value={form.sku} onChange={e => update("sku", e.target.value)} placeholder="e.g. GB-8020" />
          </div>
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={v => update("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Packaging</Label>
            <Select value={form.packaging_type} onValueChange={v => update("packaging_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {packagingTypes.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Case Weight (lbs)</Label>
            <Input type="number" step="0.1" value={form.case_weight_lbs} onChange={e => update("case_weight_lbs", e.target.value)} placeholder="e.g. 10.5" />
          </div>
          <div className="space-y-2">
            <Label>Shelf Life (days)</Label>
            <Input type="number" value={form.shelf_life_days} onChange={e => update("shelf_life_days", e.target.value)} placeholder="e.g. 14" />
          </div>
          <div className="space-y-2">
            <Label>Storage Temp (°C)</Label>
            <Input type="number" value={form.storage_temp_c} onChange={e => update("storage_temp_c", e.target.value)} placeholder="e.g. -2" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Product specs and notes..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.sku}>
            {product ? "Update" : "Create"} Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}