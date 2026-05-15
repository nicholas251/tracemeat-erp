import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import IngredientLotPicker from "../blending/IngredientLotPicker";
import { CheckCircle2, Layers, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const RACKS_PER_COOK_BATCH = 3;

function calcCookBatches(totalLbs, lbsPerBatch, lbsPerRack) {
  if (!lbsPerBatch || !lbsPerRack || lbsPerBatch <= 0 || lbsPerRack <= 0) return [];

  const tumbleBatches = Math.ceil(totalLbs / lbsPerBatch);
  const batches = [];
  let remaining = totalLbs;

  for (let t = 0; t < tumbleBatches; t++) {
    const thisBatchLbs = Math.min(lbsPerBatch, remaining);
    const thisRacks = Math.ceil(thisBatchLbs / lbsPerRack);
    const thisCookBatches = Math.max(1, Math.floor(thisRacks / RACKS_PER_COOK_BATCH));

    for (let c = 0; c < thisCookBatches; c++) {
      const racksInThis = c < thisCookBatches - 1 ? RACKS_PER_COOK_BATCH : (thisRacks - c * RACKS_PER_COOK_BATCH);
      const lbsInThis = Math.min(racksInThis * lbsPerRack, thisBatchLbs);
      batches.push({
        cookBatchNum: batches.length + 1,
        tumbleBatchNum: t + 1,
        racks: Math.min(racksInThis, RACKS_PER_COOK_BATCH),
        lbs: parseFloat(lbsInThis.toFixed(2)),
        isPartial: false,
        actualLbs: null, // null means use full lbs
      });
    }
    remaining -= thisBatchLbs;
  }

  return batches;
}

/**
 * A single cook batch row with optional partial toggle and FIFO lot pickers for protein + spice.
 */
function CookBatchRow({ batch, lotPrefix, index, product, onChange }) {
  const [expanded, setExpanded] = useState(false);

  const proteinBucketId = product?.blend_ingredients?.[0]?.bucket_id || null;
  const proteinBucketName = product?.blend_ingredients?.[0]?.bucket_name || "Protein";
  const spiceBucketId = product?.chop_spice_mix_id || null; // used as a proxy; we'll use chop_spice_mix if set
  // Spice actually lives in SpiceMix.ingredients — we fetch the active spice mix
  const { data: spiceMixIngredients = [] } = useQuery({
    queryKey: ["spiceMixIngredients", product?.chop_spice_mix_id],
    queryFn: async () => {
      const mixes = await base44.entities.SpiceMix.filter({ id: product.chop_spice_mix_id });
      return mixes[0]?.ingredients || [];
    },
    enabled: !!product?.chop_spice_mix_id,
  });

  const lotNumber = `${lotPrefix || `COOK-${format(new Date(), "yyyyMMdd")}`}-${index + 1}`;
  const displayLbs = batch.isPartial && batch.actualLbs != null ? batch.actualLbs : batch.lbs;

  const proteinIng = {
    bucket_id: proteinBucketId,
    bucket_name: proteinBucketName,
    required_lbs: displayLbs,
    lot_allocations: batch.proteinLots || null,
    confirmed: batch.proteinConfirmed || false,
    notes: batch.proteinNotes || "",
  };

  // Use first spice ingredient from the mix
  const firstSpice = spiceMixIngredients[0] || null;
  const spiceIng = firstSpice ? {
    bucket_id: firstSpice.bucket_id,
    bucket_name: firstSpice.bucket_name,
    required_lbs: firstSpice.quantity_lbs || 0,
    lot_allocations: batch.spiceLots || null,
    confirmed: batch.spiceConfirmed || false,
    notes: batch.spiceNotes || "",
  } : null;

  const allConfirmed = batch.proteinConfirmed && (!spiceIng || batch.spiceConfirmed);

  return (
    <div className={`rounded-lg border ${allConfirmed ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-background"}`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {allConfirmed
            ? <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" />
            : <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold font-mono">{lotNumber}</p>
            <p className="text-xs text-muted-foreground">{batch.racks} racks · {displayLbs} lbs {batch.isPartial && <span className="text-amber-600">(partial)</span>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Partial</span>
            <Switch
              checked={batch.isPartial}
              onCheckedChange={v => onChange({ ...batch, isPartial: v, actualLbs: v ? batch.lbs : null })}
            />
          </div>
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Partial actual lbs input */}
      {batch.isPartial && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Actual lbs sent to smokehouse</Label>
            <Input
              type="number"
              step="0.1"
              value={batch.actualLbs ?? ""}
              onChange={e => onChange({ ...batch, actualLbs: Number(e.target.value) })}
              className="h-7 text-sm w-28"
              placeholder={String(batch.lbs)}
            />
          </div>
        </div>
      )}

      {/* Expanded: lot pickers */}
      {expanded && (
        <div className="border-t px-3 py-3 space-y-4">
          {/* Protein */}
          {proteinBucketId && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Protein — FIFO Lots</p>
              <IngredientLotPicker
                ing={proteinIng}
                disabled={batch.proteinConfirmed}
                onChange={(field, value) => {
                  if (field === "lot_allocations") onChange({ ...batch, proteinLots: value });
                  else if (field === "notes") onChange({ ...batch, proteinNotes: value });
                }}
                onConfirm={() => onChange({ ...batch, proteinConfirmed: true })}
              />
            </div>
          )}

          {/* Spice */}
          {spiceIng && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Spice — FIFO Lots</p>
              <IngredientLotPicker
                ing={spiceIng}
                disabled={batch.spiceConfirmed}
                onChange={(field, value) => {
                  if (field === "lot_allocations") onChange({ ...batch, spiceLots: value });
                  else if (field === "notes") onChange({ ...batch, spiceNotes: value });
                }}
                onConfirm={() => onChange({ ...batch, spiceConfirmed: true })}
              />
            </div>
          )}

          {!proteinBucketId && !spiceIng && (
            <p className="text-xs text-muted-foreground">No ingredient buckets configured on this product.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Props:
 *   totalLbs   – stage input_qty_lbs
 *   product    – Product record (for ingredient bucket IDs)
 *   cookPlan   – { lbsPerBatch, lbsPerRack, lotPrefix, cookBatches } | null
 *   onChange   – (cookPlan | null) => void
 */
export default function TumbleCookBatchBuilder({ totalLbs, product, cookPlan, onChange }) {
  const [lbsPerBatch, setLbsPerBatch] = useState(cookPlan?.lbsPerBatch || "");
  const [lbsPerRack, setLbsPerRack] = useState(cookPlan?.lbsPerRack || "");
  const [lotPrefix, setLotPrefix] = useState(cookPlan?.lotPrefix || "");
  const [batchRows, setBatchRows] = useState(null); // null = not yet built

  const previewBatches = useMemo(() => {
    if (!lbsPerBatch || !lbsPerRack) return [];
    return calcCookBatches(totalLbs, Number(lbsPerBatch), Number(lbsPerRack));
  }, [totalLbs, lbsPerBatch, lbsPerRack]);

  const handleBuild = () => {
    if (previewBatches.length === 0) return;
    const today = format(new Date(), "yyyyMMdd");
    const prefix = lotPrefix.trim() || `COOK-${today}`;
    setLotPrefix(prefix);
    setBatchRows(previewBatches.map(b => ({ ...b, isPartial: false, actualLbs: null, proteinLots: null, spiceLots: null, proteinConfirmed: false, spiceConfirmed: false })));
  };

  const handleClear = () => {
    setBatchRows(null);
    onChange(null);
  };

  const updateBatchRow = (index, updated) => {
    const newRows = batchRows.map((r, i) => i === index ? updated : r);
    setBatchRows(newRows);
  };

  const handleConfirmPlan = () => {
    const today = format(new Date(), "yyyyMMdd");
    const prefix = lotPrefix.trim() || `COOK-${today}`;
    onChange({
      lbsPerBatch: Number(lbsPerBatch),
      lbsPerRack: Number(lbsPerRack),
      lotPrefix: prefix,
      cookBatches: batchRows.map((b, i) => ({
        ...b,
        lotNumber: `${prefix}-${i + 1}`,
        lbs: b.isPartial && b.actualLbs != null ? b.actualLbs : b.lbs,
      })),
    });
  };

  // If already confirmed, show summary
  if (cookPlan) {
    return (
      <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-chart-1" />
          <Label className="font-semibold">Cook Batch Assembly</Label>
        </div>
        <div className="rounded-lg border border-chart-2/40 bg-chart-2/8 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-chart-2" />
            <span className="font-semibold text-sm text-chart-2">
              {cookPlan.cookBatches.length} Cook Batch{cookPlan.cookBatches.length !== 1 ? "es" : ""} Confirmed
            </span>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {cookPlan.cookBatches.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{b.lotNumber}</span>
                <div className="flex gap-1.5">
                  {b.isPartial && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">partial</Badge>}
                  <Badge variant="outline" className="text-xs">{b.racks} racks</Badge>
                  <Badge variant="outline" className="text-xs">{b.lbs} lbs</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleClear} className="w-full text-xs">
          Change Configuration
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-chart-1" />
        <Label className="font-semibold">Cook Batch Assembly</Label>
      </div>

      {!batchRows ? (
        /* ── Step 1: configure dimensions ── */
        <>
          <p className="text-xs text-muted-foreground">
            Enter batch size and rack capacity. Every 3 racks = 1 cook batch for the smokehouse.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Lbs per Tumble Batch</Label>
              <Input
                type="number"
                step="0.1"
                value={lbsPerBatch}
                onChange={e => setLbsPerBatch(e.target.value)}
                placeholder="e.g. 300"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lbs per Rack</Label>
              <Input
                type="number"
                step="0.1"
                value={lbsPerRack}
                onChange={e => setLbsPerRack(e.target.value)}
                placeholder="e.g. 100"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Lot # Prefix (optional)</Label>
            <Input
              value={lotPrefix}
              onChange={e => setLotPrefix(e.target.value)}
              placeholder={`e.g. COOK-${format(new Date(), "yyyyMMdd")}`}
              className="h-8 text-sm"
            />
          </div>

          {/* Live preview */}
          {previewBatches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Preview — {previewBatches.length} cook batch{previewBatches.length !== 1 ? "es" : ""}
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {previewBatches.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-xs rounded border bg-background px-2.5 py-1.5">
                    <span className="font-medium">Cook Batch #{b.cookBatchNum}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{b.racks} racks</Badge>
                      <Badge variant="outline" className="text-xs">{b.lbs} lbs</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" className="w-full gap-1.5 mt-1" onClick={handleBuild}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Build {previewBatches.length} Cook Batch{previewBatches.length !== 1 ? "es" : ""}
              </Button>
            </div>
          )}

          {lbsPerBatch && lbsPerRack && previewBatches.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-destructive p-2 bg-destructive/5 rounded">
              <AlertCircle className="w-3.5 h-3.5" />
              Could not calculate batches — check values.
            </div>
          )}
        </>
      ) : (
        /* ── Step 2: confirm lots & mark partials ── */
        <>
          <p className="text-xs text-muted-foreground">
            Expand each batch to assign FIFO lots for protein and spice. Toggle <strong>Partial</strong> if product ran short.
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-0.5">
            {batchRows.map((batch, i) => (
              <CookBatchRow
                key={i}
                index={i}
                batch={batch}
                lotPrefix={lotPrefix}
                product={product}
                onChange={updated => updateBatchRow(i, updated)}
              />
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={handleClear} className="text-xs">
              Reset
            </Button>
            <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleConfirmPlan}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirm Cook Plan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}