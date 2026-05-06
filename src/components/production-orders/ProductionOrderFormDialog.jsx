import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ProductionOrderFormDialog({ open, onClose, onSave, recipes, products, suppliers }) {
  const [form, setForm] = useState({
    order_number: "",
    product_id: "",
    supplier_id: "",
    quantity_to_produce: "",
    target_completion_date: "",
    notes: "",
  });

  const handleSave = () => {
    const product = products.find(p => p.id === form.product_id);
    if (!form.order_number || !form.product_id || !product?.recipe_id || !form.quantity_to_produce || !form.supplier_id) return;
    onSave({ ...form, recipe_id: product.recipe_id });
    setForm({ order_number: "", product_id: "", supplier_id: "", quantity_to_produce: "", target_completion_date: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Production Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Order Number *</Label>
            <Input 
              value={form.order_number}
              onChange={e => setForm({ ...form, order_number: e.target.value })}
              placeholder="e.g. PO-001"
            />
          </div>

          <div className="space-y-2">
            <Label>Company/Supplier *</Label>
            <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
            <>
              <div className="space-y-2">
                <Label>Recipe</Label>
                <div className="px-3 py-2 border rounded-md bg-muted text-sm">
                  {products.find(p => p.id === form.product_id)?.recipe_name || "No recipe assigned"}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity to Produce ({products.find(p => p.id === form.product_id)?.finished_product_unit || "lbs"})</Label>
                <Input 
                  type="number" 
                  value={form.quantity_to_produce}
                  onChange={e => setForm({ ...form, quantity_to_produce: e.target.value })}
                  placeholder="5"
                />
              </div>
            </>
          )}

          {!form.product_id && (
            <div className="space-y-2">
              <Label>Quantity to Produce</Label>
              <Input 
                type="number" 
                value={form.quantity_to_produce}
                onChange={e => setForm({ ...form, quantity_to_produce: e.target.value })}
                placeholder="Select a product first"
                disabled
              />
            </div>
          )}

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
          <Button onClick={handleSave} disabled={!form.order_number || !form.product_id || !form.supplier_id || !form.quantity_to_produce}>Create Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}