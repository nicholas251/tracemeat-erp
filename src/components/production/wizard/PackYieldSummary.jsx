import React from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

export default function PackYieldSummary({ expectedLbs, packedLbs, diffLbs, yieldPct }) {
  const even = Math.abs(diffLbs) < 0.01;
  const gain = diffLbs > 0;
  const tone = packedLbs <= 0
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : even ? "border-chart-2/30 bg-chart-2/5 text-chart-2"
    : gain ? "border-chart-2/30 bg-chart-2/5 text-chart-2"
    : "border-amber-300 bg-amber-50 text-amber-700";
  const Icon = gain ? TrendingUp : TrendingDown;

  return (
    <div className={`rounded-lg border p-2.5 mt-1 space-y-1 ${tone}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">From Cooling</span>
        <span className="font-semibold text-foreground">{expectedLbs.toFixed(2)} lbs</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Packed to Inventory</span>
        <span className="font-semibold text-foreground">{packedLbs.toFixed(2)} lbs</span>
      </div>
      {packedLbs <= 0 ? (
        <p className="text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> Enter cases packed to complete.
        </p>
      ) : (
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-current/20">
          <span className="flex items-center gap-1.5">
            {!even && <Icon className="w-4 h-4" />}
            {even ? "On target" : gain ? "Yield Gain" : "Yield Loss"}
          </span>
          <span>
            {gain ? "+" : ""}{diffLbs.toFixed(2)} lbs · {yieldPct}%
          </span>
        </div>
      )}
    </div>
  );
}