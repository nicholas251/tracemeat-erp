import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

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

const finishedProductUnits = [
  { value: "lbs", label: "Lbs" },
  { value: "cases", label: "Cases" },
  { value: "gaylords", label: "Gaylords" },
  { value: "packs", label: "Packs" },
];

export default function ProductFormDialog({ open, onClose, onSave, product }) {
  const [form, setForm] = useState(product || {
    name: "", product_number: "", sku: "", category: "beef", description: "",
    packaging_type: "vacuum_sealed", package_size: "", packages_per_case: "",
    case_weight_lbs: "", shelf_life_days: "", storage_temp_c: "", status: "draft",
    allergens: [], regulatory_codes: [], ingredients: [],
    recipe_consumption_per_case_lbs: "", process_id: "", process_name: "", finished_product_unit: "lbs"
  });
  const [tab, setTab] = useState("basic");

  useEffect(() => {
    if (open) {
      setTab("basic");
      setForm(product || {
        name: "", product_number: "", sku: "", category: "beef", description: "",
        packaging_type: "vacuum_sealed", package_size: "", packages_per_case: "",
        case_weight_lbs: "", shelf_life_days: "", storage_temp_c: "", status: "draft",
        allergens: [], regulatory_codes: [], ingredients: [],
        recipe_consumption_per_case_lbs: "", process_id: "", process_name: "", finished_product_unit: "lbs"
      });
    }
  }, [open, product]);

  const { data: spiceMixes = [] } = useQuery({
    queryKey: ["spiceMixes"],
    queryFn: () => base44.entities.SpiceMix.list(),
    enabled: open,
  });

  // Auto-calculate case weight when package size/count changes
  useEffect(() => {
    if (form.package_size && form.packages_per_case) {
      const totalCaseWeightLbs = Number(form.package_size) * Number(form.packages_per_case);
      update("case_weight_lbs", Math.round(totalCaseWeightLbs * 100) / 100);
    }
  }, [form.package_size, form.packages_per_case]);

  const handleSave = () => {
    onSave({
      ...form,
      case_weight_lbs: form.case_weight_lbs ? Number(form.case_weight_lbs) : undefined,
      shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : undefined,
      storage_temp_c: form.storage_temp_c ? Number(form.storage_temp_c) : undefined,
      blend_batch_lbs: form.blend_batch_lbs ? Number(form.blend_batch_lbs) : undefined,
      yield_percent: form.yield_percent ? Number(form.yield_percent) : undefined,
      chop_spice_qty_lbs: form.chop_spice_qty_lbs ? Number(form.chop_spice_qty_lbs) : undefined,
      chop_water_lbs: form.chop_water_lbs ? Number(form.chop_water_lbs) : undefined,
      chop_cure_lbs: form.chop_cure_lbs ? Number(form.chop_cure_lbs) : undefined,
    });
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const unitLabel = form.finished_product_unit
    ? form.finished_product_unit.charAt(0).toUpperCase() + form.finished_product_unit.slice(1).replace(/_/g, ' ')
    : "Case";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="chopping">Chopping</TabsTrigger>
          </TabsList>

          <TabsContent value="chopping" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Blend Batch Size (lbs protein)</Label>
              <Input type="number" step="0.1" value={form.blend_batch_lbs || ""} onChange={e => update("blend_batch_lbs", e.target.value)} placeholder="e.g. 240" />
              <p className="text-xs text-muted-foreground">Total protein weight per blending batch.</p>
            </div>
            <div className="space-y-2">
              <Label>Yield %</Label>
              <Input type="number" step="0.1" min="1" max="100" value={form.yield_percent || ""} onChange={e => update("yield_percent", e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 95" />
              <p className="text-xs text-muted-foreground">e.g. 95 means 1000 lbs in → 950 lbs finished product out.</p>
            </div>
            <div className="space-y-2">
              <Label>Spice Mix</Label>
              <Select value={form.chop_spice_mix_id || ""} onValueChange={v => {
                const m = spiceMixes.find(x => x.id === v);
                update("chop_spice_mix_id", v);
                update("chop_spice_mix_name", m?.name || "");
              }}>
                <SelectTrigger><SelectValue placeholder="Select spice mix..." /></SelectTrigger>
                <SelectContent>{spiceMixes.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Spice Mix per Batch (lbs)</Label>
              <Input type="number" step="0.01" value={form.chop_spice_qty_lbs || ""} onChange={e => update("chop_spice_qty_lbs", e.target.value)} placeholder="e.g. 12.19" />
            </div>
            <div className="space-y-2">
              <Label>Water per Batch (lbs)</Label>
              <Input type="number" step="0.1" value={form.chop_water_lbs || ""} onChange={e => update("chop_water_lbs", e.target.value)} placeholder="e.g. 61" />
            </div>
            <div className="space-y-2">
              <Label>Cure per Batch (lbs)</Label>
              <Input type="number" step="0.01" value={form.chop_cure_lbs || ""} onChange={e => update("chop_cure_lbs", e.target.value)} placeholder="e.g. 0.56" />
            </div>
            {form.blend_batch_lbs && (
              <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">Batch weight summary</p>
                <p className="text-muted-foreground">Protein: <span className="font-medium text-foreground">{Number(form.blend_batch_lbs).toFixed(2)} lbs</span></p>
                {form.chop_spice_qty_lbs > 0 && <p className="text-muted-foreground">Spice: <span className="font-medium text-foreground">{Number(form.chop_spice_qty_lbs).toFixed(2)} lbs</span></p>}
                {form.chop_water_lbs > 0 && <p className="text-muted-foreground">Water: <span className="font-medium text-foreground">{Number(form.chop_water_lbs).toFixed(2)} lbs</span></p>}
                {form.chop_cure_lbs > 0 && <p className="text-muted-foreground">Cure: <span className="font-medium text-foreground">{Number(form.chop_cure_lbs).toFixed(2)} lbs</span></p>}
                <p className="font-semibold text-foreground border-t pt-1 mt-1">
                  Total chop batch: {(
                    (Number(form.blend_batch_lbs) || 0) +
                    (Number(form.chop_spice_qty_lbs) || 0) +
                    (Number(form.chop_water_lbs) || 0) +
                    (Number(form.chop_cure_lbs) || 0)
                  ).toFixed(2)} lbs
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="basic">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Ground Beef 80/20" />
              </div>
              <div className="space-y-2">
                <Label>Product Number *</Label>
                <Input value={form.product_number} onChange={e => update("product_number", e.target.value)} placeholder="e.g. PD-001" />
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
                <Label>Finished Product Unit *</Label>
                <Select value={form.finished_product_unit} onValueChange={v => update("finished_product_unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {finishedProductUnits.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pack Size (lbs) *</Label>
                <Input type="number" step="0.1" value={form.package_size} onChange={e => update("package_size", e.target.value)} placeholder="e.g. 2.0" />
              </div>
              <div className="space-y-2">
                <Label>Packs per {unitLabel} *</Label>
                <Input type="number" value={form.packages_per_case} onChange={e => update("packages_per_case", e.target.value)} placeholder="e.g. 12" />
              </div>
              <div className="space-y-2">
                <Label>{unitLabel} Weight (lbs)</Label>
                <Input type="number" step="0.1" value={form.case_weight_lbs} disabled placeholder="Auto-calculated" />
              </div>
              <div className="space-y-2">
                <Label>Shelf Life (days)</Label>
                <Input type="number" value={form.shelf_life_days} onChange={e => update("shelf_life_days", e.target.value)} placeholder="e.g. 14" />
              </div>
              <div className="space-y-2">
                <Label>Storage Temp (°F)</Label>
                <Input type="number" value={form.storage_temp_c} onChange={e => update("storage_temp_c", e.target.value)} placeholder="e.g. 28" />
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
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.product_number || !form.sku || !form.package_size || !form.packages_per_case}>
            {product ? "Update" : "Create"} Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}