import React from "react";
import StatusBadge from "@/components/shared/StatusBadge";
import Hl from "./Hl";
import { format } from "date-fns";

export default function StageList({ stages, hit }) {
  return (
    <div className="space-y-2">
      {stages.map(stage => (
        <div key={stage.id} className="border rounded p-2.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold capitalize">
              {stage.capability_name || stage.capability_key}
              {stage.batch_tag && <span className="text-muted-foreground font-normal ml-1">· {stage.batch_tag}</span>}
            </span>
            <StatusBadge status={stage.status} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-muted-foreground">
            <div><span className="font-semibold text-foreground">In:</span> {stage.input_qty_lbs || 0} lbs</div>
            <div><span className="font-semibold text-foreground">Out:</span> {stage.output_qty_lbs ?? "—"} lbs</div>
            {stage.input_lot_number && <div className="col-span-2"><span className="font-semibold text-foreground">In lot:</span> <Hl on={hit(stage.input_lot_number)}>{stage.input_lot_number}</Hl></div>}
            {stage.output_lot_number && <div className="col-span-2"><span className="font-semibold text-foreground">Out lot:</span> <Hl on={hit(stage.output_lot_number)}>{stage.output_lot_number}</Hl></div>}
            {stage.cook_batch_lot && <div className="col-span-2"><span className="font-semibold text-foreground">Cook batch:</span> <Hl on={hit(stage.cook_batch_lot)}>{stage.cook_batch_lot}</Hl></div>}
            {stage.spice_mix_lot_number && <div className="col-span-2"><span className="font-semibold text-foreground">Spice lot:</span> <Hl on={hit(stage.spice_mix_lot_number)}>{stage.spice_mix_lot_number}</Hl></div>}
            {stage.cure_lot_number && <div className="col-span-2"><span className="font-semibold text-foreground">Cure lot:</span> <Hl on={hit(stage.cure_lot_number)}>{stage.cure_lot_number}</Hl></div>}
          </div>
          {(stage.sub_batches || []).length > 0 && (
            <div className="text-muted-foreground">
              <span className="font-semibold text-foreground">Batches:</span>{" "}
              {stage.sub_batches.map((sb, i) => (
                <span key={i}>{i > 0 && ", "}{sb.label || sb.sub_batch_id} <Hl on={hit(sb.lot_number)}>{sb.lot_number}</Hl> ({sb.qty_lbs ?? sb.lbs ?? 0} lbs)</span>
              ))}
            </div>
          )}
          {stage.completed_at && <p className="text-muted-foreground">Completed {format(new Date(stage.completed_at), "MMM d, yyyy HH:mm")}{stage.assigned_user_name ? ` · ${stage.assigned_user_name}` : ""}</p>}
        </div>
      ))}
    </div>
  );
}