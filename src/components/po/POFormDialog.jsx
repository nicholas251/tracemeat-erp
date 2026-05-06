import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Save } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = ["beef", "pork", "poultry", "lamb", "seasoning", "casing", "packaging", "additive", "other"];

export default function POFormDialog({ open, onClose, onSave, po }) {
  const [suppliers, setSuppliers] = useState([]);
  const [showSaveSupplier, setShowSaveSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [form, setForm] = useState(po ? {
    po_number: po.data.po_number,
    supplier: po.data.supplier,
    order_date: po.data.order_date,
    expected_delivery_date: po.data.expected_delivery_date,
    status: po.data.status,
    line_items: po.data.line_items || [],
    total_amount: po.data.total_amount,
    notes: po.data.notes || "",
  } : {
    po_number: `PO-${Date.now()}`,
    supplier: "",
    order_date: format(new Date(), 'yyyy-MM-dd'),
    expected_delivery_date: "",
    status: "draft",
    line_items: [],
    total_amount: 0,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      base44.entities.Supplier.list().then(data => {
        setSuppliers(data.map(s => ({ id: s.id, name: s.name })));
      });
    }
  }, [open]);

  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      line_items: [...(prev.line_items || []), {
        material_name: "",
        category: "beef",
        quantity_kg: 0,
        unit_price: 0,
        received_qty_kg: 0,
      }],
    }));
  };

  const updateLineItem = (idx, field, value) => {
    const items = [...form.line_items];
    items[idx][field] = value;
    setForm(prev => ({
      ...prev,
      line_items: items,
      total_amount: items.reduce((sum, item) => sum + (item.quantity_kg * item.unit_price), 0),
    }));
  };

  const removeLineItem = (idx) => {
    const items = form.line_items.filter((_, i) => i !== idx);
    setForm(prev => ({
      ...prev,
      line_items: items,
      total_amount: items.reduce((sum, item) => sum + (item.quantity_kg * item.unit_price), 0),
    }));
  };

  const handleSave = () => {
    if (!form.po_number || !form.supplier) {
      alert("PO Number and Supplier are required");
      return;
    }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{po ? "Edit Purchase Order" : "New Purchase Order"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>PO Number *</Label>
              <Input
                value={form.po_number}
                onChange={e => setForm(prev => ({ ...prev, po_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>Supplier *</Label>
              <div className="flex gap-2">
                <Select value={form.supplier} onValueChange={v => setForm(prev => ({ ...prev, supplier: v }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select or type supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveSupplier(!showSaveSupplier)}
                  title="Save this supplier for future use"
                >
                  <Save className="w-4 h-4" />
                </Button>
              </div>
              {showSaveSupplier && (
                <div className="mt-2 p-2 bg-muted/50 rounded border">
                  <Input
                    placeholder="Supplier name to save"
                    value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)}
                    className="mb-2"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (newSupplierName.trim()) {
                        await base44.entities.Supplier.create({ name: newSupplierName });
                        setForm(prev => ({ ...prev, supplier: newSupplierName }));
                        setNewSupplierName("");
                        setShowSaveSupplier(false);
                        const updated = await base44.entities.Supplier.list();
                        setSuppliers(updated.map(s => ({ id: s.id, name: s.name })));
                      }
                    }}
                    className="w-full"
                  >
                    Save Supplier
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Order Date</Label>
              <Input
                type="date"
                value={form.order_date}
                onChange={e => setForm(prev => ({ ...prev, order_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={form.expected_delivery_date}
                onChange={e => setForm(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold mb-3 block">Line Items</Label>
            <div className="space-y-3">
              {form.line_items.map((item, idx) => (
                <Card key={idx} className="p-3 bg-muted/30">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                    <div>
                      <Label className="text-xs">Material Name *</Label>
                      <Input
                        value={item.material_name}
                        onChange={e => updateLineItem(idx, 'material_name', e.target.value)}
                        placeholder="e.g. Ground Beef"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select value={item.category} onValueChange={v => updateLineItem(idx, 'category', v)}>
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
                      <Label className="text-xs">Qty (lbs) *</Label>
                      <Input
                        type="number"
                        value={item.quantity_kg || ""}
                        onChange={e => updateLineItem(idx, 'quantity_kg', e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Unit Price ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={e => updateLineItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeLineItem(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    Subtotal: ${(item.quantity_kg * item.unit_price).toFixed(2)}
                  </div>
                </Card>
              ))}

              <Button size="sm" variant="outline" onClick={addLineItem} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
              </Button>
            </div>
          </div>

          <div className="bg-accent/10 p-3 rounded-lg">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold text-accent">${form.total_amount.toFixed(2)}</p>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special instructions..."
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{po ? "Update" : "Create"} PO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}