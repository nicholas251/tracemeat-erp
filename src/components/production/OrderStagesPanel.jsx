import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2, Clock, ChevronRight, AlertCircle } from "lucide-react";
import StageWizard from "./StageWizard";

const STATUS_CONFIG = {
  locked:      { icon: Lock,         color: "text-muted-foreground",  bg: "bg-muted/30 border-dashed" },
  available:   { icon: ChevronRight, color: "text-chart-1",           bg: "bg-chart-1/10 border-chart-1/30" },
  in_progress: { icon: Clock,        color: "text-accent",            bg: "bg-accent/10 border-accent/30" },
  completed:   { icon: CheckCircle2, color: "text-chart-2",           bg: "bg-chart-2/10 border-chart-2/30" },
  on_hold:     { icon: AlertCircle,  color: "text-destructive",       bg: "bg-destructive/10 border-destructive/30" },
};

export default function OrderStagesPanel({ orderId, allowedCapabilityKeys = null }) {
  const [activeStage, setActiveStage] = useState(null);
  const queryClient = useQueryClient();

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["orderStages", orderId],
    queryFn: () => base44.entities.ProductionStage.filter({ order_id: orderId }, "step_number"),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading stages...</div>;
  if (stages.length === 0) return <div className="text-sm text-muted-foreground italic">No stages found for this order.</div>;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {stages.sort((a, b) => a.step_number - b.step_number).map((stage, idx) => {
          const cfg = STATUS_CONFIG[stage.status] || STATUS_CONFIG.locked;
          const Icon = cfg.icon;
          const clickable = stage.status !== "locked";
          return (
            <React.Fragment key={stage.id}>
              <button
                disabled={!clickable}
                onClick={() => clickable && setActiveStage(stage)}
                className={`flex flex-col p-3 rounded-lg border text-left min-w-[120px] transition-all ${cfg.bg} ${clickable ? "cursor-pointer hover:shadow-sm" : "cursor-not-allowed opacity-50"}`}
              >
                <div className={`flex items-center gap-1.5 mb-1 ${cfg.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold capitalize">{stage.status?.replace("_", " ")}</span>
                </div>
                <p className="text-sm font-medium leading-tight">{stage.capability_name}</p>
                <p className="text-xs text-muted-foreground">Step {stage.step_number}</p>
                {stage.output_qty_lbs > 0 && (
                  <p className="text-xs font-medium mt-1">{stage.output_qty_lbs} lbs</p>
                )}
                {stage.racks_count > 0 && (
                  <p className="text-xs text-muted-foreground">{stage.racks_count} racks</p>
                )}
              </button>
              {idx < stages.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {activeStage && (
        <StageWizard
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onCompleted={() => {
            queryClient.invalidateQueries({ queryKey: ["orderStages", orderId] });
            queryClient.invalidateQueries({ queryKey: ["productionStages"] });
            setActiveStage(null);
          }}
        />
      )}
    </>
  );
}