import React from "react";
import { Scale } from "lucide-react";

// Shows the confirmed blending batch weight (and lot) feeding this chopping stage.
export default function BlendInputSummary({ stage }) {
  if (!stage) return null;
  const lbs = Number(stage.input_qty_lbs) || 0;
  return (
    <div className="rounded-xl border border-chart-1/30 bg-chart-1/5 p-4 space-y-2">
      <p className="text-xs font-bold text-chart-1 uppercase tracking-wider">Confirmed Blending Batch</p>
      <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Scale className="w-4 h-4 text-chart-1 shrink-0" />
          <span className="font-mono text-xs font-semibold truncate">{stage.input_lot_number || "—"}</span>
        </div>
        <span className="font-bold text-base whitespace-nowrap">{lbs.toFixed(2)} lbs</span>
      </div>
      <p className="text-xs text-muted-foreground">Weight confirmed at blending and released to the chopper.</p>
    </div>
  );
}