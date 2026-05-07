import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { X, Plus } from "lucide-react";

export default function SpiceMixFormDialog({ open, onClose, onSave, mix }) {
  const [form, setForm] = useState({
    name: "",
    quantity_lbs: "",
    available_qty_lbs: "",
    status: "draft",
    ingredients: [],
    notes: "",
  });

  const [newIngredient, setNewIngredient] = useState({ bucket_id: "", bucket_name: "", quantity_lbs: "" });

  useEffect(() => {
    if (mix) {
      setForm(mix);
    } else {
      setForm({ name: "", quantity_lbs: "", available_qty_lbs: "", status: "draft", ingredients: [], notes: "" });
    }
  }, [mix, open]);

  const { data: buckets = [] } = useQuery({
    queryKey: ["spice_buckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ status: "active", category: "spice" }),
    enabled: open,
  });

  const handleAddIngredient = () => {
    if (!newIngredient.bucket_id || !newIngredient.quantity_lbs) return;
    setForm({
      ...form,
      ingredients: [...(form.ingredients || []), {
        bucket_id: newIngredient.bucket_id,
        bucket_name: newIngredient.bucket_name,
        quantity_lbs: Number(newIngredient.quantity_lbs)
      }]
    });
    setNewIngredient({ bucket_id: "", bucket_name: "", quantity_lbs: "" });
  };

  const handleRemoveIngredient = (idx) => {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) });
  };

  const handleBucketSelect = (bucketId) => {
    const bucket = buckets.find(b => b.id === bucketId);
    setNewIngredient({ ...newIngredient, bucket_id: bucketId, bucket_name: bucket?.name || "" });
  };

  // Auto-calculate total from ingredients
  const totalFromIngredients = (form.ingredients || []).reduce((sum, i) => sum + Number(i.quantity_lbs || 0), 0);

  const handleSave = () => {
    if (!form.name) return;
    const total = totalFromIngredients || Number(form.quantity_lbs) || 0;
    onSave({
      ...form,
      quantity_lbs: total,
      available_qty_lbs: mix ? Number(form.available_qty_lbs) : total,
      date_created: mix?.date_created || new Date().toISOString().split('T')[0],
    });
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
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
              {totalFromIngredients > 0 ? `${totalFromIngredients} lbs (auto-calculated from ingredients)` : "Add ingredients below to auto-calculate"}
            </div>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Ingredients (Spice Buckets)</Label>
            <div className="space-y-2">
              {form.ingredients?.map((ing, idx) => (
                <Card key={idx} className="p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">{ing.bucket_name}</p>
                    <p className="text-muted-foreground">{ing.quantity_lbs} lbs</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleRemoveIngredient(idx)}>
                    <X className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Add Ingredient from Bucket</Label>
              {buckets.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No spice buckets found. Add spice buckets in Inventory first.</p>
              ) : (
                <>
                  <Select value={newIngredient.bucket_id} onValueChange={handleBucketSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select spice bucket..." />
                    </SelectTrigger>
                    <SelectContent>
                      {buckets.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.1"
                    value={newIngredient.quantity_lbs}
                    onChange={e => setNewIngredient({ ...newIngredient, quantity_lbs: e.target.value })}
                    placeholder="Quantity (lbs)"
                  />
                  <Button size="sm" onClick={handleAddIngredient} variant="outline" className="w-full gap-1">
                    <Plus className="w-3 h-3" /> Add Ingredient
                  </Button>
                </>
              )}
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