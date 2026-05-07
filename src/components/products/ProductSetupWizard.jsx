import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { ChevronRight, ChevronLeft, Plus, Trash2, Check, Blend, Scissors, Link, Flame, Snowflake, Package } from "lucide-react";

const STEPS = [
  { id: "basics",     label: "Product Info",  icon: Package },
  { id: "flow",       label: "Flow",          icon: Link },
  { id: "blending",   label: "Blending",      icon: Blend },
  { id: "chopping",   label: "Chopping",      icon: Scissors },
  { id: "linking",    label: "Linking",       icon: Link },
  { id: "smokehouse", label: "Smokehouse",    icon: Flame },
  { id: "chilling",   label: "Chilling",      icon: Snowflake },
  { id: "packaging",  label: "Packaging",     icon: Package },
];

const cookMethods = [
  { value: "steam",              label: "Steam" },
  { value: "dry_heat",           label: "Dry Heat" },
  { value: "steam_and_dry_heat", label: "Steam & Dry Heat" },
];

const packagingTypes = [
  { value: "vacuum_sealed", label: "Vacuum Sealed" },
  { value: "gaylord",       label: "Gaylord" },
  { value: "bulk_box",      label: "Bulk Box" },
  { value: "retail_pack",   label: "Retail Pack" },
  { value: "other",         label: "Other" },
  { value: "chub",          label: "Chub" },
];

const categories = [
  { value: "beef",        label: "Beef" },
  { value: "pork",        label: "Pork" },
  { value: "poultry",     label: "Poultry" },
  { value: "lamb",        label: "Lamb" },
  { value: "mixed",       label: "Mixed" },
  { value: "ready_to_eat",label: "Ready to Eat" },
  { value: "other",       label: "Other" },
];

const EMPTY = {
  name: "", product_number: "", sku: "", category: "mixed", description: "", status: "draft",
  flow_id: "", flow_name: "",
  blend_batch_lbs: "", blend_ingredients: [],
  chop_spice_mix_id: "", chop_spice_mix_name: "", chop_spice_qty_lbs: "",
  link_merge_batches: false, link_merge_ratio: 2,
  smokehouse_cook_method: "steam", smokehouse_target_temp_c: "", smokehouse_duration_minutes: "",
  package_size: "", package_size_oz: "", packages_per_case: "", packaging_type: "vacuum_sealed",
  finished_product_unit: "lbs", shelf_life_days: "", storage_temp_c: "",
  package_size_unit: "lbs",
};

export default function ProductSetupWizard({ open, onClose, onSave }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY });
  const [flows, setFlows] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [spiceMixes, setSpiceMixes] = useState([]);
  const [saving, setSaving] = useState(false);
  // Track which steps in the selected flow exist
  const [flowStepKeys, setFlowStepKeys] = useState([]);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm({ ...EMPTY });
      Promise.all([
        base44.entities.ProductFlow.list(),
        base44.entities.InventoryBucket.filter({ category: "protein" }),
        base44.entities.SpiceMix.filter({ status: "active" }),
      ]).then(([f, b, s]) => {
        setFlows(f);
        setBuckets(b);
        setSpiceMixes(s);
      });
    }
  }, [open]);

  // When a flow is selected, determine which capability steps it has
  useEffect(() => {
    if (form.flow_id) {
      const flow = flows.find(f => f.id === form.flow_id);
      if (flow?.steps) {
        setFlowStepKeys(flow.steps.map(s => s.capability_key?.toLowerCase()));
      }
    } else {
      setFlowStepKeys([]);
    }
  }, [form.flow_id, flows]);

  // Build visible steps: always show basics + flow, then only steps present in the selected flow
  const visibleSteps = STEPS.filter(s => {
    if (s.id === "basics" || s.id === "flow") return true;
    if (flowStepKeys.length === 0) return true; // show all if no flow selected yet
    return flowStepKeys.some(k => k?.includes(s.id === "smokehouse" ? "smok" : s.id === "packaging" ? "pack" : s.id));
  });

  const currentStep = visibleSteps[step];
  const isFirst = step === 0;
  const isLast = step === visibleSteps.length - 1;

  const up = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const addIngredient = () => {
    up("blend_ingredients", [...(form.blend_ingredients || []), { bucket_id: "", bucket_name: "", quantity_lbs: "", category: "protein" }]);
  };

  const updateIngredient = (i, field, val) => {
    const updated = [...form.blend_ingredients];
    updated[i] = { ...updated[i], [field]: val };
    up("blend_ingredients", updated);
  };

  const removeIngredient = (i) => {
    up("blend_ingredients", form.blend_ingredients.filter((_, idx) => idx !== i));
  };

  const handleSelectBucket = (i, bucketId) => {
    const b = buckets.find(x => x.id === bucketId);
    const updated = [...form.blend_ingredients];
    updated[i] = { ...updated[i], bucket_id: bucketId, bucket_name: b?.name || "", category: b?.category || "protein" };
    up("blend_ingredients", updated);
  };

  const handleSelectSpiceMix = (id) => {
    const mix = spiceMixes.find(m => m.id === id);
    up("chop_spice_mix_id", id);
    up("chop_spice_mix_name", mix?.name || "");
  };

  const handleSelectFlow = (id) => {
    const flow = flows.find(f => f.id === id);
    up("flow_id", id);
    up("flow_name", flow?.name || "");
  };

  const handleSave = async () => {
    setSaving(true);
    // Create a Recipe from blending ingredients
    let recipeId = "", recipeName = "";
    if (form.blend_ingredients?.length > 0) {
      recipeName = `${form.name} - Blend Recipe`;
      const recipe = await base44.entities.Recipe.create({
        name: recipeName,
        product_id: "",
        product_name: form.name,
        yield_percent: 95,
        ingredients: form.blend_ingredients.map(i => ({
          bucket_id: i.bucket_id,
          bucket_name: i.bucket_name,
          quantity_lbs: Number(i.quantity_lbs),
          category: i.category || "protein",
        })),
        status: "active",
      });
      recipeId = recipe.id;
      recipeName = recipe.name;
    }

    const caseWeight = packSizeNum && form.packages_per_case
      ? packSizeNum * Number(form.packages_per_case)
      : undefined;

    const productData = {
      ...form,
      recipe_id: recipeId,
      recipe_name: recipeName,
      blend_batch_lbs: form.blend_batch_lbs ? Number(form.blend_batch_lbs) : undefined,
      chop_spice_qty_lbs: form.chop_spice_qty_lbs ? Number(form.chop_spice_qty_lbs) : undefined,
      link_merge_ratio: form.link_merge_ratio ? Number(form.link_merge_ratio) : undefined,
      smokehouse_target_temp_c: form.smokehouse_target_temp_c ? Number(form.smokehouse_target_temp_c) : undefined,
      smokehouse_duration_minutes: form.smokehouse_duration_minutes ? Number(form.smokehouse_duration_minutes) : undefined,
      package_size: packSizeNum || undefined,
      packages_per_case: form.packages_per_case ? Number(form.packages_per_case) : undefined,
      case_weight_lbs: caseWeight,
      shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : undefined,
      storage_temp_c: form.storage_temp_c ? Number(form.storage_temp_c) : undefined,
    };

    const savedProduct = await onSave(productData);

    // Back-link the flow to this product if one was selected and the product was saved
    if (form.flow_id && savedProduct?.id) {
      await base44.entities.ProductFlow.update(form.flow_id, {
        product_id: savedProduct.id,
        product_name: form.name,
      });
    }

    setSaving(false);
  };

  // Calculate pack size in lbs for display and calculations
  const packSizeNum = form.package_size_unit === "lbs_oz"
    ? (Number(form.package_size) || 0) + (Number(form.package_size_oz) || 0) / 16
    : Number(form.package_size);

  const canNext = () => {
    if (currentStep.id === "basics") return form.name && form.product_number && form.sku && form.category;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Product Setup</DialogTitle>
        </DialogHeader>

        {/* Step Progress */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {visibleSteps.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={s.id}>
                <div className={`flex flex-col items-center min-w-[52px] ${active ? "text-primary" : done ? "text-green-600" : "text-muted-foreground"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold
                    ${active ? "border-primary bg-primary/10" : done ? "border-green-500 bg-green-50" : "border-border bg-background"}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[9px] mt-0.5 text-center leading-tight">{s.label}</span>
                </div>
                {i < visibleSteps.length - 1 && <div className={`flex-1 h-0.5 min-w-[12px] ${i < step ? "bg-green-400" : "bg-border"}`} />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="py-4 min-h-[280px]">

          {/* BASICS */}
          {currentStep.id === "basics" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the core product information.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Product Name *</Label>
                  <Input value={form.name} onChange={e => up("name", e.target.value)} placeholder="e.g. Classic Hot Dog" />
                </div>
                <div className="space-y-1.5">
                  <Label>Product Number *</Label>
                  <Input value={form.product_number} onChange={e => up("product_number", e.target.value)} placeholder="e.g. PD-001" />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU *</Label>
                  <Input value={form.sku} onChange={e => up("sku", e.target.value)} placeholder="e.g. HD-CLASSIC" />
                </div>
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select value={form.category} onValueChange={v => up("category", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => up("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* FLOW */}
          {currentStep.id === "flow" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select the production flow that defines which steps this product goes through. The wizard will adapt to the steps in the flow.</p>
              <div className="space-y-1.5">
                <Label>Production Flow</Label>
                <Select value={form.flow_id} onValueChange={handleSelectFlow}>
                  <SelectTrigger><SelectValue placeholder="Select a flow..." /></SelectTrigger>
                  <SelectContent>
                    {flows.filter(f => f.status !== "archived").map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.flow_id && (
                <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Steps in this flow:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {flows.find(f => f.id === form.flow_id)?.steps
                      ?.sort((a, b) => a.step_number - b.step_number)
                      .map(s => (
                        <Badge key={s.step_number} variant="outline" className="text-xs">{s.step_number}. {s.capability_name}</Badge>
                      ))}
                  </div>
                </div>
              )}
              {flows.length === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">No flows found. Go to Flow Builder first to create a production flow, then come back to set up your product.</p>
              )}
            </div>
          )}

          {/* BLENDING */}
          {currentStep.id === "blending" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Define the protein ingredients and quantities that make up one blending batch.</p>
              <div className="space-y-1.5">
                <Label>Total Batch Size (lbs)</Label>
                <Input type="number" value={form.blend_batch_lbs} onChange={e => up("blend_batch_lbs", e.target.value)} placeholder="e.g. 500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Protein Ingredients</Label>
                  <Button size="sm" variant="outline" onClick={addIngredient} className="gap-1 text-xs h-7">
                    <Plus className="w-3 h-3" /> Add Protein
                  </Button>
                </div>
                {form.blend_ingredients?.length === 0 && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded p-3 text-center">No proteins added yet. Click "Add Protein" to define the blend.</p>
                )}
                {form.blend_ingredients?.map((ing, i) => (
                  <div key={i} className="flex gap-2 items-center bg-muted/30 rounded-lg p-2">
                    <div className="flex-1 space-y-1">
                      <Select value={ing.bucket_id} onValueChange={v => handleSelectBucket(i, v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select protein bucket..." /></SelectTrigger>
                        <SelectContent>
                          {buckets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder="lbs"
                        value={ing.quantity_lbs}
                        onChange={e => updateIngredient(i, "quantity_lbs", e.target.value)}
                      />
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeIngredient(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {form.blend_ingredients?.length > 0 && (
                  <div className="text-xs text-muted-foreground text-right">
                    Total: <span className="font-semibold text-foreground">
                      {form.blend_ingredients.reduce((s, i) => s + (Number(i.quantity_lbs) || 0), 0).toFixed(1)} lbs
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHOPPING */}
          {currentStep.id === "chopping" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">The chopping step combines the protein blend with a spice mix to create the filling. Select which spice mix this product uses.</p>
              <div className="space-y-1.5">
                <Label>Default Spice Mix</Label>
                <Select value={form.chop_spice_mix_id} onValueChange={handleSelectSpiceMix}>
                  <SelectTrigger><SelectValue placeholder="Select spice mix..." /></SelectTrigger>
                  <SelectContent>
                    {spiceMixes.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.quantity_lbs ? `— ${m.quantity_lbs} lb batch` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {spiceMixes.length === 0 && (
                  <p className="text-xs text-amber-600">No active spice mixes found. You can set this later or create spice mixes under the Spice Mixes page.</p>
                )}
              </div>

              {form.chop_spice_mix_id && (() => {
                const selectedMix = spiceMixes.find(m => m.id === form.chop_spice_mix_id);
                return (
                  <div className="space-y-3">
                    {selectedMix && (
                      <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-semibold text-foreground">{selectedMix.name}</p>
                        <p className="text-muted-foreground">
                          Recipe batch size: <span className="font-medium text-foreground">{selectedMix.quantity_lbs} lbs</span>
                          {selectedMix.available_qty_lbs != null && (
                            <> &nbsp;·&nbsp; Currently available: <span className="font-medium text-foreground">{selectedMix.available_qty_lbs} lbs</span></>
                          )}
                        </p>
                        {selectedMix.ingredients?.length > 0 && (
                          <p className="text-muted-foreground">Ingredients: {selectedMix.ingredients.map(i => i.bucket_name).join(", ")}</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>Amount of spice mix used per chopping batch (lbs)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={form.chop_spice_qty_lbs}
                        onChange={e => up("chop_spice_qty_lbs", e.target.value)}
                        placeholder="e.g. 12.5"
                      />
                      <p className="text-xs text-muted-foreground">
                        How many lbs of <strong>{selectedMix?.name}</strong> are added each time a chopping batch runs for this product.
                        {selectedMix?.quantity_lbs && form.chop_spice_qty_lbs && (
                          <> &nbsp;({(Number(form.chop_spice_qty_lbs) / selectedMix.quantity_lbs * 100).toFixed(0)}% of one spice batch per chopping batch)</>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                The protein batch from blending will be combined with this spice mix during chopping to produce filling batches.
              </div>
            </div>
          )}

          {/* LINKING */}
          {currentStep.id === "linking" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">The linking step forms sausage links. Decide if filling batches are merged to create cook batches.</p>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Switch checked={form.link_merge_batches} onCheckedChange={v => up("link_merge_batches", v)} />
                <div>
                  <p className="text-sm font-medium">Merge filling batches into cook batches</p>
                  <p className="text-xs text-muted-foreground">Enable if multiple filling batches are combined at the linking stage</p>
                </div>
              </div>
              {form.link_merge_batches && (
                <div className="space-y-1.5">
                  <Label>How many filling batches make 1 cook batch?</Label>
                  <Input
                    type="number"
                    min={2}
                    value={form.link_merge_ratio}
                    onChange={e => up("link_merge_ratio", e.target.value)}
                    placeholder="e.g. 2"
                  />
                  <p className="text-xs text-muted-foreground">e.g. enter 2 if 2 filling batches → 1 cook batch</p>
                </div>
              )}
            </div>
          )}

          {/* SMOKEHOUSE */}
          {currentStep.id === "smokehouse" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure the smokehouse cooking method and targets for this product.</p>
              <div className="space-y-1.5">
                <Label>Cooking Method *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {cookMethods.map(m => (
                    <button
                      key={m.value}
                      onClick={() => up("smokehouse_cook_method", m.value)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all text-center
                        ${form.smokehouse_cook_method === m.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:bg-muted/40"
                        }`}
                    >
                      <Flame className={`w-4 h-4 mx-auto mb-1 ${form.smokehouse_cook_method === m.value ? "text-primary" : "text-muted-foreground"}`} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Target Internal Temp (°F)</Label>
                  <Input type="number" value={form.smokehouse_target_temp_c} onChange={e => up("smokehouse_target_temp_c", e.target.value)} placeholder="e.g. 160" />
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Duration (min)</Label>
                  <Input type="number" value={form.smokehouse_duration_minutes} onChange={e => up("smokehouse_duration_minutes", e.target.value)} placeholder="e.g. 90" />
                </div>
              </div>
            </div>
          )}

          {/* CHILLING */}
          {currentStep.id === "chilling" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Chilling parameters are standardised across all products. Confirm the target chilling temperature for this product.</p>
              <div className="space-y-1.5">
                <Label>Target Chill Temp (°F)</Label>
                <Input type="number" value={form.storage_temp_c} onChange={e => up("storage_temp_c", e.target.value)} placeholder="e.g. 36" />
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                The product will be chilled to this temperature before packaging. This value also becomes the product's storage temperature.
              </div>
            </div>
          )}

          {/* PACKAGING */}
          {currentStep.id === "packaging" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Define the finished goods packaging specification.</p>
              <div className="space-y-1.5">
                <Label>Packaging Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {packagingTypes.map(p => (
                    <button
                      key={p.value}
                      onClick={() => up("packaging_type", p.value)}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all text-center
                        ${form.packaging_type === p.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted/40"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pack Size *</Label>
                  <div className="flex gap-2">
                    {form.package_size_unit === "lbs" ? (
                      <Input type="number" step="0.1" value={form.package_size} onChange={e => up("package_size", e.target.value)} placeholder="e.g. 2.0" className="flex-1" />
                    ) : (
                      <>
                        <Input type="number" value={form.package_size} onChange={e => up("package_size", e.target.value)} placeholder="lbs" className="flex-1" />
                        <Input type="number" value={form.package_size_oz} onChange={e => up("package_size_oz", e.target.value)} placeholder="oz" className="flex-1" />
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => up("package_size_unit", form.package_size_unit === "lbs" ? "lbs_oz" : "lbs")}
                      className="whitespace-nowrap text-xs"
                    >
                      {form.package_size_unit === "lbs" ? "Add oz" : "Decimal"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Packs per Case *</Label>
                  <Input type="number" value={form.packages_per_case} onChange={e => up("packages_per_case", e.target.value)} placeholder="e.g. 12" />
                </div>
                <div className="space-y-1.5">
                  <Label>Shelf Life (days)</Label>
                  <Input type="number" value={form.shelf_life_days} onChange={e => up("shelf_life_days", e.target.value)} placeholder="e.g. 30" />
                </div>
                <div className="space-y-1.5">
                  <Label>Finished Unit</Label>
                  <Select value={form.finished_product_unit} onValueChange={v => up("finished_product_unit", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lbs">Lbs</SelectItem>
                      <SelectItem value="cases">Cases</SelectItem>
                      <SelectItem value="gaylords">Gaylords</SelectItem>
                      <SelectItem value="packs">Packs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {packSizeNum && form.packages_per_case && (
                <div className="bg-muted/40 rounded-lg p-3 text-xs">
                  Case weight: <span className="font-semibold">{(packSizeNum * Number(form.packages_per_case)).toFixed(1)} lbs</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {!isFirst && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {isLast ? (
            <Button onClick={handleSave} disabled={saving || !form.name || !form.product_number || !form.sku}>
              {saving ? "Saving..." : "Create Product"}
            </Button>
          ) : (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}