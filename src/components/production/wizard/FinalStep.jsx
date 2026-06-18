import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, AlertCircle } from "lucide-react";

export default function FinalStep({ stage, capKey, stageLabel, resolvedBatches, form, cookBatch, cookPlan, persistedRacks = [], product, saving, onBack, onComplete }) {
  const isLinking = capKey === "linking";
  const isRacking = capKey === "racking" || capKey === "racking_product";
  const isCooking = capKey === "cooking";
  const isPackaging = capKey === "packaging" && form.case_weights;

  // ── Packaging weight allocation guard ──
  // The operator must account for ALL incoming weight: original-product cases + any
  // remainder split into other same-category products. Completion is blocked until the
  // allocated weight matches the input weight (within a small rounding tolerance).
  const isPackagingStage = capKey === "packaging";
  // Carry-overs pulled into this run add to the incoming weight that must be accounted for.
  const packCarryoverLbs = (form.carryover_records || []).reduce((s, r) => s + (r.lbs || 0), 0);
  const packTotalLbs = parseFloat(((stage?.input_qty_lbs || 0) + packCarryoverLbs).toFixed(2));
  const packCaseWeight = product?.case_weight_lbs || 0;
  const packOriginalLbs = (Number(form.packages_produced) || 0) * packCaseWeight;
  const packSplits = Array.isArray(form.finished_product_splits) ? form.finished_product_splits : [];
  const packSplitLbs = packSplits.reduce((s, raw) => {
    const sp = typeof raw === "string" ? JSON.parse(raw) : raw;
    return s + ((Number(sp?.quantity_cases) || 0) * (Number(sp?.case_weight_lbs) || 0));
  }, 0);
  // Weight parked as an unfinished-case carry-over counts as fully accounted for.
  const packUnfinishedLbs = form.unfinished_allocated ? (Number(form.unfinished_remainder_lbs) || 0) : 0;
  const packAllocatedLbs = parseFloat((packOriginalLbs + packSplitLbs + packUnfinishedLbs).toFixed(2));
  const packUnallocatedLbs = parseFloat((packTotalLbs - packAllocatedLbs).toFixed(2));
  const packFullyAllocated = packTotalLbs > 0 && Math.abs(packUnallocatedLbs) < 0.01;

  const releasedRacks = isRacking && cookPlan?.racks ? cookPlan.racks.filter(r => r.released) : [];
  const releasedLbs = parseFloat(releasedRacks.reduce((s, r) => s + (r.lbs || 0), 0).toFixed(2));
  // Racks already persisted to the smokehouse for this card are the durable source of truth.
  // On re-open, the in-memory cookPlan may not yet reflect them (async rebuild race), which
  // would wrongly keep the Complete button disabled even though racks were released. Count the
  // DB-persisted racks too so a card with released racks can always be completed.
  const persistedReleasedCount = isRacking ? (persistedRacks || []).length : 0;

  const outputLbs = resolvedBatches
    ? resolvedBatches.reduce((s, b) => s + b.batchLbs, 0)
    : isRacking
      ? releasedLbs
      : isCooking && cookBatch
        ? cookBatch.totalLbs
        : form.output_qty_lbs || stage?.input_qty_lbs || 0;

  const canComplete = isLinking ? !!cookBatch
    : isRacking ? (releasedRacks.length > 0 || persistedReleasedCount > 0 || !!cookPlan?.carriedPartial)
    : isCooking ? !!cookBatch
    : isPackagingStage ? (packFullyAllocated && (!isPackaging || form.case_weights?.length > 0))
    : true;

  return (
    <div className="space-y-5">
      <div className={`rounded-xl border-2 p-4 space-y-3 ${canComplete ? "border-chart-2/30 bg-chart-2/8" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-5 h-5 ${canComplete ? "text-chart-2" : "text-muted-foreground"}`} />
          <p className={`font-bold text-base ${canComplete ? "text-chart-2" : "text-muted-foreground"}`}>
            {canComplete ? `Ready to complete ${stageLabel}` : `Review required`}
          </p>
        </div>

        <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
          <span className="text-sm text-muted-foreground">Output quantity</span>
          <span className="font-bold text-lg">{outputLbs} lbs</span>
        </div>

        {isLinking && cookBatch && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batch Lot</span>
              <span className="font-mono font-bold">{cookBatch.lotNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Batch Qty</span>
              <span className="font-semibold">{cookBatch.totalQty} lbs</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Linking Batches</span>
              <span className="font-semibold">{cookBatch.selectedStageIds?.length || 1}</span>
            </div>
          </div>
        )}
        {isLinking && !cookBatch && (
          <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> No cook batch assembled — go back to build one.
          </p>
        )}
        {capKey === "packaging" && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cases (Finished Product)</span>
              <span className="font-semibold">{form.packages_produced || 0}</span>
            </div>
            <div className={`rounded-lg border p-2.5 mt-1 ${packFullyAllocated ? "border-chart-2/30 bg-chart-2/5" : "border-amber-300 bg-amber-50"}`}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weight Allocated</span>
                <span className={`font-semibold ${packFullyAllocated ? "text-chart-2" : "text-amber-700"}`}>
                  {packAllocatedLbs.toFixed(2)} / {packTotalLbs.toFixed(2)} lbs
                </span>
              </div>
              {!packFullyAllocated && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {packUnallocatedLbs > 0
                    ? `${packUnallocatedLbs.toFixed(2)} lbs unallocated — add cases or split the remainder into another ${product?.category || "same-category"} product to complete.`
                    : `Over-allocated by ${Math.abs(packUnallocatedLbs).toFixed(2)} lbs — reduce cases or splits.`}
                </p>
              )}
            </div>
            {form.finished_product_splits && Array.isArray(form.finished_product_splits) && form.finished_product_splits.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Split Into Products</p>
                {form.finished_product_splits.map((split, i) => {
                  const splitData = typeof split === 'string' ? JSON.parse(split) : split;
                  return (
                    <div key={i} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                      <span className="font-semibold">{splitData?.product_name || 'Unknown'}</span>
                      <span className="text-muted-foreground">{splitData?.quantity_cases || 0} cases</span>
                    </div>
                  );
                })}
              </div>
            )}
            {form.unfinished_allocated && (Number(form.unfinished_remainder_lbs) || 0) > 0 && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-xs mt-1">
                <span className="font-semibold text-amber-900">Unfinished case (carry-over)</span>
                <span className="text-amber-700">{(Number(form.unfinished_remainder_lbs) || 0).toFixed(2)} lbs</span>
              </div>
            )}
          </div>
        )}
        {/* Racking: list released racks (each goes individually to the smokehouse) */}
        {isRacking && (
          releasedRacks.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Racks Released</span>
                <span className="font-semibold">{releasedRacks.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Racking Lot</span>
                <span className="font-mono font-semibold">{cookPlan?.lotNumber || "—"}</span>
              </div>
              <div className="space-y-1 pt-1">
                {releasedRacks.map((r) => (
                  <div key={r.rackNumber} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                    <span className="font-semibold">Rack #{r.rackNumber}</span>
                    <span className="text-muted-foreground">{r.lbs} lbs</span>
                  </div>
                ))}
              </div>
            </div>
          ) : cookPlan?.carriedPartial ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-sm text-chart-1 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Partial carried over to next card ({cookPlan.carriedPartial.lbs} lbs).
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> No racks resolved — release a rack or carry over the partial.
            </p>
          )
        )}

        {/* Cooking: cook batch assembled from released racks */}
        {isCooking && cookBatch && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batch Lot</span>
              <span className="font-mono font-semibold">{cookBatch.lotNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Racks in Oven</span>
              <span className="font-semibold">{cookBatch.rackIds.length}</span>
            </div>
            <div className="space-y-1.5 pt-1">
              {cookBatch.racks.map((r, i) => {
                const contribs = (r.lot_contributions || []).filter(c => (c.lbs || 0) > 0);
                const isMixed = contribs.length > 1;
                return (
                  <div key={r.id} className="bg-white/60 rounded px-2.5 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        Oven Rack #{r.oven_position || i + 1}
                        {r.order_number && <span className="text-muted-foreground font-normal ml-1.5">· Order #{r.order_number}</span>}
                      </span>
                      <span className="text-muted-foreground font-semibold">{r.lbs} lbs</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {contribs.map((c, ci) => (
                        <span key={ci} className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/60 rounded px-1.5 py-0.5">
                          {c.lot_number || "—"}: {c.lbs} lbs
                        </span>
                      ))}
                    </div>
                    {isMixed && (
                      <p className="text-[10px] text-amber-700">Mixed-lot rack — {contribs.length} batches</p>
                    )}
                  </div>
                );
              })}
            </div>
            {cookBatch.isMixedLot && (
              <p className="text-[11px] text-amber-700 flex items-center gap-1.5 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5" /> Mixed-lot batch — {cookBatch.sourceLots.length} lots combined.
              </p>
            )}
          </div>
        )}
      </div>

      {resolvedBatches && resolvedBatches.map(b => (
        <div key={b.batchNumber} className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Batch #{b.batchNumber} — {b.batchLbs} lbs
          </p>
          <div className="rounded-xl border divide-y text-sm overflow-hidden">
            {b.ingredients.map((ing, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ing.bucket_name}</span>
                  <span className="text-muted-foreground text-xs font-medium">
                    {(ing.lot_allocations?.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0) || 0).toFixed(2)} lbs
                  </span>
                </div>
                {ing.lot_allocations?.map((a, ai) => (
                  <div key={ai} className="flex justify-between text-xs text-muted-foreground mt-0.5 pl-2">
                    <span className="font-mono">{a.lot_number}</span>
                    <span>{a.actual_lbs} lbs</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

       {!resolvedBatches && Object.keys(form).length > 0 && (
         <div className="rounded-xl border divide-y text-sm overflow-hidden">
           {Object.entries(form).filter(([, v]) => v !== "" && v !== null && v !== undefined).map(([k, v]) => {
             if (k === 'finished_product_splits') return null;
             // Racking shows its authoritative batch lot (…-RACK-B<n>) in the "Racking Lot"
             // row above. The generic form.output_lot_number can hold a non-suffixed value,
             // so hide it here to avoid a misleading mismatch.
             if (isRacking && k === 'output_lot_number') return null;
             if (Array.isArray(v)) return null;
             if (typeof v === 'object') return null;
             return (
               <div key={k} className="flex items-center justify-between px-3 py-2.5">
                 <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                 <span className="font-semibold">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</span>
               </div>
             );
           })}
         </div>
       )}

      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          className="flex-1 gap-2 h-12 text-base font-bold bg-chart-2 hover:bg-chart-2/90"
          onClick={onComplete}
          disabled={saving || !canComplete}
        >
          <CheckCircle2 className="w-5 h-5" />
          {saving ? "Completing…" : `Complete ${stageLabel}`}
        </Button>
      </div>
    </div>
  );
}