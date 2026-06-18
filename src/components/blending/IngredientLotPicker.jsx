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
  // Stable FIFO: received_date, then created_date, then id — so lots received on
  // the same day always sort deterministically (no jumping between refetches).
  const sorted = [...inventoryRows]
    .filter(r => (r.available_qty || 0) > 0)
    .sort((a, b) => {
      const da = a.received_date || a.created_date || "";
      const db = b.received_date || b.created_date || "";
      if (da !== db) return da < db ? -1 : 1;
      const ca = a.created_date || "";
      const cb = b.created_date || "";
      if (ca !== cb) return ca < cb ? -1 : 1;
      return (a.id || "") < (b.id || "") ? -1 : 1;
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
export default function IngredientLotPicker({ ing, disabled, onChange, onConfirm, cacheKey, capByRequired = false, externalRows = null }) {
  // Guards against double-firing onConfirm if the operator taps "Confirm" multiple
  // times before the parent re-renders this picker as disabled. Reset whenever the
  // picker becomes editable again (e.g. "Edit lots").
  const [confirmClicked, setConfirmClicked] = React.useState(false);
  React.useEffect(() => {
    if (!disabled) setConfirmClicked(false);
  }, [disabled]);
  // When a parent owns inventory (e.g. per-batch tumbling), it passes live
  // `externalRows` so every batch reads ONE shared, always-fresh source of truth.
  // Otherwise (standalone use) fetch our own copy.
  const ownQuery = useQuery({
    queryKey: ["rawInventory", ing.bucket_id, cacheKey || "default"],
    queryFn: () => base44.entities.RawInventory.filter({ bucket_id: ing.bucket_id }),
    enabled: !!ing.bucket_id && !disabled && externalRows === null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const rawRows = externalRows !== null ? externalRows : (ownQuery.data || []);
  const isLoading = externalRows !== null ? false : ownQuery.isLoading;

  // Only ever treat a lot as live stock when it's not depleted AND still has qty.
  // (Bug fix: the query pulls every status; depleted lots with leftover qty,
  // or stale cached rows from a previously-confirmed batch, were leaking through.)
  const inventoryRows = useMemo(
    () => rawRows.filter(r => r.status !== "depleted" && (r.available_qty || 0) > 0),
    [rawRows]
  );

  // Initialize allocations from FIFO once inventory loads, if not already set.
  // When confirmed, ALWAYS use the saved lot_allocations as-is (never recompute).
  const allocations = useMemo(() => {
    if (ing.lot_allocations && ing.lot_allocations.length > 0) return ing.lot_allocations;
    if (disabled) return [];
    if (inventoryRows.length > 0) return buildFifoAllocations(inventoryRows, ing.required_lbs);
    return [{ lot_number: "", available_qty: 0, raw_inventory_id: null, actual_lbs: ing.required_lbs }];
  }, [inventoryRows, ing.lot_allocations, ing.required_lbs, disabled]);

  // Sync back to parent when inventory first loads (only while still editable)
  useEffect(() => {
    if (disabled) return;
    if (inventoryRows.length > 0 && !ing.lot_allocations) {
      onChange("lot_allocations", buildFifoAllocations(inventoryRows, ing.required_lbs));
    }
  }, [inventoryRows, isLoading, disabled]);

  // When live inventory changes (e.g. a PRIOR batch was just confirmed and deducted),
  // refresh each already-chosen allocation's available_qty from the live rows so this
  // still-editable batch shows the TRUE reduced on-hand — never a stale pre-deduction value.
  useEffect(() => {
    if (disabled) return;
    if (!ing.lot_allocations || ing.lot_allocations.length === 0) return;
    if (inventoryRows.length === 0) return;
    let changed = false;
    const refreshed = ing.lot_allocations.map(a => {
      // Match by stable raw_inventory_id first; fall back to lot_number only if no id.
      const liveRow = inventoryRows.find(r => r.id === a.raw_inventory_id)
        || inventoryRows.find(r => r.lot_number === a.lot_number);
      if (liveRow && (liveRow.available_qty !== a.available_qty || liveRow.id !== a.raw_inventory_id)) {
        changed = true;
        return { ...a, available_qty: liveRow.available_qty, raw_inventory_id: liveRow.id };
      }
      return a;
    });
    if (changed) onChange("lot_allocations", refreshed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryRows, disabled]);

  const totalActual = parseFloat(allocations.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0).toFixed(2));
  const isOver = totalActual > ing.required_lbs + 0.001;
  const isShort = totalActual < ing.required_lbs - 0.001;
  const isExact = !isOver && !isShort;
  const hasInsufficientInventory = allocations.some(a => a.insufficient);

  // Lot numbers already chosen in other rows (so we don't offer them again)
  const usedLotNumbers = (idx) => allocations.filter((_, i) => i !== idx).map(a => a.lot_number).filter(Boolean);

  // Live remaining available for a given lot number.
  // Always read from the freshly-refetched inventory rows so the number shown is the
  // TRUE on-hand quantity (already reduced by any prior CONFIRMED batches). We do NOT
  // subtract this batch's own un-confirmed entry — inventory is only deducted on confirm,
  // so showing it pre-deducted is misleading. Falls back to the saved snapshot only when
  // the live row is gone (e.g. confirmed/locked picker that no longer refetches).
  const liveRemaining = (lotNumber, baseAvailable) => {
    const liveRow = inventoryRows.find(r => r.lot_number === lotNumber);
    const onHand = liveRow ? (liveRow.available_qty || 0) : (baseAvailable || 0);
    return parseFloat(Math.max(0, onHand).toFixed(2));
  };

  // Add an empty next-lot row for the remaining amount (next FIFO lot not yet used)
  const buildNextRow = (currentAllocations) => {
    const remaining = parseFloat(Math.max(0, ing.required_lbs - currentAllocations.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0)).toFixed(2));
    if (remaining <= 0.001) return null;
    const used = currentAllocations.map(a => a.lot_number).filter(Boolean);
    const nextRow = [...inventoryRows]
      .filter(r => (r.available_qty || 0) > 0 && !used.includes(r.lot_number))
      .sort((a, b) => {
        const da = a.received_date || a.created_date || "";
        const db = b.received_date || b.created_date || "";
        if (da !== db) return da < db ? -1 : 1;
        const ca = a.created_date || "";
        const cb = b.created_date || "";
        if (ca !== cb) return ca < cb ? -1 : 1;
        return (a.id || "") < (b.id || "") ? -1 : 1;
      })[0];
    return {
      lot_number: nextRow?.lot_number || "",
      available_qty: nextRow?.available_qty || 0,
      raw_inventory_id: nextRow?.id || null,
      actual_lbs: parseFloat(Math.min(nextRow?.available_qty || remaining, remaining).toFixed(2)),
    };
  };

  const updateAllocation = (idx, field, value) => {
    let val = value;
    if (field === "actual_lbs") {
      val = parseFloat(Math.max(0, Number(value) || 0).toFixed(2));
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
    let updated = allocations.map((a, i) => i === idx ? { ...a, [field]: val } : a);

    // When this row's qty consumes the ENTIRE available lot, auto-mark it depleted
    // and append the next FIFO lot row to keep building toward the required amount.
    if (field === "actual_lbs") {
      const row = updated[idx];
      const consumedFull = row.available_qty > 0 && val >= row.available_qty - 0.001;
      updated = updated.map((a, i) => i === idx ? { ...a, depleted: consumedFull && val >= a.available_qty - 0.001 } : a);
      const totalNow = updated.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0);
      const isLast = idx === updated.length - 1;
      if (consumedFull && isLast && totalNow < ing.required_lbs - 0.001) {
        const next = buildNextRow(updated);
        if (next) updated = [...updated, next];
      }
    }
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
    allocations.every(a => a.lot_number?.trim()) &&
    isExact;

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
                <span className="text-xs text-muted-foreground">· {liveRemaining(alloc.lot_number, alloc.available_qty)} lbs remaining</span>
              )}
              {alloc.depleted && (
                <span className="text-xs font-semibold text-chart-2 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Depleted</span>
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
                       <SelectValue placeholder={inventoryRows.length === 0 ? "No inventory available" : "Select lot..."}>
                         {alloc.lot_number || (inventoryRows.length === 0 ? "No inventory available" : "Select lot...")}
                       </SelectValue>
                     </SelectTrigger>
                     <SelectContent>
                       {inventoryRows.length === 0 ? (
                         <div className="px-3 py-2 text-xs text-muted-foreground">No inventory available</div>
                       ) : (
                         inventoryRows
                           .filter(r => (r.available_qty || 0) > 0 && (r.lot_number === alloc.lot_number || !usedLotNumbers(idx).includes(r.lot_number)))
                           .sort((a, b) => (a.received_date || "") < (b.received_date || "") ? -1 : 1)
                           .map(r => (
                             <SelectItem key={r.id} value={r.lot_number}>
                               {r.lot_number}
                               <span className="text-muted-foreground text-xs ml-1">({liveRemaining(r.lot_number, r.available_qty)} lbs avail)</span>
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
                  {capByRequired ? (
                    <span className="text-muted-foreground font-normal ml-1">max {ing.required_lbs}</span>
                  ) : alloc.available_qty > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">max {alloc.available_qty}</span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={alloc.actual_lbs}
                  disabled={disabled}
                  onChange={e => updateAllocation(idx, "actual_lbs", Number(e.target.value))}
                  className="h-10 text-sm"
                />
                {alloc.available_qty > 0 && alloc.actual_lbs > alloc.available_qty && !disabled && (
                  <p className="text-xs text-amber-600">Above recorded {alloc.available_qty} lbs available</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total vs required */}
      {!disabled && (
        <div className={`flex items-center justify-between text-xs px-1 ${isExact ? "text-chart-2" : isOver ? "text-destructive" : "text-amber-600"}`}>
          <span>Total: <span className="font-semibold">{totalActual} lbs</span> of {ing.required_lbs} lbs</span>
          {isOver && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Over by {parseFloat((totalActual - ing.required_lbs).toFixed(2))} lbs</span>}
          {isShort && <span>Short by {parseFloat((ing.required_lbs - totalActual).toFixed(2))} lbs</span>}
          {isExact && <span>✓ Exact</span>}
        </div>
      )}

      {/* Add another lot row */}
      {!disabled && (
        <Button size="sm" variant="ghost" className="w-full text-xs gap-1 h-7 border border-dashed" onClick={addRow}>
          <Plus className="w-3 h-3" /> Add lot from next FIFO lot
        </Button>
      )}

      {/* Confirm button */}
      {!disabled && (
        <Button
          variant="outline"
          className="w-full gap-2 h-10 font-semibold mt-1"
          disabled={!canConfirm || confirmClicked}
          onClick={() => {
            if (confirmClicked) return;
            setConfirmClicked(true);
            onConfirm();
          }}
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