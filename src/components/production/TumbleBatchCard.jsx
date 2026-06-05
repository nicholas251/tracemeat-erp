import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  releasing,
  onRelease,
}) {
  const [proteinIng, setProteinIng] = useState({
    bucket_id: proteinBucket?.bucket_id,
    bucket_name: proteinBucket?.bucket_name || "Protein",
    required_lbs: batch.protein_lbs,
    lot_allocations: null,
    confirmed: false,
  });
  const [proteinConfirmed, setProteinConfirmed] = useState(false);
  const [spice, setSpice] = useState({});

  const spiceTotal = spice?.lots
    ? spice.lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0)
    : 0;
  const spiceReady = batch.spice_lbs <= 0 || Math.abs(spiceTotal - batch.spice_lbs) < 0.01;

  const canRelease = proteinConfirmed && spiceReady && !released && !releasing;

  const handleRelease = () => {
    const proteinLots = (proteinIng.lot_allocations || []).filter(
      (l) => l.raw_inventory_id && (Number(l.actual_lbs) || 0) > 0
    );
    onRelease({
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
        <div className="rounded-lg bg-chart-2/5 border border-chart-2/30 px-3 py-2.5 text-xs text-chart-2 flex items-center gap-2">
          <PackageCheck className="w-4 h-4" />
          {batch.total_lbs} lbs released to racking.
        </div>
      ) : (
        <>
          {/* Protein lot picker (FIFO) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Protein
            </p>
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
            ) : !proteinConfirmed ? (
              <>
                <Lock className="w-4 h-4" /> Confirm protein first
              </>
            ) : !spiceReady ? (
              <>
                <Lock className="w-4 h-4" /> Allocate spice first
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