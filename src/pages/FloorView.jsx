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
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === "admin";

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
        <div className="space-y-2">
          {activeOrders.map((order) => {
            const orderStages = stages.filter(s => s.order_id === order.id).sort((a, b) => a.step_number - b.step_number);
            if (orderStages.length === 0) return null;

            // Find the first in_progress or available stage
            const currentStage = orderStages.find(s => s.status === "in_progress" || s.status === "available") || orderStages[0];
            if (!currentStage) return null;

            const cfg = STATUS_CONFIG[currentStage.status] || STATUS_CONFIG.locked;
            const Icon = cfg.icon;

            return (
              <Card
                key={order.id}
                onClick={() => isAdmin && setActiveStage(currentStage)}
                className={isAdmin ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""}
              >
                <CardContent className="p-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground truncate">{currentStage.capability_name}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className={`rounded px-2 py-1 ${cfg.bg}`}>
                      <p className="text-xs font-semibold text-foreground">{cfg.label}</p>
                    </div>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
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