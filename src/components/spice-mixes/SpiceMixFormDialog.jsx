import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

export default function SpiceMixFormDialog({ open, onClose, onSave, mix }) {
  const [form, setForm] = useState(mix || {
    name: "",
    quantity_lbs: "",
    available_qty_lbs: "",
    status: "draft",
    ingredients: [],
    notes: "",
  });

  const [newIngredient, setNewIngredient] = useState({ name: "", quantity_lbs: "" });

  const handleAddIngredient = () => {
    if (!newIngredient.name || !newIngredient.quantity_lbs) return;
    setForm({
      ...form,
      ingredients: [...(form.ingredients || []), { ...newIngredient, quantity_lbs: Number(newIngredient.quantity_lbs) }]
    });
    setNewIngredient({ name: "", quantity_lbs: "" });
  };

  const handleRemoveIngredient = (idx) => {
    setForm({
      ...form,
      ingredients: form.ingredients.filter((_, i) => i !== idx)
    });
  };

  const handleSave = () => {
    if (!form.name || !form.quantity_lbs) return;
    onSave({
      ...form,
      quantity_lbs: Number(form.quantity_lbs),
      available_qty_lbs: mix ? form.available_qty_lbs : Number(form.quantity_lbs),
      date_created: mix?.date_created || new Date().toISOString().split('T')[0],
    });
    setForm({ name: "", quantity_lbs: "", available_qty_lbs: "", status: "draft", ingredients: [], notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mix ? "Edit Spice Mix" : "Create Spice Mix"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mix Name</Label>
            <Input 
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Classic Hot Dog Blend"
            />
          </div>

          <div className="space-y-2">
            <Label>Batch Quantity (lbs)</Label>
            <Input 
              type="number"
              step="0.1"
              value={form.quantity_lbs}
              onChange={e => setForm({ ...form, quantity_lbs: e.target.value })}
              placeholder="50"
            />
          </div>

          {mix && (
            <div className="space-y-2">
              <Label>Available Quantity (lbs)</Label>
              <Input 
                type="number"
                step="0.1"
                value={form.available_qty_lbs}
                onChange={e => setForm({ ...form, available_qty_lbs: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Ingredients</Label>
            <div className="space-y-2">
              {form.ingredients?.map((ing, idx) => (
                <Card key={idx} className="p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">{ing.name}</p>
                    <p className="text-muted-foreground">{ing.quantity_lbs} lbs</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => handleRemoveIngredient(idx)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs">Add Ingredient</Label>
              <Input 
                value={newIngredient.name}
                onChange={e => setNewIngredient({ ...newIngredient, name: e.target.value })}
                placeholder="Ingredient name"
              />
              <Input 
                type="number"
                step="0.1"
                value={newIngredient.quantity_lbs}
                onChange={e => setNewIngredient({ ...newIngredient, quantity_lbs: e.target.value })}
                placeholder="Quantity (lbs)"
              />
              <Button size="sm" onClick={handleAddIngredient} variant="outline" className="w-full">
                Add Ingredient
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special notes..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{mix ? "Update" : "Create"} Mix</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}