import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2 } from "lucide-react";
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

  const lots = value.lots || null;
  const confirmed = !!value.confirmed;

  const handleConfirm = async () => {
    setDeducting(true);
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
      // Refresh inventory so the next batch sees the reduced available qty.
      await queryClient.invalidateQueries({ queryKey: ["rawInventory", bucketId] });
      onChange({ confirmed: true });
    } catch (err) {
      console.warn("Per-batch protein deduction failed:", err);
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

      {deducting ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Consuming inventory…
        </div>
      ) : (
        <IngredientLotPicker
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