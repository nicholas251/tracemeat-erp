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

      <div className="text-center py-16 text-muted-foreground">No products displayed.</div>

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