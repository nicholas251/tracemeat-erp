import React from "react";
import Hl from "./Hl";

export default function CarryOversList({ carryOvers, orderId, hit }) {
  if (!carryOvers.length) return null;
  return (
    <div className="space-y-1.5 text-xs">
      {carryOvers.map(uc => {
        const outgoing = uc.source_order_id === orderId;
        return (
          <div key={uc.id} className="border rounded px-2.5 py-1.5 bg-muted/30">
            <span className="font-semibold">{(uc.lbs || 0).toFixed(2)} lbs {uc.product_name}</span>{" "}
            {outgoing
              ? <>left over → {uc.status === "consumed" ? <>packed into <span className="font-mono">#{uc.consumed_order_number}</span></> : <span className="text-amber-700 font-medium">still open (unpacked)</span>}</>
              : <>carried in from <span className="font-mono">#{uc.source_order_number}</span></>}
            <div className="text-muted-foreground">
              Lots: {(uc.lot_contributions || []).map((c, i) => <span key={i}>{i > 0 && ", "}<Hl on={hit(c.lot_number)}>{c.lot_number}</Hl> {(c.lbs || 0).toFixed(2)}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}