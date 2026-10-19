import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, User } from "lucide-react";
import moment from "moment";

const STATUS = {
  available: { label: "Ready", cls: "bg-chart-1/15 text-chart-1" },
  in_progress: { label: "In Progress", cls: "bg-accent/15 text-accent" },
  on_hold: { label: "On Hold", cls: "bg-destructive/15 text-destructive" },
};

export default function FloorStageTile({ stage, onClick }) {
  const s = STATUS[stage.status] || STATUS.available;
  const lbs = stage.output_qty_lbs || stage.input_qty_lbs;
  const lot = stage.output_lot_number || stage.cook_batch_lot || stage.input_lot_number;
  return (
    <Card onClick={onClick} className={onClick ? "cursor-pointer hover:shadow-md hover:border-primary/40 transition-all" : ""}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-tight">{stage.product_name}</p>
          <Badge className={`${s.cls} border-0 text-[10px] shrink-0`}>{s.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Order {stage.order_number}</p>
        {lot && <p className="text-[11px] font-mono text-muted-foreground truncate">{lot}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {lbs > 0 && <span className="font-semibold">{Number(lbs).toFixed(0)} lbs</span>}
          {stage.racks_count > 0 && <span>{stage.racks_count} racks</span>}
          {stage.temperature_c != null && <span>{stage.temperature_c}°</span>}
        </div>
        <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          {stage.started_at && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{moment(stage.started_at).fromNow()}</span>
          )}
          {stage.assigned_user_name && (
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{stage.assigned_user_name}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}