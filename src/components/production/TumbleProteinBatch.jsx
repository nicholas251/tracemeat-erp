import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import IngredientLotPicker from "../blending/IngredientLotPicker";

/**
 * TumbleProteinBatch
 *
 * One tumble batch's protein assignment + immediate consumption.
 * On confirm it deducts the assigned lots from RawInventory right away, then
 * invalidates the inventory cache so the NEXT batch's picker shows the reduced
 * available quantities live.
 *
 * Props:
 *   batch        – { batch_number, batch_lbs }
 *   bucketId / bucketName – protein bucket to draw from
 *   value        – { lots, confirmed }
 *   stageId      – ProductionStage id (for deduction traceability)
 *   onChange     – (patch) => void   (patch merged into this batch's value)
 */
export default function TumbleProteinBatch({ batch, bucketId, bucketName, value = {}, stageId, onChange }) {
  const queryClient = useQueryClient();
  const [deducting, setDeducting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const lots = value.lots || null;
  const confirmed = !!value.confirmed;

  const handleConfirm = async () => {
    setDeducting(true);
    setError(null);
    try {
      const actualLbs = (lots || []).reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0);
      // Deduct this batch's protein from raw inventory immediately.
      await base44.functions.invoke("deductRawInventoryOnBatchComplete", {
        stage_id: stageId,
        ingredients: [{
          bucket_id: bucketId,
          bucket_name: bucketName || "Protein",
          actual_lbs: actualLbs,
          lot_allocations: lots,
        }],
      });
      // Mark confirmed first so this picker locks (and stops refetching), THEN
      // refresh inventory so EVERY other batch's picker re-FIFOs from reduced qty.
      // Each batch now has its own cache key, so we invalidate the whole
      // rawInventory family to force all pending siblings to refetch live.
      onChange({ confirmed: true });
      await queryClient.invalidateQueries({ queryKey: ["rawInventory"] });
    } catch (err) {
      setError(err?.message || "Deduction failed — inventory was not changed. Try again.");
    } finally {
      setDeducting(false);
    }
  };

  return (
    <div className={`rounded-xl border-2 p-4 transition-colors ${confirmed ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-background"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-sm">Batch #{batch.batch_number}</p>
          <p className="text-xs text-muted-foreground">{batch.batch_lbs} lbs protein</p>
        </div>
        {confirmed
          ? <Badge className="bg-chart-2/15 text-chart-2 border-0 gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Consumed</Badge>
          : <Badge variant="outline" className="text-xs">Pending</Badge>
        }
      </div>

      {error && (
        <div className="mb-2 flex items-center gap-1.5 rounded bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {deducting ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Consuming inventory…
        </div>
      ) : (
        <IngredientLotPicker
          cacheKey={`tumble-batch-${batch.batch_number}`}
          ing={{
            bucket_id: bucketId,
            bucket_name: bucketName,
            required_lbs: batch.batch_lbs,
            lot_allocations: lots,
            confirmed,
          }}
          disabled={confirmed}
          onChange={(field, val) => {
            if (field === "lot_allocations") onChange({ lots: val });
          }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}