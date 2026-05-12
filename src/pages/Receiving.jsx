import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { CheckCircle2, ArrowRight, Package, ChevronRight } from "lucide-react";

export default function Receiving() {
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get("po_id");

  const queryClient = useQueryClient();
  const [receivingState, setReceivingState] = useState({});
  const [selectedPOId, setSelectedPOId] = useState(poId || null);
  const [expandedItems, setExpandedItems] = useState({});

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const { data: buckets = [] } = useQuery({
    queryKey: ["inventory_buckets"],
    queryFn: () => base44.entities.InventoryBucket.list(),
  });

  const pendingPOs = pos.filter(p => p.status !== "received" && p.status !== "closed");

  const currentPO = useMemo(() => {
    if (selectedPOId) return pos.find(p => p.id === selectedPOId);
    return null;
  }, [pos, selectedPOId]);

  const createMaterialMutation = useMutation({
    mutationFn: (data) => base44.entities.RawMaterial.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["raw_materials"] }); },
  });

  const createRawInventoryMutation = useMutation({
    mutationFn: (data) => base44.entities.RawInventory.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["raw_inventory"] }); },
  });

  const updatePOMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseOrder.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["purchase_orders"] }); },
  });

  const handleReceiveItem = async (lineItemIndex) => {
    if (!currentPO) return;

    const item = currentPO.line_items[lineItemIndex];
    const key = `item_${lineItemIndex}`;
    const state = receivingState[key] || {};

    if (!state.expiryDate) { alert("Please set expiry date"); return; }
    if (!state.bucket_id) { alert("Please assign a bucket"); return; }
    if (!state.initials) { alert("Please enter receiver initials"); return; }
    if (!state.lotNumber) { alert("Please set a lot number"); return; }
    if (!state.receivedQty) { alert("Please enter actual received quantity"); return; }

    const receivedQty = parseFloat(state.receivedQty);
    const selectedBucket = buckets.find(b => b.id === state.bucket_id);
    const todayDate = format(new Date(), 'yyyy-MM-dd');

    const newMaterial = await createMaterialMutation.mutateAsync({
      po_id: currentPO.id,
      po_number: currentPO.po_number,
      lot_number: state.lotNumber,
      name: item.material_name,
      category: item.category,
      supplier: currentPO.supplier,
      received_date: todayDate,
      expiry_date: state.expiryDate,
      quantity_lbs: receivedQty,
      available_qty_lbs: receivedQty,
      temp_on_arrival_c: parseFloat(state.tempOnArrival) || null,
      status: "received",
      inspection_notes: state.notes || "",
    });

    await createRawInventoryMutation.mutateAsync({
      bucket_id: state.bucket_id,
      bucket_name: selectedBucket?.name || "",
      bucket_category: selectedBucket?.category || "",
      lot_number: state.lotNumber,
      raw_material_id: newMaterial.id,
      supplier: currentPO.supplier,
      description: item.material_name,
      po_number: currentPO.po_number,
      quantity: receivedQty,
      available_qty: receivedQty,
      unit: selectedBucket?.unit || "lbs",
      received_date: todayDate,
      expiry_date: state.expiryDate,
      status: "available",
      notes: `Receiver: ${state.initials.toUpperCase()} | Pallets: ${state.palletCount || 0} | Cases: ${state.caseCount || 0} | Company: ${state.company || "N/A"} | Date: ${todayDate}`,
    });

    const updatedLineItems = [...currentPO.line_items];
    updatedLineItems[lineItemIndex] = { ...updatedLineItems[lineItemIndex], received_qty_lbs: receivedQty };
    const allReceived = updatedLineItems.every(li => (li.received_qty_lbs || 0) >= li.quantity_lbs);

    await updatePOMutation.mutateAsync({
      id: currentPO.id,
      data: {
        line_items: updatedLineItems,
        status: allReceived ? "received" : "partial_received",
      },
    });

    setReceivingState(prev => ({ ...prev, [key]: { _done: true } }));
  };

  const getBucketsForCategory = (category) => {
    const proteinCats = ["beef", "pork", "poultry", "lamb"];
    const spiceCats = ["seasoning", "additive"];
    const packCats = ["packaging", "casing"];
    if (proteinCats.includes(category)) return buckets.filter(b => b.category === "protein" && b.status === "active");
    if (spiceCats.includes(category)) return buckets.filter(b => b.category === "spice" && b.status === "active");
    if (packCats.includes(category)) return buckets.filter(b => b.category === "packaging" && b.status === "active");
    return buckets.filter(b => b.status === "active");
  };

  const statusColor = (status) => {
    if (status === "ordered") return "bg-blue-50 border-blue-200";
    if (status === "partial_received") return "bg-amber-50 border-amber-200";
    return "bg-muted/30 border-border";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving"
        subtitle="Select a purchase order to receive raw materials"
      />

      {/* PO Cards */}
      {pendingPOs.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No pending purchase orders. Create one first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingPOs.map(po => {
            const isSelected = currentPO?.id === po.id;
            const receivedItems = (po.line_items || []).filter(li => (li.received_qty_lbs || 0) >= li.quantity_lbs).length;
            const totalItems = (po.line_items || []).length;
            return (
              <button
                key={po.id}
                onClick={() => setSelectedPOId(isSelected ? null : po.id)}
                className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md focus:outline-none ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : `${statusColor(po.status)} hover:border-primary/40`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className={`w-5 h-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-bold text-base truncate">{po.po_number}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${isSelected ? "rotate-90 text-primary" : "text-muted-foreground"}`} />
                </div>
                <p className="text-sm text-muted-foreground mt-1 ml-7">{po.supplier}</p>
                <div className="flex items-center justify-between mt-3 ml-7">
                  <StatusBadge status={po.status} />
                  <span className="text-xs text-muted-foreground">{receivedItems}/{totalItems} items</span>
                </div>
                {po.expected_delivery_date && (
                  <p className="text-xs text-muted-foreground mt-1 ml-7">
                    Expected: {format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Receiving Form for selected PO */}
      {currentPO && (
        <>
          {/* PO Summary */}
          <Card>
            <CardHeader><CardTitle className="text-base">PO Details — {currentPO.po_number}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Supplier</Label>
                  <p className="font-semibold">{currentPO.supplier}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-0.5"><StatusBadge status={currentPO.status} /></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total</Label>
                  <p className="font-semibold">${currentPO.total_amount?.toFixed(2) || '0.00'}</p>
                </div>
                <div>
                   <Label className="text-xs text-muted-foreground">Expected Delivery</Label>
                   <p className="font-semibold">
                     {currentPO.expected_delivery_date ? format(new Date(currentPO.expected_delivery_date + 'T00:00:00'), 'MMM dd, yyyy') : '—'}
                   </p>
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader><CardTitle className="text-base">Line Items — Receive & Assign to Buckets</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-5">
                {currentPO.line_items?.map((item, idx) => {
                  const key = `item_${idx}`;
                  const state = receivingState[key] || {};
                  const isReceived = (item.received_qty_lbs || 0) >= item.quantity_lbs || state._done;
                  const suggestedBuckets = getBucketsForCategory(item.category);

                  return (
                    <div key={idx} className={`border rounded-xl p-4 ${isReceived ? "bg-chart-2/5 border-chart-2/30" : "bg-muted/20"}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-base">{item.material_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">{item.category}</Badge>
                            <span className="text-xs text-muted-foreground">Ordered: <strong>{item.quantity_lbs} lbs</strong></span>
                            {(item.received_qty_lbs || 0) > 0 && (
                              <span className="text-xs text-muted-foreground">Received: <strong>{item.received_qty_lbs} lbs</strong></span>
                            )}
                          </div>
                        </div>
                        {isReceived ? (
                          <div className="flex items-center gap-1 text-chart-2 text-sm font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Received
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }))}
                          >
                            {expandedItems[key] ? "Collapse" : "Receive"}
                          </Button>
                        )}
                      </div>

                      {!isReceived && expandedItems[key] && (
                        <div className="border rounded-lg p-4 bg-card space-y-4">
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                            <Label className="text-sm font-semibold mb-2 block">Assign to Inventory Bucket *</Label>
                            <Select
                              value={state.bucket_id || ""}
                              onValueChange={v => setReceivingState(prev => ({ ...prev, [key]: { ...state, bucket_id: v } }))}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select bucket..." />
                              </SelectTrigger>
                              <SelectContent>
                                {suggestedBuckets.length > 0 && (
                                  <>
                                    <div className="px-2 py-1 text-xs text-muted-foreground font-semibold uppercase tracking-wide">Suggested</div>
                                    {suggestedBuckets.map(b => (
                                      <SelectItem key={b.id} value={b.id}>{b.code ? `[${b.code}] ` : ""}{b.name}</SelectItem>
                                    ))}
                                  </>
                                )}
                                {buckets.filter(b => b.status === "active" && !suggestedBuckets.find(s => s.id === b.id)).length > 0 && (
                                  <>
                                    <div className="px-2 py-1 text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-1">All Buckets</div>
                                    {buckets.filter(b => b.status === "active" && !suggestedBuckets.find(s => s.id === b.id)).map(b => (
                                      <SelectItem key={b.id} value={b.id}>{b.code ? `[${b.code}] ` : ""}{b.name} ({b.category})</SelectItem>
                                    ))}
                                  </>
                                )}
                                {buckets.filter(b => b.status === "active").length === 0 && (
                                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">No buckets configured yet.</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             <div>
                                <Label className="text-xs">Lot Number *</Label>
                                <div className="flex gap-2">
                                  <Input
                                    value={state.lotNumber || ''}
                                    onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, lotNumber: e.target.value } }))}
                                    placeholder="e.g. LOT-2024-001"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReceivingState(prev => ({ ...prev, [key]: { ...state, lotNumber: format(new Date(), 'yyyy-MM-dd') } }))}
                                    className="shrink-0 text-xs"
                                  >
                                    Use Today
                                  </Button>
                                </div>
                              </div>
                             <div>
                               <Label className="text-xs">Ordered Qty</Label>
                               <div className="px-3 py-2 bg-muted/50 rounded border text-sm font-semibold">{item.quantity_lbs} lbs</div>
                             </div>
                             <div>
                               <Label className="text-xs">Actual Received (lbs) *</Label>
                               <Input
                                 type="number"
                                 value={state.receivedQty || ''}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, receivedQty: e.target.value } }))}
                                 placeholder={item.quantity_lbs}
                               />
                             </div>
                             <div>
                               <Label className="text-xs">Pallet Count</Label>
                               <Input
                                 type="number"
                                 min="0"
                                 value={state.palletCount || ''}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, palletCount: e.target.value } }))}
                                 placeholder="0"
                               />
                             </div>
                             <div>
                               <Label className="text-xs">Case/Gaylord Count</Label>
                               <Input
                                 type="number"
                                 min="0"
                                 value={state.caseCount || ''}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, caseCount: e.target.value } }))}
                                 placeholder="0"
                               />
                             </div>
                             <div>
                               <Label className="text-xs">Expiry Date *</Label>
                               <Input
                                 type="date"
                                 value={state.expiryDate || ''}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, expiryDate: e.target.value } }))}
                               />
                             </div>
                             <div>
                               <Label className="text-xs">Receiver Initials *</Label>
                               <Input
                                 maxLength="3"
                                 value={state.initials || ''}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, initials: e.target.value } }))}
                                 placeholder="e.g. JMD"
                                 className="uppercase"
                               />
                             </div>
                             <div>
                               <Label className="text-xs">Company/Supplier</Label>
                               <Input
                                 value={state.company || currentPO.supplier}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, company: e.target.value } }))}
                                 placeholder={currentPO.supplier}
                               />
                             </div>
                             <div>
                               <Label className="text-xs">Temp on Arrival (°C)</Label>
                               <Input
                                 type="number"
                                 step="0.1"
                                 value={state.tempOnArrival || ''}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, tempOnArrival: e.target.value } }))}
                               />
                             </div>
                             <div className="md:col-span-2">
                               <Label className="text-xs">Inspection Notes</Label>
                               <Textarea
                                 value={state.notes || ''}
                                 onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, notes: e.target.value } }))}
                                 placeholder="Any observations during receiving..."
                                 className="h-14"
                               />
                             </div>
                           </div>

                          <Button onClick={() => handleReceiveItem(idx)} className="w-full" size="lg" disabled={!state.lotNumber || !state.initials || !state.expiryDate || !state.bucket_id || !state.receivedQty}>
                             Confirm Receipt <ArrowRight className="w-4 h-4 ml-2" />
                           </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}