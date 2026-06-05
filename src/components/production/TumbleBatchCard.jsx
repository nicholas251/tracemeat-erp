import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, PackageCheck, Lock } from "lucide-react";
import IngredientLotPicker from "@/components/blending/IngredientLotPicker";
import SpiceMixLotPicker from "@/components/production/SpiceMixLotPicker";

/**
 * TumbleBatchCard
 *
 * One standalone tumble batch. The operator:
 *   1. Picks protein lots (FIFO) totaling this batch's protein weight.
 *   2. Picks the spice mix lot(s) for this batch's seasoning weight.
 *   3. Releases the batch — which deducts protein + spice and creates a
 *      racking card carrying (protein + spice) lbs.
 *
 * Props:
 *   batch          – { batch_number, protein_lbs, spice_lbs, total_lbs }
 *   proteinBucket  – { bucket_id, bucket_name }
 *   spiceMixId     – product's chop_spice_mix_id (filter)
 *   released       – boolean (already released)
 *   releasing      – boolean (this batch is mid-release)
 *   onRelease      – ({ proteinLots, spiceLots, spiceQty }) => Promise
 */
export default function TumbleBatchCard({
  batch,
  proteinBucket,
  spiceMixId,
  released,
  releaseDetails,
  releasing,
  onRelease,
}) {
  // Operator picks which protein bucket to pull from (pre-filled if the product has one).
  const [selectedBucketId, setSelectedBucketId] = useState(proteinBucket?.bucket_id || "");
  const [proteinIng, setProteinIng] = useState({
    bucket_id: proteinBucket?.bucket_id,
    bucket_name: proteinBucket?.bucket_name || "Protein",
    required_lbs: batch.protein_lbs,
    lot_allocations: null,
    confirmed: false,
  });
  const [proteinConfirmed, setProteinConfirmed] = useState(false);
  const [spice, setSpice] = useState({});

  // Available protein buckets to choose from.
  const { data: proteinBuckets = [] } = useQuery({
    queryKey: ["proteinBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "protein", status: "active" }),
  });

  // Auto-select the protein bucket if the product didn't pre-set one and there's
  // exactly one active protein bucket — so deduction never silently gets skipped.
  useEffect(() => {
    if (!selectedBucketId && proteinBuckets.length === 1) {
      handleSelectBucket(proteinBuckets[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proteinBuckets, selectedBucketId]);

  const hasProteinBucket = !!selectedBucketId;

  const handleSelectBucket = (id) => {
    const b = proteinBuckets.find((x) => x.id === id);
    setSelectedBucketId(id);
    setProteinConfirmed(false);
    setProteinIng({
      bucket_id: id,
      bucket_name: b?.name || "Protein",
      required_lbs: batch.protein_lbs,
      lot_allocations: null,
      confirmed: false,
    });
  };

  const spiceTotal = spice?.lots
    ? spice.lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0)
    : 0;
  const spiceReady = batch.spice_lbs <= 0 || Math.abs(spiceTotal - batch.spice_lbs) < 0.01;
  // Hard guard: never release if any spice lot pulls more than is in stock right now.
  const spiceOverDraw = !!spice?.has_over_draw;

  const canRelease = hasProteinBucket && spiceReady && !spiceOverDraw && !released && !releasing;

  const handleRelease = () => {
    const proteinLots = (proteinIng.lot_allocations || []).filter(
      (l) => l.raw_inventory_id && (Number(l.actual_lbs) || 0) > 0
    );
    onRelease({
      proteinBucket: { bucket_id: selectedBucketId, bucket_name: proteinIng.bucket_name },
      proteinLots,
      spiceLots: spice?.lots?.filter((l) => l.spice_mix_id) || [],
      spiceQty: spiceTotal,
    });
  };

  return (
    <div
      className={`rounded-xl border-2 p-4 space-y-4 ${
        released ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">Batch #{batch.batch_number}</span>
          <Badge variant="outline" className="text-xs">
            {batch.protein_lbs} lbs protein
          </Badge>
          {batch.spice_lbs > 0 && (
            <Badge variant="secondary" className="text-xs">
              {batch.spice_lbs} lbs spice
            </Badge>
          )}
        </div>
        {released && (
          <span className="text-xs font-semibold text-chart-2 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Released
          </span>
        )}
      </div>

      {released ? (
        <div className="space-y-2">
          <div className="rounded-lg bg-chart-2/5 border border-chart-2/30 px-3 py-2.5 text-xs text-chart-2 flex items-center gap-2">
            <PackageCheck className="w-4 h-4" />
            {batch.total_lbs} lbs released to racking.
          </div>
          {/* Proof of what was deducted from inventory */}
          {releaseDetails?.proteinLots?.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                Deducted from {releaseDetails.bucketName}
              </p>
              {releaseDetails.proteinLots.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span className="font-mono text-muted-foreground">Lot {l.lot_number || "—"}</span>
                  <span className="font-semibold text-destructive">−{l.actual_lbs} lbs</span>
                </div>
              ))}
            </div>
          )}
          {releaseDetails?.spiceLots?.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                Spice mix deducted
              </p>
              {releaseDetails.spiceLots.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span className="font-mono text-muted-foreground">{l.spice_mix_name || "Spice mix"}</span>
                  <span className="font-semibold text-destructive">−{l.spice_mix_qty_lbs} lbs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Protein: pick bucket, then FIFO lot picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Protein
            </p>
            <Select value={selectedBucketId} onValueChange={handleSelectBucket} disabled={proteinConfirmed}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select protein bucket to pull from..." />
              </SelectTrigger>
              <SelectContent>
                {proteinBuckets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasProteinBucket && (
              <>
                <IngredientLotPicker
                  ing={proteinIng}
                  disabled={proteinConfirmed}
                  cacheKey={`tumble-batch-${batch.batch_number}`}
                  onChange={(field, value) =>
                    setProteinIng((p) => ({ ...p, [field]: value }))
                  }
                  onConfirm={() => setProteinConfirmed(true)}
                />
                {proteinConfirmed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setProteinConfirmed(false)}
                  >
                    Edit protein lots
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Spice mix picker */}
          {batch.spice_lbs > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Spice Mix
              </p>
              <SpiceMixLotPicker
                label=""
                requiredLbs={batch.spice_lbs}
                value={spice}
                filterSpiceMixId={spiceMixId || undefined}
                onChange={setSpice}
              />
            </div>
          )}

          {/* Release */}
          <Button
            className="w-full gap-2 h-11 font-bold bg-chart-2 hover:bg-chart-2/90"
            disabled={!canRelease}
            onClick={handleRelease}
          >
            {releasing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Releasing…
              </>
            ) : !hasProteinBucket ? (
              <>
                <Lock className="w-4 h-4" /> Select protein bucket
              </>
            ) : spiceOverDraw ? (
              <>
                <Lock className="w-4 h-4" /> Not enough spice in stock
              </>
            ) : !spiceReady ? (
              <>
                <Lock className="w-4 h-4" /> Meet spice mix requirement ({batch.spice_lbs} lbs)
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4" /> Release Batch to Racking
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}