import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

export default function CustomerPricingDialog({ open, customer, onClose }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ product_id: "", product_name: "", price_per_case: "", price_per_lb: "" });

  const { data: pricing = [] } = useQuery({
    queryKey: ["customerPricing", customer?.id],
    queryFn: () => base44.entities.CustomerPricing.filter({ customer_id: customer.id }),
    enabled: !!customer?.id && open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => base44.entities.Product.filter({ status: "active" }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CustomerPricing.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerPricing", customer.id] });
      setAdding(false);
      setForm({ product_id: "", product_name: "", price_per_case: "", price_per_lb: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomerPricing.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customerPricing", customer.id] }),
  });

  const handleAdd = () => {
    if (!form.product_id) return;
    createMutation.mutate({
      customer_id: customer.id,
      customer_name: customer.name,
      product_id: form.product_id,
      product_name: form.product_name,
      price_per_case: form.price_per_case ? parseFloat(form.price_per_case) : null,
      price_per_lb: form.price_per_lb ? parseFloat(form.price_per_lb) : null,
    });
  };

  const handleProductSelect = (id) => {
    const p = products.find(p => p.id === id);
    setForm(f => ({ ...f, product_id: id, product_name: p?.name || "" }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pricing — {customer?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {pricing.length === 0 && !adding && (
            <p className="text-muted-foreground text-sm py-4 text-center">No pricing set yet.</p>
          )}
          {pricing.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-muted/30 rounded px-3 py-2">
              <span className="flex-1 font-medium text-sm">{p.product_name}</span>
              {p.price_per_case != null && (
                <span className="text-sm text-muted-foreground">${p.price_per_case.toFixed(2)}/case</span>
              )}
              {p.price_per_lb != null && (
                <span className="text-sm text-muted-foreground">${p.price_per_lb.toFixed(2)}/lb</span>
              )}
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(p.id)} className="text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}

          {adding && (
            <div className="border rounded p-3 space-y-3 bg-card">
              <Select value={form.product_id} onValueChange={handleProductSelect}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Price per Case ($)</label>
                  <Input type="number" step="0.01" placeholder="0.00" value={form.price_per_case}
                    onChange={e => setForm(f => ({ ...f, price_per_case: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Price per Lb ($) — variable weight</label>
                  <Input type="number" step="0.01" placeholder="0.00" value={form.price_per_lb}
                    onChange={e => setForm(f => ({ ...f, price_per_lb: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={!form.product_id || createMutation.isPending}>Add</Button>
              </div>
            </div>
          )}
        </div>

        {!adding && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Product Pricing
          </Button>
        )}

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}