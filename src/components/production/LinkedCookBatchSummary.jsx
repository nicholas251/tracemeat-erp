import React, { useEffect } from "react";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * For linking → cooking flows: the linking step already combined batches into one cook
 * batch with its racks, so there is nothing to pick. Show the batch and emit it as the
 * cook batch (no RackUnit records exist for these racks).
 */
export default function LinkedCookBatchSummary({ stage, onChange }) {
  const totalLbs = Number(stage?.input_qty_lbs) || 0;
  const racksCount = Number(stage?.racks_count) || 0;

  useEffect(() => {
    onChange({
      lotNumber: stage.cook_batch_lot,
      rackIds: [],
      racks: [],
      racksCount,
      totalLbs,
      isMixedLot: false,
      sourceLots: stage.input_lot_number ? [stage.input_lot_number] : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id]);

  return (
    <div className="p-4 rounded-xl border-2 border-chart-3/30 bg-chart-3/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-chart-3" />
          <span className="text-sm font-bold">Cook Batch from Linking</span>
        </div>
        <Badge variant="outline" className="font-bold">{totalLbs} lbs · {racksCount} rack(s)</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Lot <span className="font-mono font-semibold text-foreground">{stage.cook_batch_lot}</span>
      </p>
    </div>
  );
}