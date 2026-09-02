import React from "react";
import StatusBadge from "@/components/shared/StatusBadge";
import Hl from "./Hl";
import { format } from "date-fns";

export default function ShipmentsTable({ shipments, hit }) {
  if (!shipments.length) return <p className="text-xs text-muted-foreground italic">Nothing from this order has shipped.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground border-b">
          <tr className="text-left">
            <th className="py-1.5 pr-3 font-medium">Customer</th>
            <th className="py-1.5 pr-3 font-medium">Sales order</th>
            <th className="py-1.5 pr-3 font-medium">Shipped</th>
            <th className="py-1.5 pr-3 font-medium">Product</th>
            <th className="py-1.5 pr-3 font-medium">FG Lot #</th>
            <th className="py-1.5 pr-3 font-medium text-right">Lbs</th>
            <th className="py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s, i) => (
            <tr key={i} className={`border-b last:border-0 ${s.matched ? "bg-yellow-50" : ""}`}>
              <td className="py-1.5 pr-3 font-medium"><Hl on={hit(s.customer_name)} className="font-sans">{s.customer_name || "—"}</Hl></td>
              <td className="py-1.5 pr-3"><Hl on={hit(s.order_number)}>{s.order_number || "—"}</Hl></td>
              <td className="py-1.5 pr-3">{s.ship_date ? format(new Date(s.ship_date), "MMM d, yyyy") : "—"}</td>
              <td className="py-1.5 pr-3">{s.product_name}</td>
              <td className="py-1.5 pr-3"><Hl on={hit(s.lot_number)}>{s.lot_number || "—"}</Hl></td>
              <td className="py-1.5 pr-3 text-right font-semibold">{(s.lbs || 0).toFixed(2)}</td>
              <td className="py-1.5"><StatusBadge status={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}