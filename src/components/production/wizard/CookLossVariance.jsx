import React from "react";

// Actual cook loss vs the product's set-point cook loss. Plus = less loss than
// expected (better yield); minus = more loss. Trends here signal a yield adjustment.
export default function CookLossVariance({ cook }) {
  const better = cook.deltaPts >= 0;
  const tone = better ? "border-chart-2/30 bg-chart-2/5 text-chart-2" : "border-amber-300 bg-amber-50 text-amber-700";
  return (
    <div className={`rounded-lg border p-2.5 mt-2 space-y-1 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-wider">Cook Loss vs Set Point</p>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Raw into oven</span>
        <span className="font-semibold text-foreground">{cook.rawLbs.toFixed(2)} lbs</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Set point</span>
        <span className="font-semibold text-foreground">{cook.setYield}% yield · {cook.setLoss}% loss</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Actual</span>
        <span className="font-semibold text-foreground">{cook.actualYield}% yield · {cook.actualLoss}% loss</span>
      </div>
      <div className="flex justify-between text-sm font-bold pt-1 border-t border-current/20">
        <span>{better ? "Less loss than set point" : "More loss than set point"}</span>
        <span>{better ? "+" : ""}{cook.deltaPts} pts</span>
      </div>
    </div>
  );
}