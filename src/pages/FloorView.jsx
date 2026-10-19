import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StageActionDialog from "@/components/production/StageActionDialog";
import FloorStageColumn from "@/components/floor/FloorStageColumn";
import { useEntitySync } from "@/hooks/useEntitySync";

export default function FloorView() {
  const [activeStage, setActiveStage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);
  const isAdmin = currentUser?.role === "admin";

  // Every live card on the floor, across all orders.
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["floorStages"],
    queryFn: () => base44.entities.ProductionStage.filter(
      { status: { $in: ["available", "in_progress", "on_hold"] } }, "step_number", 500
    ),
  });
  useEntitySync(["ProductionStage", "ProductionOrder"]);

  // Group by stage type, ordered by flow step.
  const groups = {};
  stages.forEach(s => {
    const key = s.capability_key || "other";
    if (!groups[key]) groups[key] = { name: s.capability_name || key, step: s.step_number ?? 99, items: [] };
    groups[key].step = Math.min(groups[key].step, s.step_number ?? 99);
    groups[key].items.push(s);
  });
  const columns = Object.entries(groups).sort((a, b) => a[1].step - b[1].step);
  const totalLbs = stages.reduce((s, st) => s + (st.output_qty_lbs || st.input_qty_lbs || 0), 0);

  return (
    <div className="p-6 max-w-full">
      <PageHeader
        title="Floor View"
        subtitle={`${stages.length} active cards · ${stages.filter(s => s.status === "in_progress").length} running · ${totalLbs.toFixed(0)} lbs on the floor`}
        actions={
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["floorStages"] })} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading floor…</div>
      ) : columns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nothing is on the floor right now.</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(([key, g]) => (
            <FloorStageColumn key={key} name={g.name} stages={g.items} onSelect={isAdmin ? setActiveStage : null} />
          ))}
        </div>
      )}

      {activeStage && (
        <StageActionDialog
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["floorStages"] });
            setActiveStage(null);
          }}
        />
      )}
    </div>
  );
}