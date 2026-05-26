import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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

  const { data: allStages = [] } = useQuery({
    queryKey: ["allStages"],
    queryFn: () => base44.entities.ProductionStage.list(),
    enabled: active.length > 0,
  });

  const getOrderStageInfo = (order) => {
    const stages = allStages
      .filter(s => s.order_id === order.id)
      .sort((a, b) => a.step_number - b.step_number);

    if (stages.length === 0) return { label: "Starting", completed: 0, total: 1 };

    const completed = stages.filter(s => s.status === "completed").length;
    const active = stages.find(s => s.status === "in_progress" || s.status === "available");
    const label = active?.capability_name || stages[stages.length - 1]?.capability_name || "Pending";

    return { label, completed, total: stages.length };
  };

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
            {active.map(order => {
              const { label, completed, total } = getOrderStageInfo(order);

              return (
                <div key={order.id} className="px-6 py-4 space-y-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-900">{order.product_name}</p>
                      <p className="text-xs text-slate-600">#{order.order_number} · {order.quantity_to_produce} lbs</p>
                    </div>
                    <Badge variant="outline" className={`capitalize text-xs ${STATUS_STYLES[order.status]}`}>
                      {order.status?.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Stage Progress Indicator */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Current: {label}</span>
                      <span className="text-xs text-slate-500">{completed}/{total} stages done</span>
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: total }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-full transition-colors ${
                            i < completed
                              ? "bg-green-500"
                              : i === completed
                              ? "bg-blue-500"
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}