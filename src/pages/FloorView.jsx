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

      {stages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No active production stages.</div>
      ) : (
        <div className="space-y-6">
          {activeOrders.map((order) => {
            const orderStages = stages.filter(s => s.order_id === order.id).sort((a, b) => a.step_number - b.step_number);
            if (orderStages.length === 0) return null;

            return (
              <div key={order.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{order.order_number}</h3>
                    <p className="text-sm text-muted-foreground">{order.product_name} • {order.quantity_to_produce} lbs</p>
                  </div>
                  <Badge variant={order.status === "in_progress" ? "default" : "secondary"}>
                    {order.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {orderStages.map((stage) => {
                    const cfg = STATUS_CONFIG[stage.status] || STATUS_CONFIG.locked;
                    const Icon = cfg.icon;

                    return (
                      <Card
                        key={stage.id}
                        onClick={() => setActiveStage(stage)}
                        className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <CardTitle className="text-sm font-semibold">{stage.capability_name}</CardTitle>
                              <p className="text-xs text-muted-foreground mt-0.5">Step {stage.step_number}</p>
                            </div>
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className={`rounded px-2 py-1.5 ${cfg.bg}`}>
                            <p className="text-xs font-semibold text-foreground">{cfg.label}</p>
                          </div>

                          {stage.assigned_user_name && (
                            <div className="text-xs">
                              <p className="text-muted-foreground">Assigned to</p>
                              <p className="font-medium">{stage.assigned_user_name}</p>
                            </div>
                          )}

                          {stage.input_qty_lbs && (
                            <div className="text-xs">
                              <p className="text-muted-foreground">Input</p>
                              <p className="font-medium">{stage.input_qty_lbs} lbs</p>
                            </div>
                          )}

                          {stage.output_qty_lbs && (
                            <div className="text-xs">
                              <p className="text-muted-foreground">Output</p>
                              <p className="font-medium">{stage.output_qty_lbs} lbs</p>
                            </div>
                          )}

                          {stage.input_lot_number && (
                            <div className="text-xs">
                              <p className="text-muted-foreground">Lot #</p>
                              <p className="font-mono text-xs">{stage.input_lot_number}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
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