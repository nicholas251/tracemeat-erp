import React, { useMemo, useEffect } from "react";
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
  });

  // If a specific spice mix is assigned to the product, only show that one
  const spiceMixes = filterSpiceMixId
    ? allSpiceMixes.filter(m => m.id === filterSpiceMixId)
    : allSpiceMixes;

  // Normalise incoming value to multi-lot format
  const lots = useMemo(() => {
    if (value.lots && Array.isArray(value.lots)) return value.lots;
    // Backwards-compat: single-lot flat shape
    if (value.spice_mix_id) {
      return [{
        spice_mix_id: value.spice_mix_id,
        spice_mix_name: value.spice_mix_name || "",
        spice_mix_lot_number: value.spice_mix_lot_number || "",
        spice_mix_qty_lbs: value.spice_mix_qty_lbs || 0,
      }];
    }
    return [];
  }, [value]);

  const totalAllocated = lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0);
  const remaining = Math.max(0, (requiredLbs || 0) - totalAllocated);
  const isCovered = requiredLbs > 0 ? totalAllocated >= requiredLbs : lots.length > 0;
  const isShort = requiredLbs > 0 && totalAllocated < requiredLbs - 0.001 && totalAllocated > 0;

  const emitChange = (newLots) => {
    // Emit multi-lot shape, plus flatten first lot fields for backwards-compat
    const first = newLots[0] || {};
    onChange({
      lots: newLots,
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
    const available = mix.available_qty_lbs ?? mix.quantity_lbs ?? 0;
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
        // Cap at per-lot available qty (if known)
        const mix = spiceMixes.find(m => m.id === lots[index]?.spice_mix_id);
        const available = mix?.available_qty_lbs ?? mix?.quantity_lbs ?? null;
        if (available !== null) value = Math.min(value, available);
        // Cap total across all lots at requiredLbs
        const otherTotal = lots.reduce((s, l, i) => i === index ? s : s + (Number(l.spice_mix_qty_lbs) || 0), 0);
        value = Math.min(value, Math.max(0, requiredLbs - otherTotal));
      }
      value = parseFloat(value.toFixed(2));
    }
    const newLots = lots.map((l, i) => i === index ? { ...l, [field]: value } : l);
    emitChange(newLots);
  };

  const addLot = () => {
    emitChange([...lots, { spice_mix_id: "", spice_mix_name: "", spice_mix_lot_number: "", spice_mix_qty_lbs: remaining }]);
  };

  const removeLot = (index) => {
    emitChange(lots.filter((_, i) => i !== index));
  };

  // Initialise with one empty row
  useEffect(() => {
    if (lots.length === 0 && !disabled) {
      emitChange([{ spice_mix_id: "", spice_mix_name: "", spice_mix_lot_number: "", spice_mix_qty_lbs: requiredLbs || 0 }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={isLoading ? "Loading..." : "Select a spice mix..."} />
                </SelectTrigger>
                <SelectContent>
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

      {/* Add lot button when already covered but want more */}
      {!disabled && isCovered && !isLoading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-chart-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-medium">
              {totalAllocated.toFixed(2)} lbs allocated across {lots.filter(l => l.spice_mix_id).length} lot{lots.filter(l => l.spice_mix_id).length !== 1 ? "s" : ""}
            </span>
          </div>
          <button onClick={addLot} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <PlusCircle className="w-3 h-3" /> Add lot
          </button>
        </div>
      )}

      {/* Short quantity — require a comment */}
      {isShort && !disabled && (
        <div className="space-y-1.5">
          <Label className="text-xs text-amber-600 font-semibold">
            Reason for short quantity ({remaining.toFixed(2)} lbs under) <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={shortNotes || ""}
            onChange={e => onShortNotesChange?.(e.target.value)}
            placeholder="e.g. scale variance, partial lot used..."
            className="h-16 text-xs"
          />
        </div>
      )}
    </div>
  );
}