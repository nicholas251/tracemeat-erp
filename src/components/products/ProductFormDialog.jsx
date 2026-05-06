import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    allergens: [], regulatory_codes: [], ingredients: [], recipe_id: "", recipe_name: "",
    recipe_consumption_per_case_lbs: "", process_id: "", process_name: "", finished_product_unit: "lbs"
  });
  const [recipes, setRecipes] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [recipeMode, setRecipeMode] = useState("select");
  const [processMode, setProcessMode] = useState("select");
  const [newRecipe, setNewRecipe] = useState({ name: "", yield_lbs: "", ingredients: [] });
  const [newProcess, setNewProcess] = useState({ name: "", description: "", steps: [] });
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    if (open) {
      base44.entities.Recipe.list().then(setRecipes);
      base44.entities.ProductionProcess.list().then(setProcesses);
    }
  }, [open]);

  // Auto-calculate recipe consumption when package size/case quantity changes
  useEffect(() => {
    if (form.package_size && form.packages_per_case && selectedRecipe?.yield_lbs) {
      const totalCaseWeightLbs = Number(form.package_size) * Number(form.packages_per_case);
      const consumption = (totalCaseWeightLbs / selectedRecipe.yield_lbs) * selectedRecipe.yield_lbs;
      update("recipe_consumption_per_case_lbs", Math.round(consumption * 100) / 100);
      update("case_weight_lbs", Math.round(totalCaseWeightLbs * 100) / 100);
    }
  }, [form.package_size, form.packages_per_case, selectedRecipe]);

  const handleSave = () => {
    onSave({
      ...form,
      case_weight_lbs: form.case_weight_lbs ? Number(form.case_weight_lbs) : undefined,
      shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : undefined,
      storage_temp_c: form.storage_temp_c ? Number(form.storage_temp_c) : undefined,
    });
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCreateRecipe = async () => {
    if (!newRecipe.name || !form.name || !newRecipe.yield_lbs) return;
    const created = await base44.entities.Recipe.create({
      name: newRecipe.name,
      product_id: "",
      product_name: form.name,
      yield_lbs: Number(newRecipe.yield_lbs),
      ingredients: newRecipe.ingredients,
      status: "draft"
    });
    setRecipes(prev => [...prev, created]);
    setSelectedRecipe(created);
    update("recipe_id", created.id);
    update("recipe_name", created.name);
    setRecipeMode("select");
    setNewRecipe({ name: "", yield_lbs: "", ingredients: [] });
  };

  const handleSelectRecipe = (val) => {
    const recipe = recipes.find(r => r.id === val);
    setSelectedRecipe(recipe);
    update("recipe_id", val);
    update("recipe_name", recipe?.name || "");
  };

  const handleCreateProcess = async () => {
    if (!newProcess.name) return;
    const created = await base44.entities.ProductionProcess.create({
      name: newProcess.name,
      description: newProcess.description,
      steps: newProcess.steps || []
    });
    setProcesses(prev => [...prev, created]);
    update("process_id", created.id);
    update("process_name", created.name);
    setProcessMode("select");
    setNewProcess({ name: "", description: "", steps: [] });
  };

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
            <Label>
              Packs per {form.finished_product_unit.charAt(0).toUpperCase() + form.finished_product_unit.slice(1).replace(/_/g, ' ')}
              {" *"}
            </Label>
            <Input type="number" value={form.packages_per_case} onChange={e => update("packages_per_case", e.target.value)} placeholder="e.g. 12" />
          </div>
          <div className="space-y-2">
            <Label>
              {form.finished_product_unit.charAt(0).toUpperCase() + form.finished_product_unit.slice(1).replace(/_/g, ' ')} Weight (lbs)
            </Label>
            <Input type="number" step="0.1" value={form.case_weight_lbs} disabled placeholder="Auto-calculated" />
          </div>
          <div className="space-y-2">
            <Label>
              Recipe Consumption per {form.finished_product_unit.charAt(0).toUpperCase() + form.finished_product_unit.slice(1).replace(/_/g, ' ')} (lbs)
            </Label>
            <Input type="number" step="0.1" value={form.recipe_consumption_per_case_lbs} disabled placeholder="Auto-calculated" />
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
          <div className="space-y-2 md:col-span-2">
            <Label>Production Process</Label>
            <Tabs value={processMode} onValueChange={setProcessMode}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="select">Select Existing</TabsTrigger>
                <TabsTrigger value="create">Create New</TabsTrigger>
              </TabsList>
              <TabsContent value="select" className="space-y-2 mt-2">
                <Select value={form.process_id || ""} onValueChange={(val) => {
                  const proc = processes.find(p => p.id === val);
                  update("process_id", val);
                  update("process_name", proc?.name || "");
                }}>
                  <SelectTrigger><SelectValue placeholder={processes.length === 0 ? "No processes available" : "Select a process..."} /></SelectTrigger>
                  <SelectContent>
                    {processes.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No processes yet. Create one to get started.</div>
                    ) : (
                      processes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="create" className="space-y-3 mt-2">
                <div className="space-y-2">
                  <Label className="text-sm">Process Name *</Label>
                  <Input value={newProcess.name} onChange={e => setNewProcess(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Standard Link & Cook Sausage" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Description</Label>
                  <Textarea value={newProcess.description} onChange={e => setNewProcess(prev => ({ ...prev, description: e.target.value }))} placeholder="Process overview and notes..." rows={2} />
                </div>
                <Button type="button" onClick={handleCreateProcess} className="w-full" size="sm" disabled={!newProcess.name}>
                  Create Process
                </Button>
              </TabsContent>
            </Tabs>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Recipe *</Label>
            <Tabs value={recipeMode} onValueChange={setRecipeMode}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="select">Select Existing</TabsTrigger>
                <TabsTrigger value="create">Create New</TabsTrigger>
              </TabsList>
              <TabsContent value="select" className="space-y-2 mt-2">
                <Select value={form.recipe_id} onValueChange={handleSelectRecipe}>
                  <SelectTrigger><SelectValue placeholder="Select a recipe..." /></SelectTrigger>
                  <SelectContent>
                    {recipes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="create" className="space-y-3 mt-2">
                <div className="space-y-2">
                  <Label className="text-sm">Recipe Name</Label>
                  <Input value={newRecipe.name} onChange={e => setNewRecipe(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Ground Beef Standard" />
                </div>
                <div className="space-y-2">
                   <Label className="text-sm">Yield (lbs)</Label>
                   <Input type="number" step="0.1" value={newRecipe.yield_lbs} onChange={e => setNewRecipe(prev => ({ ...prev, yield_lbs: e.target.value }))} placeholder="e.g. 100" />
                 </div>
                 <Button type="button" onClick={handleCreateRecipe} className="w-full" size="sm" disabled={!newRecipe.name || !newRecipe.yield_lbs}>
                  Create Recipe
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || !form.product_number || !form.sku || !form.recipe_id || !form.package_size || !form.packages_per_case}>
            {product ? "Update" : "Create"} Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}