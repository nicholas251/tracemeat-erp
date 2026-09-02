import React from "react";
import { Badge } from "@/components/ui/badge";
import Hl from "./Hl";

const TYPE_LABEL = { protein: "Protein", spice: "Spice mix", cure: "Cure", casing: "Casings" };

export default function RawLotsTable({ rawLots, hit }) {
  if (!rawLots.length) {
    return <p className="text-xs text-muted-foreground italic">No raw-material lots recorded on this order's stages.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground border-b">
          <tr className="text-left">
            <th className="py-1.5 pr-3 font-medium">Material</th>
            <th className="py-1.5 pr-3 font-medium">Lot #</th>
            <th className="py-1.5 pr-3 font-medium">Supplier</th>
            <th className="py-1.5 pr-3 font-medium">PO</th>
            <th className="py-1.5 pr-3 font-medium">Received</th>
            <th className="py-1.5 pr-3 font-medium text-right">Lbs</th>
            <th className="py-1.5 font-medium">Used at</th>
          </tr>
        </thead>
        <tbody>
          {rawLots.map((r, i) => (
            <React.Fragment key={i}>
              <tr className={`border-b last:border-0 ${r.matched ? "bg-yellow-50" : ""}`}>
                <td className="py-1.5 pr-3">
                  <span className="font-medium">{r.bucket_name || "—"}</span>
                  <Badge variant="outline" className="ml-1.5 text-[10px] h-4 px-1">{TYPE_LABEL[r.material_type] || r.material_type || "raw"}</Badge>
                </td>
                <td className="py-1.5 pr-3"><Hl on={r.matched}>{r.lot_number || "—"}</Hl></td>
                <td className="py-1.5 pr-3"><Hl on={hit(r.supplier)} className="font-sans">{r.supplier || "—"}</Hl></td>
                <td className="py-1.5 pr-3"><Hl on={hit(r.po_number)}>{r.po_number || "—"}</Hl></td>
                <td className="py-1.5 pr-3">{r.received_date || "—"}</td>
                <td className="py-1.5 pr-3 text-right font-semibold">{r.lbs.toFixed(2)}</td>
                <td className="py-1.5 capitalize">{r.stages.join(", ")}</td>
              </tr>
              {r.component_lots.map((c, ci) => (
                <tr key={`${i}-${ci}`} className={`border-b last:border-0 text-muted-foreground ${hit(c.lot_number) ? "bg-yellow-50" : ""}`}>
                  <td className="py-1 pr-3 pl-6">↳ {c.bucket_name || "Spice ingredient"}</td>
                  <td className="py-1 pr-3"><Hl on={hit(c.lot_number)}>{c.lot_number || "—"}</Hl></td>
                  <td className="py-1 pr-3" colSpan={3}>component of {r.lot_number}</td>
                  <td className="py-1 pr-3 text-right">{(c.lbs || 0).toFixed(2)}</td>
                  <td />
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}