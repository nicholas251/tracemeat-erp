import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const CATEGORIES = ["beef", "pork", "poultry", "lamb", "seasoning", "casing", "packaging", "additive", "other"];

export default function RecipeFormDialog({ open, onClose, onSave, recipe, products }) {
  const [buckets, setBuckets] = useState([]);
  const [form, setForm] = useState(recipe ? {
    name: recipe.name,
    product_id: recipe.product_id,
    product_name: recipe.product_name,
    yield_percent: recipe.yield_percent ?? (recipe.yield_lbs || ""),
    ingredients: recipe.ingredients || [],
    status: recipe.status,
    notes: recipe.notes || "",
  } : {
    name: "",
    product_id: "",
    product_name: "",
    yield_percent: "",
    ingredients: [],
    status: "draft",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      base44.entities.InventoryBucket.list().then(setBuckets);
    }
  }, [open]);

  const addIngredient = () => {
    setForm(prev => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), {
         bucket_id: "",
         bucket_name: "",
         quantity_lbs: 0,
         category: "beef",
       }],
    }));
  };

  const updateIngredient = (idx, field, value) => {
    const ingredients = [...form.ingredients];
    if (field === 'bucket_id') {
      const bucket = buckets.find(b => b.id === value);
      ingredients[idx].bucket_id = value;
      ingredients[idx].bucket_name = bucket?.name || "";
      ingredients[idx].category = bucket?.category || ingredients[idx].category;
    } else {
      ingredients[idx][field] = value;
    }
    setForm(prev => ({ ...prev, ingredients }));
  };

  const removeIngredient = (idx) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };

  const handleProductChange = (productId) => {
    const product = products?.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      product_id: productId,
      product_name: product?.name || "",
    }));
  };

  const handleSave = () => {
    if (!form.name || !form.product_id || !form.yield_percent) {
      alert("Recipe name, product, and yield % are required");
      return;
    }
    if (form.yield_percent <= 0 || form.yield_percent > 100) {
      alert("Yield must be between 1 and 100");
      return;
    }
    if (!form.ingredients.every(ing => ing.bucket_id && ing.quantity_lbs > 0)) {
      alert("All ingredients must have a bucket and quantity");
      return;
    }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? "Edit Recipe" : "New Recipe"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Recipe Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Italian Sausage v1"
              />
            </div>
            <div>
              <Label>Finished Product *</Label>
              <Select value={form.product_id || ""} onValueChange={handleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {products && products.length > 0 ? (
                    products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">No products available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Yield % *</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="100"
                  value={form.yield_percent}
                  onChange={e => setForm(prev => ({ ...prev, yield_percent: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g. 95"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">e.g. 95 means 1,000 lbs in → 950 lbs out</p>
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold mb-3 block">Ingredients (linked to inventory buckets for traceability)</Label>
            <div className="space-y-3">
              {form.ingredients.map((ingredient, idx) => (
                <Card key={idx} className="p-3 bg-muted/30">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                      <div>
                        <Label className="text-xs">Inventory Bucket *</Label>
                        <Select value={ingredient.bucket_id} onValueChange={v => updateIngredient(idx, 'bucket_id', v)}>
                           <SelectTrigger>
                             <SelectValue placeholder="Select bucket" />
                           </SelectTrigger>
                           <SelectContent className="z-[60]">
                            {buckets.map(b => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name} ({b.category})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Category</Label>
                        <Input
                          value={ingredient.category}
                          disabled
                          placeholder="Auto-set from bucket"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Qty Per Batch (lbs) *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={ingredient.quantity_lbs}
                          onChange={e => updateIngredient(idx, 'quantity_lbs', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeIngredient(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
              ))}

              <Button size="sm" variant="outline" onClick={addIngredient} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Ingredient
              </Button>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Recipe instructions, special notes..."
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{recipe ? "Update" : "Create"} Recipe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}