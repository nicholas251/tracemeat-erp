import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";
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
export default function TumbleProteinBatch({ batch, bucketId, bucketName, value = {}, stageId, locked = false, inventoryRows = [], onChange }) {
  const [error, setError] = React.useState(null);

  const lots = value.lots || null;
  const confirmed = !!value.confirmed;

  const handleConfirm = async () => {
    setError(null);
    // Confirm only RECORDS the operator's lot picks for this batch (traceability).
    // The actual inventory deduction happens ONCE at stage completion (StageWizard),
    // which is the single source of truth — this prevents double-deducting protein.
    const pickedLbs = (lots || []).reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0);
    const actualLbs = pickedLbs > 0 ? pickedLbs : (Number(batch.batch_lbs) || 0);
    if (actualLbs <= 0) {
      setError("Batch has no protein weight to assign.");
      return;
    }
    onChange({ confirmed: true });
  };

  return (
    <div className={`rounded-xl border-2 p-4 transition-colors ${confirmed ? "border-chart-2/40 bg-chart-2/5" : "border-border bg-background"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-sm">Batch #{batch.batch_number}</p>
          <p className="text-xs text-muted-foreground">
            {batch.batch_lbs} lbs protein
            <span className="mx-1">·</span>
            <span className="text-foreground/70">
              {parseFloat((inventoryRows.reduce((s, r) => s + (Number(r.available_qty) || 0), 0)).toFixed(2))} lbs on hand
            </span>
          </p>
        </div>
        {confirmed
          ? <Badge className="bg-chart-2/15 text-chart-2 border-0 gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Consumed</Badge>
          : locked
          ? <Badge variant="outline" className="text-xs gap-1 text-muted-foreground"><Lock className="w-3 h-3" /> Locked</Badge>
          : <Badge variant="outline" className="text-xs">Pending</Badge>
        }
      </div>

      {error && (
        <div className="mb-2 flex items-center gap-1.5 rounded bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {locked ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
          <Lock className="w-4 h-4" /> Confirm the previous batch to unlock this one.
        </div>
      ) : (
        <IngredientLotPicker
          capByRequired
          externalRows={inventoryRows}
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