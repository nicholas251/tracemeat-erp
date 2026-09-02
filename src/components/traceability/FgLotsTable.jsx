import React from "react";
import StatusBadge from "@/components/shared/StatusBadge";
import Hl from "./Hl";

export default function FgLotsTable({ fgLots, hit }) {
  if (!fgLots.length) return <p className="text-xs text-muted-foreground italic">No finished-goods lots recorded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground border-b">
          <tr className="text-left">
            <th className="py-1.5 pr-3 font-medium">FG Lot #</th>
            <th className="py-1.5 pr-3 font-medium">Product</th>
            <th className="py-1.5 pr-3 font-medium">Contains</th>
            <th className="py-1.5 pr-3 font-medium text-right">Produced</th>
            <th className="py-1.5 pr-3 font-medium text-right">On hand</th>
            <th className="py-1.5 pr-3 font-medium">Expires</th>
            <th className="py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {fgLots.map(f => (
            <tr key={f.id} className={`border-b last:border-0 ${f.matched ? "bg-yellow-50" : ""}`}>
              <td className="py-1.5 pr-3"><Hl on={hit(f.lot_number)}>{f.lot_number}</Hl></td>
              <td className="py-1.5 pr-3">{f.product_name}{f.sku && <span className="text-muted-foreground"> · {f.sku}</span>}</td>
              <td className="py-1.5 pr-3 text-muted-foreground">
                {f.component_lots.length
                  ? f.component_lots.map((c, i) => <span key={i}>{i > 0 && ", "}<Hl on={hit(c.lot_number)}>{c.lot_number}</Hl>{c.source === "carry_over" ? " (carry-over)" : ""}</span>)
                  : (f.cook_batch_lot ? <Hl on={hit(f.cook_batch_lot)}>{f.cook_batch_lot}</Hl> : "—")}
              </td>
              <td className="py-1.5 pr-3 text-right">{(f.original_lbs || 0).toFixed(2)}</td>
              <td className="py-1.5 pr-3 text-right font-semibold">{(f.on_hand_lbs || 0).toFixed(2)}</td>
              <td className="py-1.5 pr-3">{f.expiry_date || "—"}</td>
              <td className="py-1.5"><StatusBadge status={f.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}