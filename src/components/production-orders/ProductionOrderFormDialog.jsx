import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ProductionOrderFormDialog({ open, onClose, onSave, recipes, products }) {
  const [form, setForm] = useState({
    product_id: "",
    quantity_to_produce: "",
    target_completion_date: "",
    notes: "",
  });

  const handleSave = () => {
    const product = products.find(p => p.id === form.product_id);
    if (!form.product_id || !product?.recipe_id || !form.quantity_to_produce) return;
    onSave({ ...form, recipe_id: product.recipe_id });
    setForm({ product_id: "", quantity_to_produce: "", target_completion_date: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Production Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product *</Label>
            <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.product_id && (
            <div className="space-y-2">
              <Label>Recipe</Label>
              <div className="px-3 py-2 border rounded-md bg-muted text-sm">
                {products.find(p => p.id === form.product_id)?.recipe_name || "No recipe assigned"}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Quantity to Produce (lbs)</Label>
            <Input 
              type="number" 
              value={form.quantity_to_produce}
              onChange={e => setForm({ ...form, quantity_to_produce: e.target.value })}
              placeholder="100"
            />
          </div>

          <div className="space-y-2">
            <Label>Target Completion Date</Label>
            <Input 
              type="date"
              value={form.target_completion_date}
              onChange={e => setForm({ ...form, target_completion_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special instructions..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Create Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}