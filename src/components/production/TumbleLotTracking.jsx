import React, { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, AlertCircle } from "lucide-react";
import IngredientLotPicker from "../blending/IngredientLotPicker";
import SpiceMixLotPicker from "./SpiceMixLotPicker";

/**
 * TumbleLotTracking
 *
 * Full lot traceability for the tumbling stage (when racking follows).
 * Splits the incoming raw weight into batches sized by the product's CHOPPING batch
 * size (blend_batch_lbs) to derive the required seasoning, then lets the operator:
 *   1. Pick the ACTUAL protein FIFO lots going into the tumbler (raw inventory).
 *   2. Pick the ACTUAL SpiceMix production lots used.
 *
 * Emits (via onChange):
 *   {
 *     proteinLots: [{ lot_number, raw_inventory_id, actual_lbs, ... }],
 *     proteinBucketId, proteinBucketName,
 *     spice_mix: { lots: [...], spice_mix_id, spice_mix_name, spice_mix_lot_number, spice_mix_qty_lbs },
 *     spice_mix_id, spice_mix_name, spice_mix_lot_number, spice_mix_qty_lbs,
 *     batches: [{ batch_number, batch_lbs, spice_lbs, is_partial }],
 *     totalSpiceLbs,
 *   }
 *
 * Props:
 *   totalLbs   – incoming raw protein weight (stage.input_qty_lbs)
 *   product    – Product record (chopping config + blend_ingredients)
 *   value      – current value
 *   onChange   – (value) => void
 *   notes / onNotesChange – optional notes passthrough
 */
export default function TumbleLotTracking({ totalLbs = 0, product, value = {}, onChange, notes, onNotesChange }) {
  const batchSize = Number(product?.blend_batch_lbs) || 0;
  const spicePerBatch = Number(product?.chop_spice_qty_lbs) || 0;
  const spicePct = batchSize > 0 ? spicePerBatch / batchSize : 0;

  const defaultProteinBucketId = product?.blend_ingredients?.[0]?.bucket_id || null;
  const defaultProteinBucketName = product?.blend_ingredients?.[0]?.bucket_name || "Protein";

  // Load active protein buckets so the operator can override which bucket to draw from
  const { data: proteinBuckets = [] } = useQuery({
    queryKey: ["proteinBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "protein", status: "active" }),
  });

  // Operator-selected bucket overrides the product default
  const proteinBucketId = value.proteinBucketId || defaultProteinBucketId;
  const proteinBucketName =
    proteinBuckets.find(b => b.id === proteinBucketId)?.name || defaultProteinBucketName;

  // Split raw weight into chopping-sized batches to derive total seasoning required
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

  const proteinLots = value.proteinLots || null;
  const proteinConfirmed = value.proteinConfirmed || false;
  // Stabilise the spice value reference so the child picker's Select doesn't
  // get torn down / reset on every parent re-render (which made the dropdown
  // impossible to open).
  const spiceValue = useMemo(() => value.spice_mix || {}, [value.spice_mix]);

  const proteinIng = {
    bucket_id: proteinBucketId,
    bucket_name: proteinBucketName,
    required_lbs: parseFloat((totalLbs || 0).toFixed(2)),
    lot_allocations: proteinLots,
    confirmed: proteinConfirmed,
    notes: value.proteinNotes || "",
  };

  const emit = (patch) => onChange({ ...value, ...patch });

  // Keep derived batch + spice totals in the emitted value.
  // Only emit when a derived field genuinely differs to avoid a render
  // feedback loop that closes the spice-mix dropdown mid-selection.
  useEffect(() => {
    if (batches.length === 0) return;
    const spiceTotal = spiceValue?.lots
      ? spiceValue.lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0)
      : (Number(spiceValue?.spice_mix_qty_lbs) || 0);

    const next = {
      batches,
      totalSpiceLbs,
      proteinBucketId,
      proteinBucketName,
      spice_mix_id: spiceValue.spice_mix_id || "",
      spice_mix_name: spiceValue.spice_mix_name || "",
      spice_mix_lot_number: spiceValue.spice_mix_lot_number || "",
      spice_mix_qty_lbs: spiceTotal,
    };

    const unchanged =
      value.totalSpiceLbs === next.totalSpiceLbs &&
      value.proteinBucketId === next.proteinBucketId &&
      value.spice_mix_id === next.spice_mix_id &&
      value.spice_mix_lot_number === next.spice_mix_lot_number &&
      value.spice_mix_qty_lbs === next.spice_mix_qty_lbs &&
      (value.batches?.length || 0) === batches.length;

    if (unchanged) return;
    onChange({ ...value, ...next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches.length, totalSpiceLbs, spiceValue?.spice_mix_id, JSON.stringify(spiceValue?.lots || [])]);

  if (!batchSize) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
        <AlertCircle className="w-4 h-4 shrink-0" />
        No chopping batch size set on this product — set "Total Batch Size" under the Chopping tab to auto-calc seasoning.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seasoning requirement summary */}
      <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-chart-1 shrink-0" />
          <Label className="font-semibold text-sm">Tumbling Batches</Label>
          <Badge variant="outline" className="text-xs ml-auto">{batches.length} batch{batches.length !== 1 ? "es" : ""}</Badge>
        </div>
        <div className="rounded-lg bg-background border px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Incoming protein</span>
            <span className="font-semibold">{parseFloat((totalLbs || 0).toFixed(2))} lbs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Seasoning per batch</span>
            <span className="font-semibold">{spicePerBatch} lbs ({(spicePct * 100).toFixed(2)}%)</span>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-muted-foreground">Total seasoning required</span>
            <span className="font-bold text-chart-1">{totalSpiceLbs} lbs</span>
          </div>
        </div>
      </div>

      {/* Protein FIFO lots */}
      <div className="rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Protein — FIFO Lots</p>
        </div>

        {/* Bucket selector */}
        <div className="space-y-1 mb-3">
          <Label className="text-xs font-semibold text-muted-foreground">
            Protein Bucket
            {value.proteinBucketId && value.proteinBucketId !== defaultProteinBucketId && (
              <span className="text-amber-600 font-normal ml-1">(overridden)</span>
            )}
          </Label>
          <Select
            value={proteinBucketId || ""}
            disabled={proteinConfirmed}
            onValueChange={(v) => {
              // Switching bucket resets the FIFO lots so they re-pick from the new bucket
              emit({ proteinBucketId: v, proteinBucketName: proteinBuckets.find(b => b.id === v)?.name || "", proteinLots: null });
            }}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder="Select protein bucket..." />
            </SelectTrigger>
            <SelectContent>
              {proteinBuckets.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
              {proteinBuckets.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No protein buckets found</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {proteinBucketId ? (
          <IngredientLotPicker
            ing={proteinIng}
            disabled={proteinConfirmed}
            onChange={(field, val) => {
              if (field === "lot_allocations") emit({ proteinLots: val });
              else if (field === "notes") emit({ proteinNotes: val });
            }}
            onConfirm={() => emit({ proteinConfirmed: true })}
          />
        ) : (
          <p className="text-xs text-amber-700">No protein bucket configured on this product (set blend ingredients).</p>
        )}
      </div>

      {/* Spice mix production lots */}
      <div className="rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spice Mix Used</p>
          {product?.chop_spice_mix_name && (
            <Badge variant="secondary" className="text-xs">{product.chop_spice_mix_name}</Badge>
          )}
        </div>
        <SpiceMixLotPicker
          label=""
          requiredLbs={totalSpiceLbs}
          value={spiceValue}
          filterSpiceMixId={product?.chop_spice_mix_id || undefined}
          shortNotes={value.spiceShortNotes}
          onShortNotesChange={(v) => emit({ spiceShortNotes: v })}
          onChange={(val) => emit({ spice_mix: val })}
        />
      </div>

      {/* Notes */}
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