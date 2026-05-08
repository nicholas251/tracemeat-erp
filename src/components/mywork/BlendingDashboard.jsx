import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Factory, CheckCircle2, Clock, Play } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StageWizard from "@/components/production/StageWizard";

export default function BlendingDashboard({ user, profile, onBack }) {
  const [activeStage, setActiveStage] = useState(null);
  const queryClient = useQueryClient();

  // Get all production orders
  const { data: orders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.filter({
      status: { $in: ["pending", "in_progress"] }
    }, "-created_date"),
  });

  // Get all blending stages
  const { data: stages = [] } = useQuery({
    queryKey: ["blendingStages"],
    queryFn: () => base44.entities.ProductionStage.filter({
      capability_key: "blending"
    }, "created_date", 200),
  });

  const handleUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["blendingStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    setActiveStage(null);
  };

  const activeOrAvailable = stages.filter(s => s.status === "in_progress" || s.status === "available");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Blending"
        subtitle={`${user?.full_name} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        actions={onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Profiles
          </Button>
        )}
      />

      {activeOrAvailable.length > 0 ? (
        <div className="space-y-2">
          {activeOrAvailable.map(stage => (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage)}
              className="w-full text-left p-3 rounded-lg border hover:shadow-sm transition-all bg-card hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{stage.product_name}</p>
                  <p className="text-xs text-muted-foreground">Order #{stage.order_number} · {stage.input_qty_lbs} lbs</p>
                </div>
                {stage.status === "in_progress" && <Badge className="bg-accent/15 text-accent border-accent/30 border text-xs">In Progress</Badge>}
                {stage.status === "available" && <Badge className="bg-chart-1/15 text-chart-1 border-chart-1/30 border text-xs">Ready</Badge>}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Factory className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No blending jobs</p>
        </div>
      )}

      {activeStage && (
        <StageWizard
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onCompleted={handleUpdated}
          allowedCapabilityKeys={profile.capability_keys}
        />
      )}
    </div>
  );
}