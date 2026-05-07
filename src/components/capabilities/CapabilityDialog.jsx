import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const CONSUMES_OPTIONS = [
  { value: "raw_buckets", label: "Raw Buckets" },
  { value: "protein_batch", label: "Protein Batch" },
  { value: "filling_batches", label: "Filling Batches" },
  { value: "racked_units", label: "Racked Units" },
  { value: "cooked_product", label: "Cooked Product" },
  { value: "chilled_product", label: "Chilled Product" },
  { value: "none", label: "None" },
];

const PRODUCES_OPTIONS = [
  { value: "protein_batch", label: "Protein Batch" },
  { value: "filling_batches", label: "Filling Batches" },
  { value: "cooking_batches", label: "Cooking Batches" },
  { value: "racked_units", label: "Racked Units" },
  { value: "cooked_product", label: "Cooked Product" },
  { value: "chilled_product", label: "Chilled Product" },
  { value: "finished_goods", label: "Finished Goods" },
];

const DEFAULTS = {
  name: "", key: "", description: "", icon: "",
  consumes: "raw_buckets", produces: "protein_batch",
  allows_merge: false, tracks_racks: false, tracks_spice_mix: false,
  tracks_temp: false, tracks_time: false, tracks_weight: true,
  status: "active"
};

export default function CapabilityDialog({ open, onClose, onSave, capability }) {
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    setForm(capability ? { ...capability } : DEFAULTS);
  }, [capability, open]);

  const handleNameChange = (name) => {
    const key = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setForm(f => ({ ...f, name, key: capability ? f.key : key }));
  };

  const toggle = (field) => setForm(f => ({ ...f, [field]: !f[field] }));

  const handleSave = () => {
    if (!form.name || !form.key) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{capability ? "Edit Capability" : "New Capability"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Marinating" />
            </div>
            <div className="space-y-1.5">
              <Label>Key (machine ID)</Label>
              <Input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} placeholder="e.g. marinating" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-16" placeholder="What does this step do?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Consumes</Label>
              <Select value={form.consumes} onValueChange={v => setForm(f => ({ ...f, consumes: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONSUMES_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produces</Label>
              <Select value={form.produces} onValueChange={v => setForm(f => ({ ...f, produces: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCES_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tracking Options</Label>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              {[
                { field: "tracks_weight", label: "Weight" },
                { field: "tracks_temp", label: "Temperature" },
                { field: "tracks_time", label: "Duration" },
                { field: "tracks_racks", label: "Rack Count" },
                { field: "tracks_spice_mix", label: "Spice Mix" },
                { field: "allows_merge", label: "Allows Merge" },
              ].map(({ field, label }) => (
                <div key={field} className="flex items-center justify-between py-1">
                  <span className="text-sm">{label}</span>
                  <Switch checked={!!form[field]} onCheckedChange={() => toggle(field)} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.key}>
            {capability ? "Update" : "Create"} Capability
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}