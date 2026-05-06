import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["beef", "pork", "poultry", "lamb", "seasoning", "casing", "packaging", "additive", "other"];

export default function RecipeFormDialog({ open, onClose, onSave, recipe, products }) {
  const [form, setForm] = useState(recipe ? {
    name: recipe.data.name,
    product_id: recipe.data.product_id,
    product_name: recipe.data.product_name,
    yield_lbs: recipe.data.yield_lbs,
    ingredients: recipe.data.ingredients || [],
    status: recipe.data.status,
    notes: recipe.data.notes || "",
  } : {
    name: "",
    product_id: "",
    product_name: "",
    yield_lbs: 0,
    ingredients: [],
    status: "draft",
    notes: "",
  });

  const addIngredient = () => {
    setForm(prev => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), {
         raw_material_name: "",
         quantity_lbs: 0,
         category: "beef",
       }],
    }));
  };

  const updateIngredient = (idx, field, value) => {
    const ingredients = [...form.ingredients];
    ingredients[idx][field] = value;
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
    if (!form.name || !form.product_id || !form.yield_lbs) {
      alert("Recipe name, product, and yield are required");
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
              <Select value={form.product_id} onValueChange={handleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Yield (lbs) *</Label>
              <Input
                type="number"
                step="0.1"
                value={form.yield_lbs}
                onChange={e => setForm(prev => ({ ...prev, yield_lbs: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold mb-3 block">Ingredients (FIFO will pull from oldest lot first)</Label>
            <div className="space-y-3">
              {form.ingredients.map((ingredient, idx) => (
                <Card key={idx} className="p-3 bg-muted/30">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                    <div>
                      <Label className="text-xs">Raw Material Name *</Label>
                      <Input
                        value={ingredient.raw_material_name}
                        onChange={e => updateIngredient(idx, 'raw_material_name', e.target.value)}
                        placeholder="e.g. Pork Shoulder"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select value={ingredient.category} onValueChange={v => updateIngredient(idx, 'category', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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