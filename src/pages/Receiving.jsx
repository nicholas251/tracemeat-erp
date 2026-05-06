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
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function Receiving() {
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get("po_id");

  const queryClient = useQueryClient();
  const [receivingState, setReceivingState] = useState({});
  const [selectedPOId, setSelectedPOId] = useState(poId || null);

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
    return pendingPOs[0] || null;
  }, [pos, selectedPOId, pendingPOs]);

  const createMaterialMutation = useMutation({
    mutationFn: (data) => base44.entities.RawMaterial.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });

  const createRawInventoryMutation = useMutation({
    mutationFn: (data) => base44.entities.RawInventory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_inventory"] });
    },
  });

  const updatePOMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
    },
  });

  const handleReceiveItem = async (lineItemIndex) => {
    if (!currentPO) return;

    const item = currentPO.line_items[lineItemIndex];
    const key = `item_${lineItemIndex}`;
    const state = receivingState[key] || {};

    if (!state.expiryDate) { alert("Please set expiry date"); return; }
    if (!state.bucket_id) { alert("Please assign a bucket"); return; }

    const lotNumber = state.lotNumber || `LOT-${Date.now()}`;
    const receivedQty = parseFloat(state.receivedQty) || item.quantity_kg;
    const selectedBucket = buckets.find(b => b.id === state.bucket_id);

    // Create raw material lot record
    const newMaterial = await createMaterialMutation.mutateAsync({
      po_id: currentPO.id,
      po_number: currentPO.po_number,
      lot_number: lotNumber,
      name: item.material_name,
      category: item.category,
      supplier: currentPO.supplier,
      received_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: state.expiryDate,
      quantity_kg: receivedQty,
      available_qty_kg: receivedQty,
      temp_on_arrival_c: parseFloat(state.tempOnArrival) || null,
      status: "received",
      inspection_notes: state.notes || "",
    });

    // Create raw inventory entry in bucket
    await createRawInventoryMutation.mutateAsync({
      bucket_id: state.bucket_id,
      bucket_name: selectedBucket?.name || "",
      bucket_category: selectedBucket?.category || "",
      lot_number: lotNumber,
      raw_material_id: newMaterial.id,
      supplier: currentPO.supplier,
      description: item.material_name,
      po_number: currentPO.po_number,
      quantity: receivedQty,
      available_qty: receivedQty,
      unit: selectedBucket?.unit || "lbs",
      received_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: state.expiryDate,
      status: "available",
      notes: state.notes || "",
    });

    // Update PO line item
    const updatedLineItems = [...currentPO.line_items];
    updatedLineItems[lineItemIndex] = { ...updatedLineItems[lineItemIndex], received_qty_kg: receivedQty };
    const allReceived = updatedLineItems.every(li => (li.received_qty_kg || 0) >= li.quantity_kg);

    await updatePOMutation.mutateAsync({
      id: currentPO.id,
      data: {
        line_items: updatedLineItems,
        status: allReceived ? "received" : "partial_received",
      },
    });

    setReceivingState(prev => ({ ...prev, [key]: { _done: true } }));
  };

  const proteinBuckets = buckets.filter(b => b.category === "protein" && b.status === "active");
  const spiceBuckets = buckets.filter(b => b.category === "spice" && b.status === "active");
  const packagingBuckets = buckets.filter(b => b.category === "packaging" && b.status === "active");

  const getBucketsForCategory = (category) => {
    if (category === "beef" || category === "pork" || category === "poultry" || category === "lamb") return proteinBuckets;
    if (category === "seasoning" || category === "additive") return spiceBuckets;
    if (category === "packaging" || category === "casing") return packagingBuckets;
    return buckets.filter(b => b.status === "active");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving"
        subtitle="Receive raw materials and assign to inventory buckets"
      />

      {/* PO Selector */}
      {pendingPOs.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Select Purchase Order</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pendingPOs.map(po => (
                <Button
                  key={po.id}
                  variant={currentPO?.id === po.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPOId(po.id)}
                >
                  {po.po_number} — {po.supplier}
                  <Badge variant="outline" className="ml-2 text-xs capitalize">{po.status?.replace(/_/g, " ")}</Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!currentPO ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No pending purchase orders. Create one first.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">PO Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">PO Number</Label>
                  <p className="font-semibold">{currentPO.po_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Supplier</Label>
                  <p className="font-semibold">{currentPO.supplier}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <StatusBadge status={currentPO.status} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total</Label>
                  <p className="font-semibold">${currentPO.total_amount?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Line Items — Receive & Assign to Buckets</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-5">
                {currentPO.line_items?.map((item, idx) => {
                  const key = `item_${idx}`;
                  const state = receivingState[key] || {};
                  const isReceived = (item.received_qty_kg || 0) >= item.quantity_kg || state._done;
                  const suggestedBuckets = getBucketsForCategory(item.category);

                  return (
                    <div key={idx} className={`border rounded-xl p-4 ${isReceived ? "bg-chart-2/5 border-chart-2/30" : "bg-muted/20"}`}>
                      {/* Item header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-base">{item.material_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">{item.category}</Badge>
                            <span className="text-xs text-muted-foreground">Ordered: <strong>{item.quantity_kg} kg</strong></span>
                            {(item.received_qty_kg || 0) > 0 && (
                              <span className="text-xs text-muted-foreground">Received: <strong>{item.received_qty_kg} kg</strong></span>
                            )}
                          </div>
                        </div>
                        {isReceived && (
                          <div className="flex items-center gap-1 text-chart-2 text-sm font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Received
                          </div>
                        )}
                      </div>

                      {!isReceived && (
                        <div className="border rounded-lg p-4 bg-card space-y-4">
                          {/* Bucket assignment — prominent */}
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                            <Label className="text-sm font-semibold mb-2 block">
                              Assign to Inventory Bucket *
                            </Label>
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
                                      <SelectItem key={b.id} value={b.id}>
                                        {b.code ? `[${b.code}] ` : ""}{b.name}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                {buckets.filter(b => b.status === "active" && !suggestedBuckets.find(s => s.id === b.id)).length > 0 && (
                                  <>
                                    <div className="px-2 py-1 text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-1">All Buckets</div>
                                    {buckets.filter(b => b.status === "active" && !suggestedBuckets.find(s => s.id === b.id)).map(b => (
                                      <SelectItem key={b.id} value={b.id}>
                                        {b.code ? `[${b.code}] ` : ""}{b.name} ({b.category})
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                                {buckets.filter(b => b.status === "active").length === 0 && (
                                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">No buckets configured yet. Set up buckets in Raw Material Inventory.</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Lot Number</Label>
                              <Input
                                value={state.lotNumber || ''}
                                onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, lotNumber: e.target.value } }))}
                                placeholder="Auto-generated if empty"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Received Qty (kg)</Label>
                              <Input
                                type="number"
                                value={state.receivedQty ?? item.quantity_kg}
                                onChange={e => setReceivingState(prev => ({ ...prev, [key]: { ...state, receivedQty: e.target.value } }))}
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
                                placeholder="Any observations..."
                                className="h-16"
                              />
                            </div>
                          </div>

                          <Button onClick={() => handleReceiveItem(idx)} className="w-full" size="lg">
                            Receive into Bucket <ArrowRight className="w-4 h-4 ml-2" />
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