import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProductSearchSelect from "@/components/production-orders/ProductSearchSelect";

const today = new Date().toISOString().slice(0, 10);

export default function AddFinishedGoodsDialog({ open, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ product_id: "", lot_number: "", cases: "", lbs: "", production_date: today, expiry_date: "", location: "", initials: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active-fg"],
    queryFn: async () => (await base44.entities.Product.filter({ status: "active" }, { sort: "name", limit: 1000, fields: ["name", "sku", "product_number", "category", "case_weight_lbs", "shelf_life_days"] })).items,
  });
  const product = products.find((p) => p.id === f.product_id);
  const lbs = Number(f.lbs) || (Number(f.cases) || 0) * (product?.case_weight_lbs || 0);
  const valid = product && f.lot_number.trim() && lbs > 0 && f.initials.trim().length >= 2;

  const save = async () => {
    setSaving(true);
    const cases = Number(f.cases) || 0;
    const note = `Manual entry by ${f.initials.trim().toUpperCase()} on ${new Date().toLocaleString()}`;
    await base44.entities.InventoryItem.create({
      product_id: product.id, product_name: product.name, sku: product.sku,
      batch_id: "manual", batch_number: f.lot_number.trim(), lot_number: f.lot_number.trim(),
      quantity_lbs: lbs, original_quantity_lbs: lbs, location: f.location, status: "available",
      production_date: f.production_date, expiry_date: f.expiry_date || undefined, notes: note,
    });
    const lot = { lot_number: f.lot_number.trim(), production_date: f.production_date, expiry_date: f.expiry_date, quantity_lbs: lbs, cases, order_number: "MANUAL", status: "available" };
    const existing = (await base44.entities.FinishedGoodsBucket.filter({ product_id: product.id }))[0];
    if (existing) {
      await base44.entities.FinishedGoodsBucket.update(existing.id, {
        quantity_lbs: (existing.quantity_lbs || 0) + lbs, cases_on_hand: (existing.cases_on_hand || 0) + cases, lots: [...(existing.lots || []), lot],
      });
    } else {
      await base44.entities.FinishedGoodsBucket.create({
        product_id: product.id, product_name: product.name, sku: product.sku, product_number: product.product_number, category: product.category,
        case_weight_lbs: product.case_weight_lbs, quantity_lbs: lbs, cases_on_hand: cases, lots: [lot], status: "active",
      });
    }
    qc.invalidateQueries();
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Finished Goods Lot</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Product</Label>
            <ProductSearchSelect products={products} value={f.product_id} onChange={(v) => setF({ ...f, product_id: v })} />
          </div>
          <div><Label>Lot Number</Label><Input value={f.lot_number} onChange={set("lot_number")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cases</Label><Input type="number" value={f.cases} onChange={set("cases")} /></div>
            <div><Label>Lbs {product?.case_weight_lbs && !f.lbs ? `(auto: ${lbs})` : ""}</Label><Input type="number" value={f.lbs} onChange={set("lbs")} /></div>
            <div><Label>Production Date</Label><Input type="date" value={f.production_date} onChange={set("production_date")} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={f.expiry_date} onChange={set("expiry_date")} /></div>
          </div>
          <div><Label>Location (optional)</Label><Input value={f.location} onChange={set("location")} /></div>
          <div><Label>Your Initials *</Label><Input maxLength={4} className="uppercase w-28" value={f.initials} onChange={set("initials")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={save}>{saving ? "Saving..." : "Add to Inventory"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}