import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import InventoryShortageCheck from "./InventoryShortageCheck";

export default function ProductionOrderFormDialog({ open, onClose, onSave, order, products, flows, suppliers }) {
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

  // Fetch fresh product data so cure/casing fields are always up-to-date
  const { data: freshProductData } = useQuery({
    queryKey: ["freshProductForOrder", form.product_id],
    queryFn: () => base44.entities.Product.filter({ id: form.product_id }).then(r => r[0] || null),
    enabled: open && !!form.product_id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const selectedProduct = freshProductData || products.find(p => p.id === form.product_id);
  const unitLabel = selectedProduct?.finished_product_unit || "cases";
  // Only show case-based conversion if the product's unit is cases/packs/gaylords (not lbs)
  const isCaseUnit = unitLabel !== "lbs";
  const caseWeightLbs = isCaseUnit ? selectedProduct?.case_weight_lbs : null;
  const yieldPct = selectedProduct?.yield_percent;

  // Detect flow type
  const selectedFlow = flows?.find(f => f.id === form.flow_id);
  const firstStepKey = selectedFlow?.steps?.slice().sort((a, b) => a.step_number - b.step_number)[0]?.capability_key;
  const isTumbleFlow = firstStepKey === "tumbling" || firstStepKey === "tumble" || firstStepKey === "mixer";

  // finished goods target (what we want out)
  const finishedLbs = parseFloat(form.quantity_to_produce) || 0;

  // Loss % = 1 - yield%. Raw input = finished × (1 + loss%)
  const lossPct = yieldPct ? (100 - yieldPct) / 100 : 0;

  // ── TUMBLE FLOW MATH ──
  const tumbleBatchSize = selectedProduct?.tumble_batch_lbs || 800;
  const tumbleRawInputLbs = yieldPct && finishedLbs > 0 ? Math.ceil(finishedLbs * (1 + lossPct)) : finishedLbs;
  const numTumbleBatches = tumbleRawInputLbs > 0 ? Math.ceil(tumbleRawInputLbs / tumbleBatchSize) : null;
  const tumbleExpectedFinished = tumbleRawInputLbs * (yieldPct / 100);

  // ── BLENDING FLOW MATH ──
  const blendBatchLbs = selectedProduct?.blend_batch_lbs || 0;
  const waterPerBatch = selectedProduct?.chop_water_lbs || 0;
  const spicePerBatch = selectedProduct?.chop_spice_qty_lbs || 0;
  const curePerBatch = selectedProduct?.chop_cure_lbs || 0;
  // For blending: back-calculate protein needed, then determine batches
  const blendRawInputLbs = yieldPct && finishedLbs > 0 ? Math.ceil(finishedLbs * (1 + lossPct)) : finishedLbs;
  const numBlendBatches = blendBatchLbs > 0 && blendRawInputLbs > 0 ? Math.ceil(blendRawInputLbs / blendBatchLbs) : null;
  const rawInputLbs = blendBatchLbs > 0 && numBlendBatches ? blendBatchLbs * numBlendBatches : blendRawInputLbs;
  const totalWater = waterPerBatch * (numBlendBatches || 0);
  const totalSpice = spicePerBatch * (numBlendBatches || 0);
  const totalCure = curePerBatch * (numBlendBatches || 0);
  const totalChopWeight = (blendBatchLbs + waterPerBatch + spicePerBatch + curePerBatch) * (numBlendBatches || 0);
  const expectedFinished = yieldPct ? rawInputLbs * (yieldPct / 100) : rawInputLbs;

  const handleProductSelect = (pid) => {
    const p = products.find(prod => prod.id === pid);
    const matchedFlow = flows.find(f => f.id === p?.flow_id);
    setUnits("");
    setForm(f => ({
      ...f,
      product_id: pid,
      product_name: p?.name || "",
      recipe_id: p?.recipe_id || "",
      recipe_name: p?.recipe_name || "",
      flow_id: p?.flow_id || "",
      flow_name: (p?.flow_id && matchedFlow?.name) ? matchedFlow.name : (p?.flow_name || ""),
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

  const handleSupplierSelect = (sid) => {
    const s = suppliers.find(s => s.id === sid);
    setForm(f => ({ ...f, supplier_id: sid, supplier_name: s?.name || "" }));
  };

  const handleSave = () => {
    if (!form.order_number || !form.product_id || !form.quantity_to_produce) return;
    onSave({
      ...form,
      quantity_to_produce: Number(form.quantity_to_produce),
      flow_id: form.flow_id || "",
      flow_name: form.flow_name || ""
    });
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



          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={form.product_id} onValueChange={handleProductSelect}>
              <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
              <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Production Flow <span className="text-xs text-muted-foreground">(auto-assigned)</span></Label>
            <div className="flex items-center px-3 py-2 border rounded-md bg-muted/50">
              <span className="text-sm font-medium">{form.flow_name || "—"}</span>
            </div>
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
            <Label>Quantity to Produce</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Lbs</p>
                <Input
                  type="number"
                  step="0.1"
                  value={form.quantity_to_produce}
                  onChange={e => handleLbsChange(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)}
                  {caseWeightLbs ? ` (${caseWeightLbs} lbs each)` : " — select product first"}
                </p>
                <Input
                  type="number"
                  step="1"
                  value={units}
                  onChange={e => handleUnitsChange(e.target.value)}
                  placeholder={caseWeightLbs ? "e.g. 10" : "—"}
                  disabled={!caseWeightLbs}
                />
              </div>
            </div>
            {units && caseWeightLbs && (
              <p className="text-xs text-muted-foreground pt-0.5">
                {units} {unitLabel} × {caseWeightLbs} lbs = <span className="font-medium text-foreground">{form.quantity_to_produce} lbs</span> finished
              </p>
            )}
            {finishedLbs > 0 && (
              <div className={`rounded-md p-2.5 mt-1 text-xs space-y-0.5 ${yieldPct ? "bg-accent/10 border border-accent/20" : "bg-muted"}`}>
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Finished goods target:</span>
                  <span>{finishedLbs.toFixed(1)} lbs</span>
                </div>

                {isTumbleFlow ? (
                  // ── TUMBLE FLOW SUMMARY ──
                  yieldPct && numTumbleBatches ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Yield:</span>
                        <span className="font-medium">{yieldPct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Raw protein needed:</span>
                        <span className="font-semibold text-accent">{tumbleRawInputLbs.toFixed(1)} lbs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tumble batch size:</span>
                        <span className="font-medium">{tumbleBatchSize} lbs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tumble batches needed:</span>
                        <span className="font-medium">{numTumbleBatches} batch{numTumbleBatches > 1 ? "es" : ""}</span>
                      </div>
                      <div className="flex justify-between border-t border-accent/20 pt-1 mt-0.5 font-semibold">
                        <span className="text-foreground">Expected finished out:</span>
                        <span className="text-chart-2">{tumbleExpectedFinished.toFixed(1)} lbs</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">Set a yield % on the product to calculate batch requirements.</p>
                  )
                ) : (
                  // ── BLENDING FLOW SUMMARY ──
                  yieldPct && numBlendBatches ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Yield:</span>
                        <span className="font-medium">{yieldPct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Batches needed:</span>
                        <span className="font-medium">{numBlendBatches} batch{numBlendBatches > 1 ? "es" : ""}</span>
                      </div>
                      <div className="border-t border-accent/20 pt-1 mt-1 space-y-0.5">
                        <p className="text-muted-foreground font-medium uppercase tracking-wide" style={{fontSize:"9px"}}>Inputs across {numBlendBatches} batch{numBlendBatches > 1 ? "es" : ""}</p>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Protein (raw):</span>
                          <span className="font-semibold text-accent">{rawInputLbs.toFixed(1)} lbs</span>
                        </div>
                        {totalWater > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Water:</span>
                            <span className="font-medium">{totalWater.toFixed(1)} lbs</span>
                          </div>
                        )}
                        {totalSpice > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Spice mix:</span>
                            <span className="font-medium">{totalSpice.toFixed(1)} lbs</span>
                          </div>
                        )}
                        {totalCure > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cure:</span>
                            <span className="font-medium">{totalCure.toFixed(1)} lbs</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-accent/20 pt-1 mt-0.5">
                          <span className="text-muted-foreground">Total chop weight:</span>
                          <span className="font-medium">{totalChopWeight.toFixed(1)} lbs</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-foreground">Expected finished out:</span>
                          <span className="text-chart-2">{expectedFinished.toFixed(1)} lbs</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">Set a yield % on the product to calculate batch requirements.</p>
                  )
                )}
              </div>
            )}
          </div>

          {selectedProduct && (isTumbleFlow ? tumbleRawInputLbs : rawInputLbs) > 0 && (
           <InventoryShortageCheck
             product={selectedProduct}
             rawInputLbs={isTumbleFlow ? tumbleRawInputLbs : rawInputLbs}
             numBatches={isTumbleFlow ? numTumbleBatches : numBlendBatches}
             isTumbleFlow={isTumbleFlow}
             onProductUpdated={() => {}}
           />
          )}

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