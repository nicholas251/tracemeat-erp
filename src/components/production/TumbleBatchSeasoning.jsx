import React, { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, FlaskConical, AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * TumbleBatchSeasoning
 *
 * Splits the incoming raw weight into batches sized by the product's CHOPPING batch
 * size (blend_batch_lbs) and auto-calculates the seasoning per batch from the spice
 * percentage defined in the chopping config (chop_spice_qty_lbs / blend_batch_lbs).
 * Partial (remainder) batches get spice scaled proportionally to their actual weight.
 *
 * Emits the same shape the tumble completion expects:
 *   value = {
 *     lots: [{ spice_mix_id, spice_mix_name, spice_mix_lot_number, spice_mix_qty_lbs }],
 *     spice_mix_id, spice_mix_name, spice_mix_lot_number, spice_mix_qty_lbs (= total),
 *     batches: [{ batch_number, batch_lbs, spice_lbs, is_partial }],
 *   }
 *
 * Props:
 *   totalLbs   – incoming raw weight (stage.input_qty_lbs)
 *   product    – Product record (chopping config)
 *   value      – current value
 *   onChange   – (value) => void
 *   notes / onNotesChange – optional notes passthrough
 */
export default function TumbleBatchSeasoning({ totalLbs = 0, product, value = {}, onChange, notes, onNotesChange }) {
  const batchSize = Number(product?.blend_batch_lbs) || 0;
  const spicePerBatch = Number(product?.chop_spice_qty_lbs) || 0;
  // Spice percentage of the chopping batch (e.g. 12.5 lbs spice / 500 lbs batch = 2.5%)
  const spicePct = batchSize > 0 ? spicePerBatch / batchSize : 0;

  const mixId = product?.chop_spice_mix_id || null;

  const { data: spiceMix = null } = useQuery({
    queryKey: ["tumbleSeasoningMix", mixId],
    queryFn: async () => {
      const mixes = await base44.entities.SpiceMix.filter({ id: mixId });
      return mixes[0] || null;
    },
    enabled: !!mixId,
  });

  // Split raw weight into chopping-sized batches; last batch is the remainder (partial)
  const batches = useMemo(() => {
    if (!batchSize || batchSize <= 0 || !totalLbs) return [];
    const count = Math.ceil(totalLbs / batchSize);
    const rows = [];
    let remaining = totalLbs;
    for (let i = 0; i < count; i++) {
      const thisLbs = Math.min(batchSize, remaining);
      const isPartial = thisLbs < batchSize - 0.001;
      rows.push({
        batch_number: i + 1,
        batch_lbs: parseFloat(thisLbs.toFixed(2)),
        // Spice scales with the batch weight via the chopping spice percentage
        spice_lbs: parseFloat((thisLbs * spicePct).toFixed(2)),
        is_partial: isPartial,
      });
      remaining -= thisLbs;
    }
    return rows;
  }, [totalLbs, batchSize, spicePct]);

  const totalSpiceLbs = useMemo(
    () => parseFloat(batches.reduce((s, b) => s + b.spice_lbs, 0).toFixed(2)),
    [batches]
  );

  const available = spiceMix?.available_qty_lbs ?? spiceMix?.quantity_lbs ?? null;
  const isShort = available != null && totalSpiceLbs > available + 0.001;
  const lotRef = spiceMix
    ? (spiceMix.date_created
        ? `${spiceMix.name.replace(/\s+/g, "-").toUpperCase()}-${spiceMix.date_created}`
        : spiceMix.name.replace(/\s+/g, "-").toUpperCase())
    : "";

  // Emit the calculated value whenever inputs change
  useEffect(() => {
    if (!spiceMix || batches.length === 0) return;
    onChange({
      lots: [{
        spice_mix_id: spiceMix.id,
        spice_mix_name: spiceMix.name,
        spice_mix_lot_number: lotRef,
        spice_mix_qty_lbs: totalSpiceLbs,
      }],
      spice_mix_id: spiceMix.id,
      spice_mix_name: spiceMix.name,
      spice_mix_lot_number: lotRef,
      spice_mix_qty_lbs: totalSpiceLbs,
      batches,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spiceMix?.id, totalSpiceLbs, batches.length]);

  // ── Missing config guards ──
  if (!batchSize) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
        <AlertCircle className="w-4 h-4 shrink-0" />
        No chopping batch size set on this product — set "Total Batch Size" under the Chopping tab to auto-split tumbling batches.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-chart-1 shrink-0" />
        <Label className="font-semibold text-sm">Tumbling Batches & Seasoning</Label>
        <Badge variant="outline" className="text-xs ml-auto">{batches.length} batch{batches.length !== 1 ? "es" : ""}</Badge>
      </div>

      {/* Derived from chopping config */}
      <div className="rounded-lg bg-background border px-3 py-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Chopping batch size</span>
          <span className="font-semibold">{batchSize} lbs</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Seasoning per batch</span>
          <span className="font-semibold">{spicePerBatch} lbs ({(spicePct * 100).toFixed(2)}%)</span>
        </div>
        {spiceMix && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Spice mix</span>
            <span className="font-semibold">{spiceMix.name}</span>
          </div>
        )}
      </div>

      {/* Per-batch breakdown */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {batches.map(b => (
          <div key={b.batch_number} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold">Batch #{b.batch_number}</span>
              {b.is_partial && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">partial</Badge>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">{b.batch_lbs} lbs</Badge>
              <div className="flex items-center gap-1 text-chart-1 font-semibold text-xs">
                <FlaskConical className="w-3.5 h-3.5" />
                {b.spice_lbs} lbs spice
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-chart-2/40 bg-chart-2/8 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-chart-2" />
          <span className="font-semibold text-chart-2">Total seasoning required</span>
        </div>
        <span className="font-bold">{totalSpiceLbs} lbs</span>
      </div>

      {!mixId && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          No spice mix assigned in the chopping config — assign one to track seasoning inventory.
        </div>
      )}

      {isShort && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Only {available} lbs of {spiceMix?.name} available — {(totalSpiceLbs - available).toFixed(2)} lbs short.
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Notes / Observations</Label>
        <Textarea
          value={notes || ""}
          onChange={e => onNotesChange?.(e.target.value)}
          placeholder="Any observations..."
          className="h-16 text-sm"
        />
      </div>
    </div>
  );
}