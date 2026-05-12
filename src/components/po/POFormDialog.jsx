import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Save, FileText } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = ["beef", "pork", "poultry", "lamb", "seasoning", "casing", "packaging", "additive", "other"];

export default function POFormDialog({ open, onClose, onSave, po }) {
  const [suppliers, setSuppliers] = useState([]);
  const [showSaveSupplier, setShowSaveSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [showShipToForm, setShowShipToForm] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showSaveAddressForm, setShowSaveAddressForm] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [form, setForm] = useState(po && po.po_number ? {
    po_number: po.po_number,
    supplier: po.supplier,
    supplier_email: po.supplier_email || "",
    order_date: po.order_date,
    expected_delivery_date: po.expected_delivery_date,
    status: po.status,
    line_items: po.line_items || [],
    total_amount: po.total_amount,
    notes: po.notes || "",
    ship_to_address: po.ship_to_address || "",
    ship_to_contact_name: po.ship_to_contact_name || "",
    ship_to_contact_phone: po.ship_to_contact_phone || "",
  } : {
    po_number: `PO-${Math.floor(Math.random() * 1000000)}`,
    supplier: "",
    supplier_email: "",
    order_date: format(new Date(), 'yyyy-MM-dd'),
    expected_delivery_date: "",
    status: "draft",
    line_items: [],
    total_amount: 0,
    notes: "",
    ship_to_address: "",
    ship_to_contact_name: "",
    ship_to_contact_phone: "",
  });

  useEffect(() => {
    if (open) {
      base44.entities.Supplier.list().then(data => {
        setSuppliers(data.map(s => ({ id: s.id, name: s.name })));
      });
      base44.entities.ShipToAddress.list().then(data => {
        setSavedAddresses(data);
      });
      // Update form when po prop changes
      if (po && po.po_number) {
        setForm({
          po_number: po.po_number,
          supplier: po.supplier,
          supplier_email: po.supplier_email || "",
          order_date: po.order_date,
          expected_delivery_date: po.expected_delivery_date,
          status: po.status,
          line_items: po.line_items || [],
          total_amount: po.total_amount,
          notes: po.notes || "",
          ship_to_address: po.ship_to_address || "",
          ship_to_contact_name: po.ship_to_contact_name || "",
          ship_to_contact_phone: po.ship_to_contact_phone || "",
        });
      }
    }
  }, [open, po]);

  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      line_items: [...(prev.line_items || []), {
        material_name: "",
        category: "beef",
        quantity_lbs: 0,
        unit_price: 0,
      }],
    }));
  };

  const updateLineItem = (idx, field, value) => {
    const items = [...form.line_items];
    items[idx][field] = value;
    setForm(prev => ({
      ...prev,
      line_items: items,
      total_amount: items.reduce((sum, item) => sum + (item.quantity_lbs * item.unit_price), 0),
    }));
  };

  const removeLineItem = (idx) => {
    const items = form.line_items.filter((_, i) => i !== idx);
    setForm(prev => ({
      ...prev,
      line_items: items,
      total_amount: items.reduce((sum, item) => sum + (item.quantity_lbs * item.unit_price), 0),
    }));
  };

  const handleSave = () => {
    if (!form.po_number || !form.supplier) {
      alert("PO Number and Supplier are required");
      return;
    }
    if (!form.supplier_email) {
      alert("Supplier email is required");
      return;
    }
    if (!form.ship_to_address || !form.ship_to_contact_name || !form.ship_to_contact_phone) {
      alert("Ship-to address, contact name, and contact phone are required");
      return;
    }
    onSave(form);
  };

  const generatePDF = async () => {
    try {
      const response = await base44.functions.invoke('generatePurchaseOrderPDF', { po: form });
      if (response.data?.pdf_url) {
        window.open(response.data.pdf_url, '_blank');
      }
    } catch (error) {
      alert("Error generating PDF: " + error.message);
    }
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
                <Select value={form.supplier} onValueChange={v => {
                  if (v === "__CREATE_NEW__") {
                    setShowSaveSupplier(true);
                  } else {
                    setForm(prev => ({ ...prev, supplier: v }));
                  }
                }}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select or type supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                      <div className="border-t py-1">
                        <SelectItem value="__CREATE_NEW__" className="text-primary font-medium">
                          + Create New Supplier
                        </SelectItem>
                      </div>
                    </SelectContent>
                  </Select>
              </div>
              <div className="mt-2">
                <Label className="text-sm">Supplier Email *</Label>
                <Input
                  type="email"
                  value={form.supplier_email}
                  onChange={e => setForm(prev => ({ ...prev, supplier_email: e.target.value }))}
                  placeholder="supplier@company.com"
                />
              </div>
              {showSaveSupplier && (
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <Input
                    placeholder="Supplier name"
                    value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)}
                    className="mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
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
                      className="flex-1"
                    >
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowSaveSupplier(false);
                        setNewSupplierName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
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
                        value={item.quantity_lbs || ""}
                        onChange={e => updateLineItem(idx, 'quantity_lbs', e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
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
                    Subtotal: ${(item.quantity_lbs * item.unit_price).toFixed(2)}
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

          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <Label className="text-sm font-medium text-blue-900">Email will be sent from:</Label>
            <p className="text-sm text-blue-700 mt-1">noreply@resend.dev</p>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Ship-To Information *</Label>
              {form.ship_to_address && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowShipToForm(!showShipToForm)}
                >
                  {showShipToForm ? "Hide" : "Edit"}
                </Button>
              )}
            </div>
            {savedAddresses.length > 0 && (
              <div className="mb-3">
                <Label className="text-sm">Select Saved Address</Label>
                <Select 
                  value="" 
                  onValueChange={(id) => {
                    const addr = savedAddresses.find(a => a.id === id);
                    if (addr) {
                      setForm(prev => ({
                        ...prev,
                        ship_to_contact_name: addr.contact_name,
                        ship_to_address: addr.address,
                        ship_to_contact_phone: addr.phone,
                      }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Load saved address..." /></SelectTrigger>
                  <SelectContent>
                    {savedAddresses.map(addr => (
                      <SelectItem key={addr.id} value={addr.id}>{addr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!form.ship_to_address ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setShowShipToForm(true)}
              >
                + Add Ship-To Address
              </Button>
            ) : (
              <div className="p-3 bg-muted/30 rounded border">
                <p className="text-sm font-medium">{form.ship_to_contact_name}</p>
                <p className="text-sm text-muted-foreground">{form.ship_to_address}</p>
                <p className="text-sm text-muted-foreground">{form.ship_to_contact_phone}</p>
              </div>
            )}
            {showShipToForm && (
              <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200 space-y-3">
                <div>
                  <Label className="text-sm">Contact Name *</Label>
                  <Input
                    value={form.ship_to_contact_name}
                    onChange={e => setForm(prev => ({ ...prev, ship_to_contact_name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label className="text-sm">Address *</Label>
                  <Textarea
                    value={form.ship_to_address}
                    onChange={e => setForm(prev => ({ ...prev, ship_to_address: e.target.value }))}
                    placeholder="123 Main St, City, State ZIP"
                    rows={2}
                  />
                </div>
                <div>
                  <Label className="text-sm">Phone Number *</Label>
                  <Input
                    value={form.ship_to_contact_phone}
                    onChange={e => setForm(prev => ({ ...prev, ship_to_contact_phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-blue-600 border-blue-300 hover:bg-blue-100"
                  onClick={() => setShowSaveAddressForm(true)}
                >
                  Save This Address
                </Button>
              </div>
            )}
            {showSaveAddressForm && (
              <div className="mt-3 p-3 bg-green-50 rounded border border-green-200 space-y-2">
                <Label className="text-sm font-medium">Save as (e.g. "Main Facility")</Label>
                <Input
                  value={addressLabel}
                  onChange={e => setAddressLabel(e.target.value)}
                  placeholder="Address label"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (addressLabel.trim()) {
                        await base44.entities.ShipToAddress.create({
                          name: addressLabel,
                          contact_name: form.ship_to_contact_name,
                          address: form.ship_to_address,
                          phone: form.ship_to_contact_phone,
                        });
                        const updated = await base44.entities.ShipToAddress.list();
                        setSavedAddresses(updated);
                        setAddressLabel("");
                        setShowSaveAddressForm(false);
                      }
                    }}
                    className="flex-1"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowSaveAddressForm(false);
                      setAddressLabel("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
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

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {po && form.line_items?.length > 0 && (
            <Button
              variant="outline"
              onClick={generatePDF}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Generate PDF
            </Button>
          )}
          <Button onClick={handleSave}>{po ? "Update" : "Create"} PO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}