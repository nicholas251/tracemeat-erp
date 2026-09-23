import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, FlaskConical, PlusCircle, Trash2 } from "lucide-react";

/**
 * SpiceMixLotPicker
 *
 * Supports multi-lot allocation. If the selected lot doesn't have enough qty,
 * the user is prompted to add another lot to cover the remainder.
 *
 * Props:
 *   label        – field label string
 *   requiredLbs  – how many lbs are needed (from product config)
 *   value        – { lots: [{ spice_mix_id, spice_mix_name, spice_mix_lot_number, spice_mix_qty_lbs }] }
 *                  (backwards-compatible: also accepts flat single-lot shape)
 *   onChange     – (updatedValue) => void  — always emits the multi-lot shape
 *   disabled     – boolean
 */
export default function SpiceMixLotPicker({ label, requiredLbs, value = {}, onChange, disabled, filterSpiceMixId, shortNotes, onShortNotesChange }) {
  const { data: allSpiceMixes = [], isLoading } = useQuery({
    queryKey: ["spiceMixesActive"],
    queryFn: () => base44.entities.SpiceMix.filter({ status: "active" }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  // If a specific spice mix is assigned to the product, only show that one
  const spiceMixes = filterSpiceMixId
    ? allSpiceMixes.filter(m => m.id === filterSpiceMixId)
    : allSpiceMixes;

  const EMPTY_LOT = { spice_mix_id: "", spice_mix_name: "", spice_mix_lot_number: "", spice_mix_qty_lbs: 0 };

  // Normalise incoming value to multi-lot format. Always render at least one
  // row so the operator has a Select to interact with, without emitting on mount.
  const lots = useMemo(() => {
    if (value.lots && Array.isArray(value.lots) && value.lots.length > 0) return value.lots;
    // Backwards-compat: single-lot flat shape
    if (value.spice_mix_id) {
      return [{
        spice_mix_id: value.spice_mix_id,
        spice_mix_name: value.spice_mix_name || "",
        spice_mix_lot_number: value.spice_mix_lot_number || "",
        spice_mix_qty_lbs: value.spice_mix_qty_lbs || 0,
      }];
    }
    return [EMPTY_LOT];
  }, [value]);

  const totalAllocated = parseFloat(lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0).toFixed(2));
  const remaining = Math.max(0, parseFloat(((requiredLbs || 0) - totalAllocated).toFixed(2)));
  const isExact = requiredLbs > 0 ? Math.abs(totalAllocated - requiredLbs) < 0.001 : lots.length > 0;
  const isCovered = isExact;
  const isShort = requiredLbs > 0 && totalAllocated < requiredLbs - 0.001 && totalAllocated > 0;
  const isOver = requiredLbs > 0 && totalAllocated > requiredLbs + 0.001;

  // Detect over-draw by summing all rows that use the SAME mix and comparing
  // the combined total against that mix's live available stock.
  const computeOverDraw = (lotList) => {
    const totalsByMix = new Map();
    for (const l of lotList) {
      if (!l.spice_mix_id) continue;
      totalsByMix.set(l.spice_mix_id, (totalsByMix.get(l.spice_mix_id) || 0) + (Number(l.spice_mix_qty_lbs) || 0));
    }
    for (const [mixId, total] of totalsByMix.entries()) {
      const mix = spiceMixes.find((m) => m.id === mixId);
      const avail = mix?.available_qty_lbs ?? mix?.quantity_lbs ?? null;
      if (avail !== null && total > avail + 0.001) return true;
    }
    return false;
  };
  const hasOverDraw = computeOverDraw(lots);

  const emitChange = (newLots) => {
    // Emit multi-lot shape, plus flatten first lot fields for backwards-compat
    const first = newLots[0] || {};
    // Recompute over-draw against the new lots so the parent gets an accurate flag.
    const overDraw = computeOverDraw(newLots);
    onChange({
      lots: newLots,
      has_over_draw: overDraw,
      // flat fields mirroring first lot for backwards-compat
      spice_mix_id: first.spice_mix_id || "",
      spice_mix_name: first.spice_mix_name || "",
      spice_mix_lot_number: first.spice_mix_lot_number || "",
      spice_mix_qty_lbs: newLots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0),
    });
  };

  const makeLotRef = (mix) =>
    mix.date_created
      ? `${mix.name.replace(/\s+/g, "-").toUpperCase()}-${mix.date_created}`
      : mix.name.replace(/\s+/g, "-").toUpperCase();

  const handleSelectMix = (index, mixId) => {
    const mix = spiceMixes.find(m => m.id === mixId);
    if (!mix) return;
    const rawAvailable = mix.available_qty_lbs ?? mix.quantity_lbs ?? 0;
    // Subtract any qty already allocated to this same mix in OTHER rows so the
    // same leftover can't be suggested again and again.
    const sameMixOther = lots.reduce(
      (s, l, i) => (i !== index && l.spice_mix_id === mixId ? s + (Number(l.spice_mix_qty_lbs) || 0) : s),
      0
    );
    const available = Math.max(0, parseFloat((rawAvailable - sameMixOther).toFixed(2)));
    // Suggest the REQUIRED amount (capped at what's available), never the full available qty.
    // Falls back to available only when no required amount is configured.
    const suggestedQty = requiredLbs > 0
      ? Math.min(available, remaining > 0 ? remaining : requiredLbs)
      : available;
    const newLots = lots.map((l, i) =>
      i === index
        ? {
            spice_mix_id: mix.id,
            spice_mix_name: mix.name,
            spice_mix_lot_number: makeLotRef(mix),
            spice_mix_qty_lbs: suggestedQty,
          }
        : l
    );
    emitChange(newLots);
  };

  const handleLotField = (index, field, val) => {
    let value = field === "spice_mix_qty_lbs" ? Number(val) : val;
    if (field === "spice_mix_qty_lbs") {
      // Never allow negatives
      value = Math.max(0, value);
      if (requiredLbs > 0) {
        const mixId = lots[index]?.spice_mix_id;
        const mix = spiceMixes.find(m => m.id === mixId);
        const available = mix?.available_qty_lbs ?? mix?.quantity_lbs ?? null;
        // Cap at this lot's available stock, MINUS whatever the same mix is already
        // allocated for in other rows. This stops the same small leftover from being
        // re-added over and over across multiple rows.
        if (available !== null) {
          const sameMixOther = lots.reduce(
            (s, l, i) => (i !== index && l.spice_mix_id === mixId ? s + (Number(l.spice_mix_qty_lbs) || 0) : s),
            0
          );
          value = Math.min(value, Math.max(0, available - sameMixOther));
        }
        // Cap total across all lots at requiredLbs
        const otherTotal = lots.reduce((s, l, i) => i === index ? s : s + (Number(l.spice_mix_qty_lbs) || 0), 0);
        value = Math.min(value, Math.max(0, requiredLbs - otherTotal));
      }
      value = parseFloat(value.toFixed(2));
    }
    let newLots = lots.map((l, i) => i === index ? { ...l, [field]: value } : l);

    // When this lot's full available qty is consumed and we still haven't reached
    // the required total, auto-append the next lot row for the remainder.
    if (field === "spice_mix_qty_lbs") {
      const mix = spiceMixes.find(m => m.id === lots[index]?.spice_mix_id);
      const available = mix?.available_qty_lbs ?? mix?.quantity_lbs ?? null;
      const total = newLots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0);
      const consumedFull = available !== null && value >= available - 0.001;
      const isLast = index === newLots.length - 1;
      if (consumedFull && isLast && requiredLbs > 0 && total < requiredLbs - 0.001) {
        newLots = [...newLots, { spice_mix_id: "", spice_mix_name: "", spice_mix_lot_number: "", spice_mix_qty_lbs: 0 }];
      }
    }
    emitChange(newLots);
  };

  const addLot = () => {
    emitChange([...lots, { spice_mix_id: "", spice_mix_name: "", spice_mix_lot_number: "", spice_mix_qty_lbs: remaining }]);
  };

  const removeLot = (index) => {
    emitChange(lots.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-chart-1 shrink-0" />
        <Label className="font-semibold text-sm">{label || "Spice Mix"}</Label>
        {requiredLbs > 0 && (
          <Badge variant="outline" className="text-xs ml-auto">{requiredLbs} lbs required</Badge>
        )}
      </div>

      {lots.map((lot, index) => {
        const selectedMix = spiceMixes.find(m => m.id === lot.spice_mix_id) || null;
        const available = selectedMix?.available_qty_lbs ?? selectedMix?.quantity_lbs ?? null;
        // How much is still needed before this lot (from prior lots)
        const allocatedBefore = lots.slice(0, index).reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0);
        const remainingBeforeThis = Math.max(0, (requiredLbs || 0) - allocatedBefore);
        const isInsufficient = available !== null && lot.spice_mix_qty_lbs > 0 && available < lot.spice_mix_qty_lbs;

        return (
          <div key={index} className="border rounded-lg p-3 space-y-2 bg-background">
            {lots.length > 1 && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground">Lot #{index + 1}</span>
                {!disabled && (
                  <button onClick={() => removeLot(index)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Mix selector */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Select Spice Mix</Label>
              <Select
                value={lot.spice_mix_id || ""}
                onValueChange={(v) => handleSelectMix(index, v)}
                disabled={disabled || isLoading}
              >
                <SelectTrigger className="h-10 bg-slate-200 border-slate-400 text-slate-900">
                  <SelectValue placeholder={isLoading ? "Loading..." : "Select a spice mix..."} />
                </SelectTrigger>
                <SelectContent className="bg-slate-100 border-slate-400">
                  {spiceMixes.map(mix => {
                    const avail = mix.available_qty_lbs ?? mix.quantity_lbs ?? 0;
                    return (
                      <SelectItem key={mix.id} value={mix.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{mix.name}</span>
                          <span className={`text-xs ${avail < remainingBeforeThis ? "text-amber-600" : "text-muted-foreground"}`}>
                            {avail} lbs avail.
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                  {spiceMixes.length === 0 && !isLoading && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No active spice mixes found</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedMix && (
              <>
                {isInsufficient && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Only {available} lbs available in this lot — adjust qty or add another lot
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Lot / Batch Ref</Label>
                    <Input
                      value={lot.spice_mix_lot_number || ""}
                      onChange={e => handleLotField(index, "spice_mix_lot_number", e.target.value)}
                      placeholder="Auto-filled"
                      className="h-9 text-sm"
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Qty Used (lbs)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={lot.spice_mix_qty_lbs ?? ""}
                      onChange={e => handleLotField(index, "spice_mix_qty_lbs", e.target.value)}
                      className="h-9 text-sm"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Add lot prompt — shown when not enough covered */}
      {!disabled && !isCovered && lots.length > 0 && lots[lots.length - 1].spice_mix_id && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span><strong>{remaining.toFixed(2)} lbs</strong> still needed — add another lot to cover</span>
          </div>
          <Button size="sm" variant="outline" onClick={addLot} className="shrink-0 h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100">
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            Add Lot
          </Button>
        </div>
      )}

      {/* Exact match confirmation */}
      {!disabled && isExact && !isLoading && (
        <div className="flex items-center gap-1.5 text-xs text-chart-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-medium">
            ✓ Exact — {totalAllocated.toFixed(2)} lbs across {lots.filter(l => l.spice_mix_id).length} lot{lots.filter(l => l.spice_mix_id).length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Over-draw: trying to use more than is physically in stock */}
      {!disabled && hasOverDraw && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          A lot's quantity exceeds what's available in stock — reduce it or add another lot. Not enough on hand.
        </div>
      )}

      {/* Over allocated warning */}
      {!disabled && isOver && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Over by {(totalAllocated - requiredLbs).toFixed(2)} lbs — reduce a lot's qty to match exactly {requiredLbs} lbs
        </div>
      )}
    </div>
  );
}