import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, Package, Truck, Users, ShieldAlert, Warehouse } from "lucide-react";

export default function RecallSummary({ summary }) {
  const tiles = [
    { icon: Factory, label: "Affected orders", value: summary.orders },
    { icon: Package, label: "Products", value: summary.products.length, sub: summary.products.slice(0, 3).join(", ") + (summary.products.length > 3 ? "…" : "") },
    { icon: Warehouse, label: "FG on hand", value: `${summary.onHandLbs} lbs`, sub: `${summary.fgLots} lot${summary.fgLots === 1 ? "" : "s"}` },
    { icon: Truck, label: "Shipped", value: `${summary.shippedLbs} lbs` },
    { icon: Users, label: "Customers reached", value: summary.customers.length, sub: summary.customers.slice(0, 3).join(", ") + (summary.customers.length > 3 ? "…" : "") },
    { icon: ShieldAlert, label: "Active holds", value: summary.activeHolds, warn: summary.activeHolds > 0 },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map(t => (
        <Card key={t.label} className={t.warn ? "border-red-300 bg-red-50" : ""}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </div>
            <p className="text-xl font-bold mt-1 leading-tight">{t.value}</p>
            {t.sub && <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={t.sub}>{t.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}