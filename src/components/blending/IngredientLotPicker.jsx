import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Plus, Trash2, Package } from "lucide-react";

/**
 * Builds FIFO lot allocations for a given bucket and required_lbs.
 * Returns an array of { lot_number, available_qty, raw_inventory_id, actual_lbs }
 */
function buildFifoAllocations(inventoryRows, requiredLbs) {
  // Sort FIFO by received_date ascending, then created_date
  const sorted = [...inventoryRows]
    .filter(r => (r.available_qty || 0) > 0)
    .sort((a, b) => {
      const da = a.received_date || a.created_date || "";
      const db = b.received_date || b.created_date || "";
      return da < db ? -1 : da > db ? 1 : 0;
    });

  const allocations = [];
  let remaining = requiredLbs;

  for (const row of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(row.available_qty, remaining);
    allocations.push({
      lot_number: row.lot_number || "",
      available_qty: row.available_qty,
      raw_inventory_id: row.id,
      actual_lbs: parseFloat(take.toFixed(2)),
    });
    remaining -= take;
  }

  // If inventory is exhausted and we still need more, add an empty row for manual entry
  if (remaining > 0.001) {
    allocations.push({
      lot_number: "",
      available_qty: 0,
      raw_inventory_id: null,
      actual_lbs: parseFloat(remaining.toFixed(2)),
      insufficient: true,
    });
  }

  // If no inventory at all, show one empty row
  if (allocations.length === 0) {
    allocations.push({
      lot_number: "",
      available_qty: 0,
      raw_inventory_id: null,
      actual_lbs: requiredLbs,
      insufficient: true,
    });
  }

  return allocations;
}

/**
 * IngredientLotPicker
 *
 * Props:
 *   ing         – ingredient object { bucket_id, bucket_name, required_lbs, lot_allocations, confirmed, notes }
 *   disabled    – boolean (when confirmed)
 *   onChange    – (field, value) => void
 *   onConfirm   – () => void
 */
export default function IngredientLotPicker({ ing, disabled, onChange, onConfirm }) {
  const { data: inventoryRows = [], isLoading } = useQuery({
    queryKey: ["rawInventory", ing.bucket_id],
    queryFn: () => base44.entities.RawInventory.filter({ bucket_id: ing.bucket_id }),
    enabled: !!ing.bucket_id,
    staleTime: 0,
    gcTime: 0,
  });

  // Initialize allocations from FIFO once inventory loads, if not already set
  const allocations = useMemo(() => {
    if (ing.lot_allocations && ing.lot_allocations.length > 0) return ing.lot_allocations;
    if (inventoryRows.length > 0) return buildFifoAllocations(inventoryRows, ing.required_lbs);
    return [{ lot_number: "", available_qty: 0, raw_inventory_id: null, actual_lbs: ing.required_lbs }];
  }, [inventoryRows, ing.lot_allocations, ing.required_lbs]);

  // Sync back to parent when inventory first loads
  useEffect(() => {
    console.log(`[IngredientLotPicker] bucket_id=${ing.bucket_id}, inventoryRows=${inventoryRows.length}, isLoading=${isLoading}`);
    if (inventoryRows.length > 0 && !ing.lot_allocations) {
      onChange("lot_allocations", buildFifoAllocations(inventoryRows, ing.required_lbs));
    }
  }, [inventoryRows, isLoading]);

  const totalActual = allocations.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0);
  const isOver = totalActual > ing.required_lbs;
  const isShort = totalActual < ing.required_lbs - 0.001;
  const hasInsufficientInventory = allocations.some(a => a.insufficient);

  const updateAllocation = (idx, field, value) => {
    let val = value;
    if (field === "actual_lbs") {
      const numVal = Number(value);
      const avail = allocations[idx]?.available_qty;
      if (avail > 0) val = Math.min(numVal, avail);
      const otherTotal = allocations.reduce((s, a, i) => i === idx ? s : s + (Number(a.actual_lbs) || 0), 0);
      val = Math.min(val, Math.max(0, ing.required_lbs - otherTotal));
      val = parseFloat(val.toFixed(2));
    }
    if (field === "lot_number") {
      // When a lot is selected from the dropdown, also sync available_qty and raw_inventory_id
      const row = inventoryRows.find(r => r.lot_number === value);
      const updated = allocations.map((a, i) => i === idx ? {
        ...a,
        lot_number: value,
        available_qty: row?.available_qty || 0,
        raw_inventory_id: row?.id || null,
      } : a);
      onChange("lot_allocations", updated);
      return;
    }
    const updated = allocations.map((a, i) => i === idx ? { ...a, [field]: val } : a);
    onChange("lot_allocations", updated);
  };

  const addRow = () => {
    onChange("lot_allocations", [...allocations, {
      lot_number: "",
      available_qty: 0,
      raw_inventory_id: null,
      actual_lbs: parseFloat(Math.max(0, ing.required_lbs - totalActual).toFixed(2)),
    }]);
  };

  const removeRow = (idx) => {
    if (allocations.length === 1) return;
    onChange("lot_allocations", allocations.filter((_, i) => i !== idx));
  };

  const canConfirm =
    !isOver &&
    allocations.every(a => a.lot_number?.trim()) &&
    (!isShort || ing.notes?.trim());

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-sm">{ing.bucket_name}</span>
          <span className="text-xs text-muted-foreground ml-2">Required: <span className="font-semibold text-foreground">{ing.required_lbs} lbs</span></span>
        </div>
        {disabled
          ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
          : <Badge variant="outline" className="text-xs">Pending</Badge>
        }
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Package className="w-3 h-3 animate-pulse" /> Loading inventory lots…
        </p>
      )}

      {hasInsufficientInventory && !disabled && (
        <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Inventory may be insufficient. Enter lot numbers manually or add more inventory.
        </div>
      )}

      {/* Lot allocation rows */}
      <div className="space-y-2">
        {allocations.map((alloc, idx) => (
          <div key={idx} className={`rounded border p-2 space-y-1.5 ${alloc.insufficient ? "border-amber-300 bg-amber-50/50" : "border-border bg-muted/30"}`}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-medium text-muted-foreground">Lot {idx + 1}</span>
              {alloc.available_qty > 0 && (
                <span className="text-xs text-muted-foreground">· {alloc.available_qty} lbs available</span>
              )}
              {allocations.length > 1 && !disabled && (
                <button onClick={() => removeRow(idx)} className="ml-auto text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Lot Number</Label>
                {disabled ? (
                   <div className="h-10 flex items-center px-3 rounded border border-border bg-muted/30 text-sm font-mono">
                     {alloc.lot_number || "—"}
                   </div>
                 ) : (
                   <Select
                     value={alloc.lot_number || ""}
                     onValueChange={v => updateAllocation(idx, "lot_number", v)}
                   >
                     <SelectTrigger className="h-10 text-sm">
                       <SelectValue placeholder={inventoryRows.length === 0 ? "No inventory available" : "Select lot..."} />
                     </SelectTrigger>
                     <SelectContent>
                       {inventoryRows.length === 0 ? (
                         <div className="px-3 py-2 text-xs text-muted-foreground">No inventory available</div>
                       ) : (
                         inventoryRows
                           .filter(r => (r.available_qty || 0) > 0)
                           .sort((a, b) => (a.received_date || "") < (b.received_date || "") ? -1 : 1)
                           .map(r => (
                             <SelectItem key={r.id} value={r.lot_number}>
                               {r.lot_number} <span className="text-muted-foreground text-xs ml-1">({r.available_qty} lbs avail)</span>
                             </SelectItem>
                           ))
                       )}
                     </SelectContent>
                   </Select>
                 )}
                {!alloc.lot_number && !disabled && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Required
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Qty (lbs)
                  {alloc.available_qty > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">max {alloc.available_qty}</span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={alloc.actual_lbs}
                  disabled={disabled}
                  onChange={e => updateAllocation(idx, "actual_lbs", Number(e.target.value))}
                  className={`h-10 text-sm ${alloc.available_qty > 0 && alloc.actual_lbs > alloc.available_qty ? "border-destructive text-destructive" : ""}`}
                />
                {alloc.available_qty > 0 && alloc.actual_lbs > alloc.available_qty && !disabled && (
                  <p className="text-xs text-destructive">Exceeds available {alloc.available_qty} lbs</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total vs required */}
      {!disabled && (
        <div className={`flex items-center justify-between text-xs px-1 ${isOver ? "text-destructive" : isShort ? "text-amber-600" : "text-chart-2"}`}>
          <span>Total: <span className="font-semibold">{parseFloat(totalActual.toFixed(2))} lbs</span> of {ing.required_lbs} lbs</span>
          {isOver && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Over limit</span>}
          {!isOver && isShort && <span>Short by {parseFloat((ing.required_lbs - totalActual).toFixed(2))} lbs</span>}
          {!isOver && !isShort && <span>✓ Exact</span>}
        </div>
      )}

      {/* Add another lot row */}
      {!disabled && (
        <Button size="sm" variant="ghost" className="w-full text-xs gap-1 h-7 border border-dashed" onClick={addRow}>
          <Plus className="w-3 h-3" /> Add lot from next FIFO lot
        </Button>
      )}

      {/* Short quantity notes */}
      {isShort && !isOver && !disabled && (
        <div className="space-y-1">
          <Label className="text-xs text-amber-600">Reason for short quantity <span className="text-destructive">*</span></Label>
          <Textarea
            value={ing.notes || ""}
            onChange={e => onChange("notes", e.target.value)}
            placeholder="e.g. scale variance, partial lot used..."
            className="h-16 text-xs"
          />
        </div>
      )}

      {/* Confirm button */}
      {!disabled && (
        <Button
          variant="outline"
          className="w-full gap-2 h-10 font-semibold mt-1"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          <CheckCircle2 className="w-4 h-4" /> Confirm {ing.bucket_name}
        </Button>
      )}

      {/* Confirmed summary */}
      {disabled && (
        <div className="rounded bg-chart-2/5 border border-chart-2/30 divide-y text-xs">
          {allocations.map((a, i) => (
            <div key={i} className="flex justify-between px-2 py-1">
              <span className="font-mono text-muted-foreground">{a.lot_number}</span>
              <span className="font-semibold">{a.actual_lbs} lbs</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}