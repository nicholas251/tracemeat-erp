import React from "react";
import FloorStageTile from "./FloorStageTile";

export default function FloorStageColumn({ name, stages, onSelect }) {
  const lbs = stages.reduce((s, st) => s + (st.output_qty_lbs || st.input_qty_lbs || 0), 0);
  const active = stages.filter(s => s.status === "in_progress").length;
  return (
    <div className="w-72 shrink-0 bg-muted/40 rounded-xl border p-3 space-y-3">
      <div>
        <p className="font-bold text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">
          {stages.length} card{stages.length !== 1 ? "s" : ""} · {active} running · {lbs.toFixed(0)} lbs
        </p>
      </div>
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        {stages.map(st => (
          <FloorStageTile key={st.id} stage={st} onClick={onSelect ? () => onSelect(st) : null} />
        ))}
      </div>
    </div>
  );
}