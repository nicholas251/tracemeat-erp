import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";

export default function Receiving() {
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get("po_id");

  const queryClient = useQueryClient();
  const [receivingState, setReceivingState] = useState({});

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const currentPO = useMemo(() => {
    if (poId) return pos.find(p => p.id === poId);
    return pos.find(p => p.data.status !== "received");
  }, [pos, poId]);

  const { data: existingMaterials = [] } = useQuery({
    queryKey: ["raw_materials"],
    queryFn: () => base44.entities.RawMaterial.list(),
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data) => base44.entities.RawMaterial.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
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

    const item = currentPO.data.line_items[lineItemIndex];
    const key = `item_${lineItemIndex}`;
    const state = receivingState[key] || {};

    const lotNumber = state.lotNumber || `LOT-${Date.now()}`;
    const receivedQty = parseFloat(state.receivedQty) || item.quantity_kg;
    const expiryDate = state.expiryDate;

    if (!expiryDate) {
      alert("Please set expiry date");
      return;
    }

    // Create raw material lot
    await createMaterialMutation.mutateAsync({
      po_id: currentPO.id,
      po_number: currentPO.data.po_number,
      lot_number: lotNumber,
      name: item.material_name,
      category: item.category,
      supplier: currentPO.data.supplier,
      received_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: expiryDate,
      quantity_kg: receivedQty,
      available_qty_kg: receivedQty,
      temp_on_arrival_c: parseFloat(state.tempOnArrival) || null,
      status: "received",
      inspection_notes: state.notes || "",
    });

    // Update PO line item received quantity
    const updatedLineItems = [...currentPO.data.line_items];
    updatedLineItems[lineItemIndex].received_qty_kg = receivedQty;
    
    const allReceived = updatedLineItems.every(li => li.received_qty_kg >= li.quantity_kg);
    const newStatus = allReceived ? "received" : "partial_received";

    await updatePOMutation.mutateAsync({
      id: currentPO.id,
      data: {
        ...currentPO.data,
        line_items: updatedLineItems,
        status: newStatus,
      },
    });

    setReceivingState(prev => ({ ...prev, [key]: {} }));
  };

  if (!currentPO) {
    return (
      <div className="space-y-6">
        <PageHeader title="Receiving" subtitle="Receive and log raw materials from purchase orders" />
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No pending purchase orders. Create one first.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Receiving" 
        subtitle={`Processing PO #${currentPO.data.po_number} from ${currentPO.data.supplier}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>PO Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">PO Number</Label>
              <p className="font-semibold">{currentPO.data.po_number}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Supplier</Label>
              <p className="font-semibold">{currentPO.data.supplier}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <StatusBadge status={currentPO.data.status} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Total</Label>
              <p className="font-semibold">${currentPO.data.total_amount?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items - Receive Goods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {currentPO.data.line_items?.map((item, idx) => {
              const key = `item_${idx}`;
              const state = receivingState[key] || {};
              const isReceived = item.received_qty_kg >= item.quantity_kg;

              return (
                <div key={idx} className="border rounded-lg p-4 bg-muted/30">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Material</Label>
                      <p className="font-semibold">{item.material_name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <p className="font-semibold capitalize">{item.category}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ordered (kg)</Label>
                      <p className="font-semibold">{item.quantity_kg}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Received (kg)</Label>
                      <p className="font-semibold">{item.received_qty_kg || 0}</p>
                    </div>
                  </div>

                  {!isReceived && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white rounded border">
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
                          value={state.receivedQty || item.quantity_kg}
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
                          className="h-20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          onClick={() => handleReceiveItem(idx)}
                          className="w-full"
                        >
                          Complete Receipt
                        </Button>
                      </div>
                    </div>
                  )}

                  {isReceived && (
                    <div className="text-sm text-chart-2 font-semibold">✓ Received</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}