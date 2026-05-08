import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default function ProductionOrderFormDialog({ open, onClose, onSave, order, products, flows, suppliers, recipes }) {
  const [form, setForm] = useState({
    order_number: "", product_id: "", product_name: "", flow_id: "", flow_name: "",
    supplier_id: "", supplier_name: "", quantity_to_produce: "", order_date: new Date().toISOString().split("T")[0],
    target_completion_date: "", status: "pending", notes: ""
  });
  const [homeStock, setHomeStock] = useState(false);
  const [units, setUnits] = useState("");

  useEffect(() => {
    if (order) {
      setForm(order);
      setHomeStock(!order.supplier_id);
      setUnits("");
    } else {
      setForm({
        order_number: `PO-${Date.now().toString().slice(-6)}`,
        product_id: "", product_name: "", flow_id: "", flow_name: "",
        supplier_id: "", supplier_name: "", quantity_to_produce: "",
        order_date: new Date().toISOString().split("T")[0],
        target_completion_date: "", status: "pending", notes: ""
      });
      setHomeStock(false);
      setUnits("");
    }
  }, [order, open]);

  const handleHomeStockToggle = (checked) => {
    setHomeStock(checked);
    if (checked) setForm(f => ({ ...f, supplier_id: "", supplier_name: "" }));
  };

  const selectedProduct = products.find(p => p.id === form.product_id);
  const selectedRecipe = recipes?.find(r => r.id === selectedProduct?.recipe_id);
  const caseWeightLbs = selectedProduct?.case_weight_lbs;
  const unitLabel = selectedProduct?.finished_product_unit || "cases";
  const yieldPct = selectedRecipe?.yield_percent; // e.g. 95 means 95%

  // finished goods lbs (what the customer/order wants out)
  const finishedLbs = parseFloat(form.quantity_to_produce) || 0;
  // raw input needed accounting for yield loss
  const rawInputLbs = yieldPct && finishedLbs ? (finishedLbs / (yieldPct / 100)) : finishedLbs;
  // blending batch count
  const blendBatchLbs = selectedProduct?.blend_batch_lbs;
  const numBlendBatches = blendBatchLbs && rawInputLbs ? Math.ceil(rawInputLbs / blendBatchLbs) : null;

  const handleProductSelect = (pid) => {
    const p = products.find(prod => prod.id === pid);
    const matchedFlow = flows.find(f => f.id === p?.flow_id);
    setUnits("");
    setForm(f => ({
      ...f,
      product_id: pid,
      product_name: p?.name || "",
      flow_id: p?.flow_id || f.flow_id,
      flow_name: matchedFlow?.name || p?.flow_name || f.flow_name,
      quantity_to_produce: "",
    }));
  };

  const handleUnitsChange = (val) => {
    setUnits(val);
    if (val && caseWeightLbs) {
      const lbs = parseFloat(val) * caseWeightLbs;
      setForm(f => ({ ...f, quantity_to_produce: lbs.toFixed(1) }));
    }
  };

  const handleLbsChange = (val) => {
    setForm(f => ({ ...f, quantity_to_produce: val }));
    setUnits("");
  };

  const handleFlowSelect = (fid) => {
    const fl = flows.find(f => f.id === fid);
    setForm(f => ({ ...f, flow_id: fid, flow_name: fl?.name || "" }));
  };

  const handleSupplierSelect = (sid) => {
    const s = suppliers.find(s => s.id === sid);
    setForm(f => ({ ...f, supplier_id: sid, supplier_name: s?.name || "" }));
  };

  const handleSave = () => {
    if (!form.order_number || !form.product_id || !form.quantity_to_produce) return;
    onSave({ ...form, quantity_to_produce: Number(form.quantity_to_produce) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Edit Order" : "New Production Order"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Order Number</Label>
            <Input value={form.order_number} onChange={e => setForm(f => ({ ...f, order_number: e.target.value }))} />
          </div>

          {/* Show status only when editing an existing order */}
          {order && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={form.product_id} onValueChange={handleProductSelect}>
              <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
              <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Production Flow <span className="text-xs text-muted-foreground">(auto-set from product)</span></Label>
            <Select value={form.flow_id} onValueChange={handleFlowSelect}>
              <SelectTrigger><SelectValue placeholder="Select product first..." /></SelectTrigger>
              <SelectContent>{flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox checked={homeStock} onCheckedChange={handleHomeStockToggle} />
            <span className="text-sm font-medium">Home Stock</span>
            <span className="text-xs text-muted-foreground">(producing to replenish in-house inventory)</span>
          </label>

          {!homeStock && (
            <div className="space-y-1.5">
              <Label>Purchasing Company</Label>
              <Select value={form.supplier_id} onValueChange={handleSupplierSelect}>
                <SelectTrigger><SelectValue placeholder="Select purchasing company..." /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Quantity to Produce
              {unitLabel !== "lbs" && caseWeightLbs
                ? ` (${unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)})`
                : " (lbs)"}
            </Label>
            {unitLabel !== "lbs" && caseWeightLbs ? (
              <div className="space-y-1">
                <Input
                  type="number"
                  step="1"
                  value={units}
                  onChange={e => handleUnitsChange(e.target.value)}
                  placeholder={`e.g. 10 ${unitLabel}`}
                />
                {units && (
                  <p className="text-xs text-muted-foreground">
                    {units} {unitLabel} × {caseWeightLbs} lbs = <span className="font-medium text-foreground">{form.quantity_to_produce} lbs</span>
                  </p>
                )}
              </div>
            ) : (
              <Input
                type="number"
                step="0.1"
                value={form.quantity_to_produce}
                onChange={e => handleLbsChange(e.target.value)}
                placeholder="e.g. 500"
              />
            )}
            {finishedLbs > 0 && (
              <div className={`rounded-md p-2.5 mt-1 text-xs space-y-0.5 ${yieldPct ? "bg-accent/10 border border-accent/20" : "bg-muted"}`}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finished goods target:</span>
                  <span className="font-medium">{finishedLbs.toFixed(1)} lbs</span>
                </div>
                {yieldPct ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recipe yield:</span>
                      <span className="font-medium">{yieldPct}%</span>
                    </div>
                    <div className="flex justify-between border-t border-accent/20 pt-1 mt-1">
                      <span className="font-semibold text-foreground">Raw input needed:</span>
                      <span className="font-bold text-accent">{rawInputLbs.toFixed(1)} lbs</span>
                    </div>
                    {numBlendBatches && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Blending batches ({blendBatchLbs} lbs each):</span>
                        <span className="font-bold text-foreground">{numBlendBatches} batch{numBlendBatches > 1 ? "es" : ""}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground italic">Link a recipe to the product to calculate yield-adjusted raw input.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Order Date</Label>
              <Input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Completion</Label>
              <Input type="date" value={form.target_completion_date} onChange={e => setForm(f => ({ ...f, target_completion_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-16" />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.order_number || !form.product_id || !form.quantity_to_produce}>
            {order ? "Update" : "Create"} Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}