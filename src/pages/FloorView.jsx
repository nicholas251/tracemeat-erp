import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2, Clock, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StageActionDialog from "@/components/production/StageActionDialog";

const STATUS_CONFIG = {
  locked:      { label: "Locked",      icon: Lock,         color: "text-muted-foreground", bg: "bg-muted/40" },
  available:   { label: "Available",   icon: ChevronRight, color: "text-chart-1",           bg: "bg-chart-1/10" },
  in_progress: { label: "In Progress", icon: Clock,        color: "text-accent",            bg: "bg-accent/10" },
  completed:   { label: "Completed",   icon: CheckCircle2, color: "text-chart-2",           bg: "bg-chart-2/10" },
  on_hold:     { label: "On Hold",     icon: AlertCircle,  color: "text-destructive",       bg: "bg-destructive/10" },
};

export default function FloorView() {
  const [activeStage, setActiveStage] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["activeOrders"],
    queryFn: () => base44.entities.ProductionOrder.filter({ status: { $in: ["pending", "in_progress"] } }, "-created_date"),
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["productionStages"],
    queryFn: () => base44.entities.ProductionStage.list("-created_date", 200),
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.ProductionStage.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["productionStages"] });
    });
    return unsub;
  }, [queryClient]);

  const activeOrders = orders.filter(o => o.status === "pending" || o.status === "in_progress");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Floor View"
        subtitle="Real-time production stage tracking across all active orders"
        actions={
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        }
      />

      {activeOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No active production orders.</div>
      ) : (
        <div className="space-y-6">
          {activeOrders.map(order => {
            const orderStages = stages
              .filter(s => s.order_id === order.id)
              .sort((a, b) => a.step_number - b.step_number);

            return (
              <Card key={order.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{order.product_name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Order #{order.order_number} · {order.quantity_to_produce} lbs</p>
                    </div>
                    <Badge variant="outline" className="capitalize">{order.status?.replace("_", " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {orderStages.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No stages created yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {orderStages.map((stage, idx) => {
                        const cfg = STATUS_CONFIG[stage.status] || STATUS_CONFIG.locked;
                        const Icon = cfg.icon;
                        return (
                          <React.Fragment key={stage.id}>
                            <button
                              onClick={() => stage.status !== "locked" && setActiveStage(stage)}
                              className={`flex flex-col items-start p-3 rounded-lg border text-left min-w-[130px] transition-all ${cfg.bg} ${stage.status !== "locked" ? "cursor-pointer hover:shadow-md" : "opacity-60 cursor-not-allowed"}`}
                            >
                              <div className={`flex items-center gap-1.5 mb-1 ${cfg.color}`}>
                                <Icon className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">{cfg.label}</span>
                              </div>
                              <p className="text-sm font-medium">{stage.capability_name}</p>
                              <p className="text-xs text-muted-foreground">Step {stage.step_number}</p>
                              {stage.assigned_user_name && (
                                <p className="text-xs text-muted-foreground mt-1">👤 {stage.assigned_user_name}</p>
                              )}
                              {stage.output_qty_lbs > 0 && (
                                <p className="text-xs font-medium mt-1">{stage.output_qty_lbs} lbs out</p>
                              )}
                            </button>
                            {idx < orderStages.length - 1 && (
                              <div className="flex items-center text-muted-foreground self-center">
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeStage && (
        <StageActionDialog
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["productionStages"] });
            queryClient.invalidateQueries({ queryKey: ["activeOrders"] });
            setActiveStage(null);
          }}
        />
      )}
    </div>
  );
}