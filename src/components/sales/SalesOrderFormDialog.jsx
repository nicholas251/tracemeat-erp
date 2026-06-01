import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

function genOrderNumber() {
  return "SO-" + Date.now().toString().slice(-6);
}

export default function SalesOrderFormDialog({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    order_number: genOrderNumber(),
    customer_id: "", customer_name: "",
    order_date: new Date().toISOString().slice(0, 10),
    ship_date: "", route: "", status: "draft", notes: "", line_items: []
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-active"],
    queryFn: () => base44.entities.Customer.filter({ status: "active" }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => base44.entities.Product.filter({ status: "active" }),
  });

  const { data: allPricing = [] } = useQuery({
    queryKey: ["customerPricing", form.customer_id],
    queryFn: () => base44.entities.CustomerPricing.filter({ customer_id: form.customer_id }),
    enabled: !!form.customer_id,
  });

  useEffect(() => {
    if (open) setForm(f => ({ ...f, order_number: genOrderNumber() }));
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    set("customer_id", id);
    set("customer_name", c?.name || "");
  };

  const addLine = () => {
    setForm(f => ({
      ...f,
      line_items: [...f.line_items, {
        product_id: "", product_name: "", sku: "",
        cases_qty: 1, case_weight_lbs: "", total_lbs: 0,
        price_per_case: "", price_per_lb: "", line_total: 0,
        is_variable_weight: false
      }]
    }));
  };

  const removeLine = (i) => {
    setForm(f => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }));
  };

  const updateLine = (i, updates) => {
    setForm(f => {
      const items = f.line_items.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, ...updates };
        // recalculate totals
        const cases = parseFloat(updated.cases_qty) || 0;
        const caseW = parseFloat(updated.case_weight_lbs) || 0;
        updated.total_lbs = cases * caseW;
        if (updated.is_variable_weight && updated.price_per_lb) {
          updated.line_total = updated.total_lbs * (parseFloat(updated.price_per_lb) || 0);
        } else if (updated.price_per_case) {
          updated.line_total = cases * (parseFloat(updated.price_per_case) || 0);
        } else {
          updated.line_total = 0;
        }
        return updated;
      });
      return { ...f, line_items: items };
    });
  };

  const handleProductSelect = (i, productId) => {
    const p = products.find(p => p.id === productId);
    if (!p) return;
    const pricing = allPricing.find(pr => pr.product_id === productId);
    const isVariable = !p.case_weight_lbs;
    updateLine(i, {
      product_id: productId,
      product_name: p.name,
      sku: p.sku || "",
      case_weight_lbs: p.case_weight_lbs || "",
      is_variable_weight: isVariable,
      price_per_case: pricing?.price_per_case || "",
      price_per_lb: pricing?.price_per_lb || "",
    });
  };

  const totalAmount = form.line_items.reduce((s, l) => s + (l.line_total || 0), 0);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.SalesOrder.create({ ...data, total_amount: totalAmount }),
    onSuccess: onSaved,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>New Sales Order</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-2">
          <div>
            <Label>Order Number</Label>
            <Input value={form.order_number} onChange={e => set("order_number", e.target.value)} />
          </div>
          <div>
            <Label>Order Date *</Label>
            <Input type="date" value={form.order_date} onChange={e => set("order_date", e.target.value)} />
          </div>
          <div>
            <Label>Ship Date</Label>
            <Input type="date" value={form.ship_date} onChange={e => set("ship_date", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Customer *</Label>
            <Select value={form.customer_id} onValueChange={handleCustomerChange}>
              <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route</Label>
            <Select value={form.route} onValueChange={v => set("route", v)}>
              <SelectTrigger><SelectValue placeholder="Assign route..." /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="101">Route 101</SelectItem>
                <SelectItem value="102">Route 102</SelectItem>
                <SelectItem value="103">Route 103</SelectItem>
                <SelectItem value="104">Route 104</SelectItem>
                <SelectItem value="105">Route 105</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Line Items */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Line Items</h3>
            <Button size="sm" variant="outline" onClick={addLine} disabled={!form.customer_id}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
            </Button>
          </div>

          {form.line_items.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded">
              {form.customer_id ? "Click 'Add Item' to add products." : "Select a customer first."}
            </p>
          )}

          <div className="space-y-2">
            {form.line_items.map((item, i) => (
              <div key={i} className="border rounded p-3 bg-muted/20 space-y-2">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <label className="text-xs text-muted-foreground">Product</label>
                    <Select value={item.product_id} onValueChange={v => handleProductSelect(i, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent position="popper" className="max-h-72 overflow-y-auto">
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Cases</label>
                    <Input type="number" min="1" className="h-8 text-xs" value={item.cases_qty}
                      onChange={e => updateLine(i, { cases_qty: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">
                      {item.is_variable_weight ? "Lbs/Case (enter)" : "Lbs/Case"}
                    </label>
                    <Input type="number" step="0.1" className="h-8 text-xs"
                      value={item.case_weight_lbs}
                      readOnly={!item.is_variable_weight && !!item.case_weight_lbs && item.product_id}
                      onChange={e => updateLine(i, { case_weight_lbs: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">
                      {item.is_variable_weight ? "$/lb" : "$/case"}
                    </label>
                    <Input type="number" step="0.01" className="h-8 text-xs"
                      value={item.is_variable_weight ? item.price_per_lb : item.price_per_case}
                      onChange={e => updateLine(i, item.is_variable_weight
                        ? { price_per_lb: e.target.value }
                        : { price_per_case: e.target.value })} />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-muted-foreground">Total $</label>
                    <div className="h-8 flex items-center text-xs font-medium">${(item.line_total || 0).toFixed(2)}</div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeLine(i)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {item.product_id && (
                  <div className="text-xs text-muted-foreground">
                    Total: {(item.total_lbs || 0).toFixed(1)} lbs
                    {item.is_variable_weight && " · variable weight"}
                  </div>
                )}
              </div>
            ))}
          </div>

          {form.line_items.length > 0 && (
            <div className="flex justify-end mt-3 text-sm font-semibold">
              Order Total: ${totalAmount.toFixed(2)}
            </div>
          )}
        </div>

        <div className="mt-3">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={!form.customer_id || !form.order_date || form.line_items.length === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Create Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}