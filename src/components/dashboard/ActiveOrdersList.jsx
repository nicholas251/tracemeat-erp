import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_STYLES = {
  pending:     "bg-muted text-muted-foreground",
  in_progress: "bg-chart-1/15 text-chart-1",
  completed:   "bg-chart-2/15 text-chart-2",
  paused:      "bg-accent/15 text-accent",
  cancelled:   "bg-destructive/15 text-destructive",
};

export default function ActiveOrdersList({ orders }) {
  const active = orders
    .filter(o => o.status === "pending" || o.status === "in_progress")
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Factory className="w-4 h-4 text-chart-1" />
          Active Production Orders
        </CardTitle>
        <Link to="/production-orders" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {active.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground text-sm">
            No active production orders.
          </div>
        ) : (
          <div className="divide-y">
            {active.map(order => (
              <div key={order.id} className="px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-sm">{order.product_name}</p>
                  <p className="text-xs text-muted-foreground">#{order.order_number} · {order.quantity_to_produce} lbs</p>
                </div>
                <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[order.status]}`}>
                  {order.status?.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}