import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import Hl from "./Hl";

export default function RawMatchesCard({ rawMatches, hit }) {
  if (!rawMatches.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Warehouse className="w-4 h-4" /> Matching raw-material lots</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b">
            <tr className="text-left">
              <th className="py-1.5 pr-3 font-medium">Material</th>
              <th className="py-1.5 pr-3 font-medium">Lot #</th>
              <th className="py-1.5 pr-3 font-medium">Supplier</th>
              <th className="py-1.5 pr-3 font-medium">PO</th>
              <th className="py-1.5 pr-3 font-medium">Received</th>
              <th className="py-1.5 pr-3 font-medium text-right">Received lbs</th>
              <th className="py-1.5 pr-3 font-medium text-right">Still in stock</th>
              <th className="py-1.5 pr-3 font-medium">Status</th>
              <th className="py-1.5 font-medium">Used in</th>
            </tr>
          </thead>
          <tbody>
            {rawMatches.map(r => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-1.5 pr-3 font-medium">{r.bucket_name}</td>
                <td className="py-1.5 pr-3"><Hl on={hit(r.lot_number)}>{r.lot_number}</Hl></td>
                <td className="py-1.5 pr-3"><Hl on={hit(r.supplier)} className="font-sans">{r.supplier || "—"}</Hl></td>
                <td className="py-1.5 pr-3"><Hl on={hit(r.po_number)}>{r.po_number || "—"}</Hl></td>
                <td className="py-1.5 pr-3">{r.received_date || "—"}</td>
                <td className="py-1.5 pr-3 text-right">{Number(r.quantity).toFixed(2)}</td>
                <td className="py-1.5 pr-3 text-right font-semibold">{Number(r.available_qty).toFixed(2)}</td>
                <td className="py-1.5 pr-3"><StatusBadge status={r.status} /></td>
                <td className="py-1.5">
                  {r.used_in_orders.length
                    ? r.used_in_orders.map(n => <span key={n} className="font-mono mr-1">#{n}</span>)
                    : <span className="text-muted-foreground italic">Not used in any production batch yet</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}