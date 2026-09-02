import React from "react";
import Hl from "./Hl";

export default function RacksList({ racks, hit }) {
  if (!racks.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {racks.map(r => {
        const contribs = r.lot_contributions?.length ? r.lot_contributions : [{ lot_number: r.lot_number, lbs: r.lbs }];
        const matched = contribs.some(c => hit(c.lot_number)) || hit(r.cook_batch_lot);
        return (
          <div key={r.id} className={`border rounded px-2 py-1 text-[11px] ${matched ? "border-yellow-400 bg-yellow-50" : "bg-muted/30"}`}>
            <div className="font-semibold">Rack #{r.rack_number} · {(r.lbs || 0).toFixed(2)} lbs · <span className="capitalize">{r.status}</span></div>
            <div className="text-muted-foreground">
              {contribs.map((c, i) => <span key={i}>{i > 0 && " + "}<Hl on={hit(c.lot_number)}>{c.lot_number}</Hl> {(c.lbs || 0).toFixed(2)}</span>)}
              {r.cook_batch_lot && <> → <Hl on={hit(r.cook_batch_lot)}>{r.cook_batch_lot}</Hl></>}
            </div>
          </div>
        );
      })}
    </div>
  );
}