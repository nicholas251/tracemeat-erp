import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";

/**
 * SpiceMixLotPicker
 *
 * Dropdown of active SpiceMix records. When selected, auto-fills the lot number
 * from the SpiceMix record. Also shows required vs available qty.
 *
 * Props:
 *   label        – field label string
 *   requiredLbs  – how many lbs are needed (from product config)
 *   value        – { spice_mix_id, spice_mix_name, spice_mix_lot_number, spice_mix_qty_lbs } | {}
 *   onChange     – (updatedValue) => void
 *   disabled     – boolean
 */
export default function SpiceMixLotPicker({ label, requiredLbs, value = {}, onChange, disabled }) {
  const { data: spiceMixes = [], isLoading } = useQuery({
    queryKey: ["spiceMixesActive"],
    queryFn: () => base44.entities.SpiceMix.filter({ status: "active" }),
  });

  const selectedMix = spiceMixes.find(m => m.id === value.spice_mix_id) || null;
  const available = selectedMix?.available_qty_lbs ?? selectedMix?.quantity_lbs ?? null;
  const isInsufficient = available !== null && requiredLbs > 0 && available < requiredLbs;

  const handleSelectMix = (mixId) => {
    const mix = spiceMixes.find(m => m.id === mixId);
    if (!mix) return;
    // SpiceMix records don't have an explicit lot_number field — use their name + date as lot ref
    // unless a notes field or date_created is present
    const lotRef = mix.date_created
      ? `${mix.name.replace(/\s+/g, "-").toUpperCase()}-${mix.date_created}`
      : mix.name.replace(/\s+/g, "-").toUpperCase();
    onChange({
      spice_mix_id: mix.id,
      spice_mix_name: mix.name,
      spice_mix_lot_number: lotRef,
      spice_mix_qty_lbs: requiredLbs || mix.quantity_lbs || 0,
    });
  };

  const handleLotOverride = (lotVal) => {
    onChange({ ...value, spice_mix_lot_number: lotVal });
  };

  const handleQtyChange = (qty) => {
    onChange({ ...value, spice_mix_qty_lbs: Number(qty) });
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

      {/* Dropdown */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Select Spice Mix</Label>
        <Select
          value={value.spice_mix_id || ""}
          onValueChange={handleSelectMix}
          disabled={disabled || isLoading}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder={isLoading ? "Loading mixes..." : "Select a pre-made spice mix..."} />
          </SelectTrigger>
          <SelectContent>
            {spiceMixes.map(mix => (
              <SelectItem key={mix.id} value={mix.id}>
                <div className="flex items-center justify-between gap-4 w-full">
                  <span>{mix.name}</span>
                  {mix.available_qty_lbs != null && (
                    <span className="text-xs text-muted-foreground">{mix.available_qty_lbs} lbs avail.</span>
                  )}
                </div>
              </SelectItem>
            ))}
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
              Only {available} lbs available — {requiredLbs} lbs required
            </div>
          )}

          {/* Lot number — auto-filled, editable */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Lot / Batch Reference</Label>
            <Input
              value={value.spice_mix_lot_number || ""}
              onChange={e => handleLotOverride(e.target.value)}
              placeholder="Auto-filled from spice mix"
              className="h-10 text-sm"
              disabled={disabled}
            />
          </div>

          {/* Qty used — pre-filled from product config but editable */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Qty Used (lbs)</Label>
            <Input
              type="number"
              step="0.01"
              value={value.spice_mix_qty_lbs ?? requiredLbs ?? ""}
              onChange={e => handleQtyChange(e.target.value)}
              className="h-10 text-sm"
              disabled={disabled}
            />
          </div>

          {!disabled && (
            <div className="flex items-center gap-1.5 text-xs text-chart-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">{selectedMix.name} selected — lot recorded</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}