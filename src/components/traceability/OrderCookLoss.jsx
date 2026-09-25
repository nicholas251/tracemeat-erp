import React from "react";

// Actual cook loss for the whole order: raw weight into the ovens (cooking input)
// vs the weight actually packed (packaging output, minus carry-over pulled in from other runs).
export default function OrderCookLoss({ stages, carryOvers, orderId }) {
  const done = (key) => stages.filter(s => s.capability_key?.includes(key) && s.status === "completed");
  const rawLbs = done("cook").reduce((s, st) => s + (st.input_qty_lbs || 0), 0);
  const carryInLbs = carryOvers.filter(c => c.consumed_order_id === orderId && c.source_order_id !== orderId).reduce((s, c) => s + (c.lbs || 0), 0);
  const packedLbs = done("pack").reduce((s, st) => s + (st.output_qty_lbs || 0), 0) - carryInLbs;
  if (rawLbs <= 0) return null;

  // Reconciliation: protein into chopping + bowl additions (spice/cure/water) = raw into oven.
  const chops = done("chop");
  const proteinLbs = chops.reduce((s, st) => s + (st.input_qty_lbs || 0), 0);
  const chopOutLbs = chops.reduce((s, st) => s + (st.output_qty_lbs || 0), 0);
  const addLbs = chopOutLbs - proteinLbs;
  const gapLbs = rawLbs - chopOutLbs;

  const hasPack = packedLbs > 0;
  const lossLbs = rawLbs - packedLbs;
  const lossPct = (lossLbs / rawLbs) * 100;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2 bg-muted/50 rounded px-3 py-2">
      {chops.length > 0 && (
        <span className="w-full">
          <span className="text-muted-foreground">Protein blended:</span> <b>{proteinLbs.toFixed(2)} lbs</b>
          <span className="text-muted-foreground"> + chop additions (spice/cure/water):</span> <b>{addLbs.toFixed(2)} lbs</b>
          <span className="text-muted-foreground"> = chopped out:</span> <b>{chopOutLbs.toFixed(2)} lbs</b>
          {Math.abs(gapLbs) > 0.5 && <b className="text-red-600"> · {gapLbs > 0 ? "+" : ""}{gapLbs.toFixed(2)} lbs unaccounted before oven</b>}
        </span>
      )}
      <span><span className="text-muted-foreground">Raw into oven:</span> <b>{rawLbs.toFixed(2)} lbs</b></span>
      <span><span className="text-muted-foreground">Packed out:</span> <b>{hasPack ? `${packedLbs.toFixed(2)} lbs` : "—"}</b></span>
      <span><span className="text-muted-foreground">Actual cook loss:</span>{" "}
        <b className={hasPack ? "text-amber-700" : ""}>{hasPack ? `${lossLbs.toFixed(2)} lbs (${lossPct.toFixed(1)}%)` : "pending packing"}</b>
      </span>
    </div>
  );
}