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
import { jsPDF } from "jspdf";

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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 15;

    // Company branding header
    doc.setFillColor(220, 53, 69);
    doc.rect(0, yPos - 5, pageWidth, 20, 'F');
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text("MITTY'S FOODS", 15, yPos + 8);

    // Fetch and add logo
    try {
      const logoUrl = 'https://media.base44.com/images/public/69fa3d25d6b48b9b300a8c3a/abc6cd33d_MittysFoods_GroteWiegel_MuckesLogos.png';
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgData = e.target.result;
        doc.addImage(imgData, 'PNG', pageWidth - 65, yPos - 3, 50, 25);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      // Logo fetch failed, continue without it
    }

    yPos += 25;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Quality Meat Products | sales@mittysfood.com', 15, yPos);
    yPos += 10;

    // Header - Company info and PO title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PURCHASE ORDER', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // PO Number and dates in a box
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, yPos, pageWidth - 30, 20);
    
    doc.setFont(undefined, 'bold');
    doc.text('PO Number:', 20, yPos + 5);
    doc.setFont(undefined, 'normal');
    doc.text(form.po_number, 50, yPos + 5);
    
    doc.setFont(undefined, 'bold');
    doc.text('Order Date:', 120, yPos + 5);
    doc.setFont(undefined, 'normal');
    doc.text(form.order_date || 'N/A', 150, yPos + 5);
    
    doc.setFont(undefined, 'bold');
    doc.text('Expected Delivery:', 20, yPos + 12);
    doc.setFont(undefined, 'normal');
    doc.text(form.expected_delivery_date || 'N/A', 50, yPos + 12);

    yPos += 25;

    // Two-column layout: FROM and SHIP-TO
    const colX1 = 15;
    const colX2 = pageWidth / 2 + 5;
    const colWidth = pageWidth / 2 - 15;

    // FROM section
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('FROM:', colX1, yPos);
    yPos += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Email: sales@mittysfood.com', colX1, yPos);
    
    // SHIP-TO section
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('SHIP-TO:', colX2, yPos - 7);
    yPos += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    if (form.ship_to_contact_name) {
      doc.text(`Attn: ${form.ship_to_contact_name}`, colX2, yPos - 7);
    }
    
    yPos += 8;
    doc.setFontSize(8);
    
    // SUPPLIER section
    doc.setFont(undefined, 'bold');
    doc.text('SUPPLIER:', colX1, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    const supplierLines = doc.splitTextToSize(form.supplier, colWidth - 2);
    doc.text(supplierLines, colX1, yPos);
    
    // ADDRESS section
    const maxAddressLines = Math.max(supplierLines.length, 2);
    let addressY = yPos;
    if (form.ship_to_address) {
      const addressLines = doc.splitTextToSize(form.ship_to_address, colWidth - 2);
      doc.text(addressLines, colX2, addressY);
      addressY += addressLines.length * 4;
    }
    if (form.ship_to_contact_phone) {
      doc.text(`Phone: ${form.ship_to_contact_phone}`, colX2, addressY + 4);
    }

    yPos += maxAddressLines * 4 + 10;

    // Line Items Table
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setFillColor(41, 128, 185);
    doc.setTextColor(255, 255, 255);
    
    const colWidths = [70, 35, 30, 30, 30];
    const headers = ['Item', 'Category', 'Qty (lbs)', 'Unit Price', 'Total'];
    let xPos = 15;
    const headerY = yPos;
    const rowHeight = 8;

    headers.forEach((header, idx) => {
      doc.rect(xPos, headerY, colWidths[idx], rowHeight, 'F');
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.text(header, xPos + 2, headerY + 5.5, { align: 'left' });
      xPos += colWidths[idx];
    });

    yPos = headerY + rowHeight;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    // Line items with alternating row colors
    let rowCount = 0;
    (form.line_items || []).forEach(item => {
      const total = (item.quantity_lbs || 0) * (item.unit_price || 0);
      
      if (rowCount % 2 === 1) {
        doc.setFillColor(240, 245, 250);
        doc.rect(15, yPos, pageWidth - 30, rowHeight, 'F');
      }

      const row = [
        item.material_name || '',
        item.category || '',
        (item.quantity_lbs || 0).toFixed(2),
        `$${(item.unit_price || 0).toFixed(2)}`,
        `$${total.toFixed(2)}`
      ];

      xPos = 15;
      row.forEach((cell, idx) => {
        const align = idx > 1 ? 'right' : 'left';
        const cellX = align === 'right' ? xPos + colWidths[idx] - 2 : xPos + 2;
        doc.text(cell, cellX, yPos + 5.5, { align });
        xPos += colWidths[idx];
      });

      yPos += rowHeight;
      rowCount++;

      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 15;
        rowCount = 0;
      }
    });

    // Total section
    yPos += 2;
    doc.setFillColor(41, 128, 185);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`TOTAL: $${(form.total_amount || 0).toFixed(2)}`, pageWidth - 20, yPos + 6.5, { align: 'right' });

    yPos += 12;
    doc.setTextColor(0, 0, 0);

    // Notes section
    if (form.notes) {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Notes:', 15, yPos);
      yPos += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      const notesLines = doc.splitTextToSize(form.notes, pageWidth - 30);
      doc.text(notesLines, 15, yPos);
    }

    // Download
    setTimeout(() => {
      doc.save(`PO-${form.po_number}.pdf`);
    }, 500);
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

          <div className="bg-blue-50 p-3 rounded border border-blue-200 space-y-2">
            <div>
              <Label className="text-sm font-medium text-blue-900">Email will be sent via:</Label>
              <p className="text-sm text-blue-700">Gmail</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-blue-900">Subject line:</Label>
              <p className="text-sm text-blue-700">Purchase Order {form.po_number}</p>
            </div>
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