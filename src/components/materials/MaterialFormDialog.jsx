import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const categories = [
  { value: "beef", label: "Beef" },
  { value: "pork", label: "Pork" },
  { value: "poultry", label: "Poultry" },
  { value: "lamb", label: "Lamb" },
  { value: "seasoning", label: "Seasoning" },
  { value: "casing", label: "Casing" },
  { value: "packaging", label: "Packaging" },
  { value: "additive", label: "Additive" },
  { value: "other", label: "Other" },
];

export default function MaterialFormDialog({ open, onClose, onSave, material }) {
  const [form, setForm] = useState(material || {
    lot_number: `L-${Date.now().toString(36).toUpperCase()}`,
    name: "", supplier: "", category: "beef",
    received_date: format(new Date(), "yyyy-MM-dd"),
    expiry_date: "", quantity_lbs: "", par_level: "", temp_on_arrival_c: "",
    status: "received", inspection_notes: "",
    country_of_origin: "", establishment_number: ""
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    onSave({
      ...form,
      quantity_lbs: form.quantity_lbs ? Number(form.quantity_lbs) : undefined,
      par_level: form.par_level ? Number(form.par_level) : undefined,
      temp_on_arrival_c: form.temp_on_arrival_c ? Number(form.temp_on_arrival_c) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material ? "Edit Material" : "Receive Raw Material"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Lot Number</Label>
            <Input value={form.lot_number} onChange={e => update("lot_number", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Material Name *</Label>
            <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Chuck Roll" />
          </div>
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Input value={form.supplier} onChange={e => update("supplier", e.target.value)} placeholder="Supplier name" />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => update("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Received Date</Label>
            <Input type="date" value={form.received_date} onChange={e => update("received_date", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Input type="date" value={form.expiry_date} onChange={e => update("expiry_date", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quantity (lbs)</Label>
            <Input type="number" value={form.quantity_lbs} onChange={e => update("quantity_lbs", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Par Level (lbs) - Min to maintain</Label>
            <Input type="number" value={form.par_level} onChange={e => update("par_level", e.target.value)} placeholder="e.g. 100" />
          </div>
          <div className="space-y-2">
            <Label>Temp on Arrival (°C)</Label>
            <Input type="number" value={form.temp_on_arrival_c} onChange={e => update("temp_on_arrival_c", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Country of Origin</Label>
            <Input value={form.country_of_origin} onChange={e => update("country_of_origin", e.target.value)} placeholder="e.g. USA" />
          </div>
          <div className="space-y-2">
            <Label>Establishment #</Label>
            <Input value={form.establishment_number} onChange={e => update("establishment_number", e.target.value)} placeholder="USDA est. number" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="inspected">Inspected</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Inspection Notes</Label>
            <Textarea value={form.inspection_notes} onChange={e => update("inspection_notes", e.target.value)} placeholder="Inspection findings..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.supplier}>
            {material ? "Update" : "Receive"} Material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}