import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Plus, Trash2, AlertCircle } from "lucide-react";

function autoPickFIFO(inventory, neededLbs) {
  // Sort by production_date asc (oldest first = FIFO)
  const sorted = [...inventory]
    .filter(i => i.status === "available" && (i.quantity_lbs || 0) > 0)
    .sort((a, b) => new Date(a.production_date || a.created_date) - new Date(b.production_date || b.created_date));

  const picks = [];
  let remaining = neededLbs;
  for (const item of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(item.quantity_lbs, remaining);
    picks.push({ inventory_item_id: item.id, lot_number: item.lot_number, batch_number: item.batch_number, qty_lbs_taken: take, _available: item.quantity_lbs });
    remaining -= take;
  }
  return picks;
}

export default function FulfillmentDialog({ open, order, onClose, onFulfilled }) {
  const queryClient = useQueryClient();
  const [lineAllocations, setLineAllocations] = useState([]);
  const [ready, setReady] = useState(false);

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventoryItems-available"],
    queryFn: () => base44.entities.InventoryItem.filter({ status: "available" }),
  });

  const { data: fgBuckets = [] } = useQuery({
    queryKey: ["fgBuckets-all"],
    queryFn: () => base44.entities.FinishedGoodsBucket.list(),
  });

  // Auto-pick FIFO on load
  useEffect(() => {
    if (!open || !inventory.length) return;
    const allocations = (order.line_items || []).map(item => {
      const productInv = inventory.filter(i => i.product_id === item.product_id);
      const picks = autoPickFIFO(productInv, item.total_lbs || 0);
      return { ...item, picks };
    });
    setLineAllocations(allocations);
    setReady(true);
  }, [open, inventory]);

  const addManualLot = (lineIdx) => {
    setLineAllocations(prev => prev.map((line, i) => {
      if (i !== lineIdx) return line;
      return { ...line, picks: [...line.picks, { inventory_item_id: "", lot_number: "", batch_number: "", qty_lbs_taken: 0, _manual: true }] };
    }));
  };

  const removePick = (lineIdx, pickIdx) => {
    setLineAllocations(prev => prev.map((line, i) => {
      if (i !== lineIdx) return line;
      return { ...line, picks: line.picks.filter((_, pi) => pi !== pickIdx) };
    }));
  };

  const updatePick = (lineIdx, pickIdx, updates) => {
    setLineAllocations(prev => prev.map((line, i) => {
      if (i !== lineIdx) return line;
      const picks = line.picks.map((p, pi) => pi === pickIdx ? { ...p, ...updates } : p);
      return { ...line, picks };
    }));
  };

  const handleLotSelect = (lineIdx, pickIdx, inventoryId) => {
    const invItem = inventory.find(i => i.id === inventoryId);
    if (!invItem) return;
    updatePick(lineIdx, pickIdx, {
      inventory_item_id: inventoryId,
      lot_number: invItem.lot_number || "",
      batch_number: invItem.batch_number || "",
      _available: invItem.quantity_lbs,
    });
  };

  const fulfillMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      // Build updated line items with fulfilled_lots
      const updatedLineItems = (order.line_items || []).map((item, i) => {
        const alloc = lineAllocations[i];
        return { ...item, fulfilled_lots: alloc?.picks || [] };
      });

      // Deduct from InventoryItem (lot-level) + FinishedGoodsBucket (cases/lbs on hand)
      for (const alloc of lineAllocations) {
        for (const pick of alloc.picks) {
          if (!pick.inventory_item_id || !pick.qty_lbs_taken) continue;
          const invItem = inventory.find(i => i.id === pick.inventory_item_id);
          if (!invItem) continue;

          // 1. Deduct InventoryItem
          const newQty = (invItem.quantity_lbs || 0) - pick.qty_lbs_taken;
          const newStatus = newQty <= 0 ? "shipped" : "available";
          await base44.entities.InventoryItem.update(pick.inventory_item_id, {
            quantity_lbs: Math.max(0, newQty),
            status: newStatus,
          });

          // 2. Deduct matching lot in FinishedGoodsBucket (FIFO — find bucket by product_id)
          const bucket = fgBuckets.find(b => b.product_id === invItem.product_id);
          if (bucket) {
            const lbsToDeduct = pick.qty_lbs_taken;
            const caseWeight = bucket.case_weight_lbs || 0;
            const casesToDeduct = caseWeight > 0 ? Math.round(lbsToDeduct / caseWeight) : 0;
            const updatedLots = (bucket.lots || []).map(lot => {
              if (lot.lot_number === invItem.lot_number && lot.status === "available") {
                const newLotQty = Math.max(0, (lot.quantity_lbs || 0) - lbsToDeduct);
                const newLotCases = Math.max(0, (lot.cases || 0) - casesToDeduct);
                return {
                  ...lot,
                  quantity_lbs: parseFloat(newLotQty.toFixed(2)),
                  cases: newLotCases,
                  status: newLotQty <= 0 ? "shipped" : "available",
                };
              }
              return lot;
            });
            await base44.entities.FinishedGoodsBucket.update(bucket.id, {
              quantity_lbs: parseFloat(Math.max(0, (bucket.quantity_lbs || 0) - lbsToDeduct).toFixed(2)),
              cases_on_hand: Math.max(0, (bucket.cases_on_hand || 0) - casesToDeduct),
              lots: updatedLots,
            });
          }
        }
      }

      // Update sales order
      await base44.entities.SalesOrder.update(order.id, {
        status: "fulfilled",
        line_items: updatedLineItems,
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: user?.email || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventoryItems-available"] });
      queryClient.invalidateQueries({ queryKey: ["fgBuckets-all"] });
      queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
      onFulfilled();
    },
  });

  const getLineTotal = (line) => line.picks.reduce((s, p) => s + (parseFloat(p.qty_lbs_taken) || 0), 0);
  const getLineSuficiency = (line) => {
    const total = getLineTotal(line);
    const needed = line.total_lbs || 0;
    if (total >= needed) return "ok";
    if (total > 0) return "partial";
    return "none";
  };

  const allOk = lineAllocations.every(l => getLineSuficiency(l) === "ok");

  // Filter inventory by product for a line
  const getProductInventory = (productId) => inventory.filter(i => i.product_id === productId && (i.quantity_lbs || 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fulfill Order — {order.order_number}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          FIFO lots have been auto-selected. Review, adjust, or add manual lots as needed.
        </p>

        {!ready ? (
          <div className="py-8 text-center text-muted-foreground">Loading inventory...</div>
        ) : (
          <div className="space-y-5">
            {lineAllocations.map((line, li) => {
              const suf = getLineSuficiency(line);
              const totalPicked = getLineTotal(line);
              return (
                <div key={li} className="border rounded-lg overflow-hidden">
                  <div className={`px-4 py-2 flex items-center justify-between text-sm font-medium
                    ${suf === "ok" ? "bg-green-50 border-b border-green-200" : suf === "partial" ? "bg-yellow-50 border-b border-yellow-200" : "bg-red-50 border-b border-red-200"}`}>
                    <span>{line.product_name}</span>
                    <span className={`text-xs flex items-center gap-1 ${suf === "ok" ? "text-green-700" : "text-yellow-700"}`}>
                      {suf !== "ok" && <AlertCircle className="w-3 h-3" />}
                      {totalPicked.toFixed(1)} / {(line.total_lbs || 0).toFixed(1)} lbs picked
                      ({line.cases_qty} cases)
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                    {line.picks.map((pick, pi) => {
                      const productInv = getProductInventory(line.product_id);
                      return (
                        <div key={pi} className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1.5">
                          {pick._manual ? (
                            <Select value={pick.inventory_item_id} onValueChange={v => handleLotSelect(li, pi, v)}>
                              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select lot..." /></SelectTrigger>
                              <SelectContent>
                                {productInv.map(inv => (
                                  <SelectItem key={inv.id} value={inv.id}>
                                    {inv.lot_number || inv.batch_number} — {inv.quantity_lbs?.toFixed(1)} lbs avail
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs flex-1 font-mono">
                              Lot: {pick.lot_number || pick.batch_number || "—"}
                              <span className="text-muted-foreground ml-2">({pick._available?.toFixed(1)} avail)</span>
                            </span>
                          )}
                          <Input
                            type="number" step="0.1" min="0"
                            className="h-7 w-24 text-xs"
                            value={pick.qty_lbs_taken}
                            onChange={e => updatePick(li, pi, { qty_lbs_taken: parseFloat(e.target.value) || 0 })}
                          />
                          <span className="text-xs text-muted-foreground">lbs</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removePick(li, pi)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => addManualLot(li)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Manual Lot
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => fulfillMutation.mutate()}
            disabled={!allOk || fulfillMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {fulfillMutation.isPending ? "Fulfilling..." : "Confirm & Fulfill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}