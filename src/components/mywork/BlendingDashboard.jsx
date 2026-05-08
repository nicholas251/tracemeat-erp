import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Factory, CheckCircle2, Clock, Play } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import BlendingWizard from "@/components/blending/BlendingWizard";

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

  const inProgress = stages.filter(s => s.status === "in_progress");
  const available = stages.filter(s => s.status === "available");
  const completed = stages.filter(s => s.status === "completed");

  const getOrderForStage = (stage) => orders.find(o => o.id === stage.order_id);

  const handleUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["blendingStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    setActiveStage(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Blending Dashboard"
        subtitle={`${user?.full_name} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        actions={onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Profiles
          </Button>
        )}
      />

      {/* In Progress */}
      {inProgress.length > 0 && (
        <Section title="In Progress" color="text-accent">
          {inProgress.map(stage => (
            <OrderStageCard
              key={stage.id}
              stage={stage}
              order={getOrderForStage(stage)}
              status="active"
              onClick={() => setActiveStage(stage)}
            />
          ))}
        </Section>
      )}

      {/* Available / Ready to Start */}
      {available.length > 0 && (
        <Section title="Ready to Start" color="text-chart-1">
          {available.map(stage => (
            <OrderStageCard
              key={stage.id}
              stage={stage}
              order={getOrderForStage(stage)}
              status="ready"
              onClick={() => setActiveStage(stage)}
            />
          ))}
        </Section>
      )}

      {/* Completed today */}
      {completed.length > 0 && (
        <Section title="Completed" color="text-chart-2">
          {completed.map(stage => (
            <OrderStageCard
              key={stage.id}
              stage={stage}
              order={getOrderForStage(stage)}
              status="done"
              onClick={() => setActiveStage(stage)}
            />
          ))}
        </Section>
      )}

      {inProgress.length === 0 && available.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Factory className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No blending jobs right now</p>
          <p className="text-sm mt-1">New production orders will appear here when created.</p>
        </div>
      )}

      {activeStage && (
        <BlendingWizard
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onCompleted={handleUpdated}
        />
      )}
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div className="mb-8">
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${color}`}>{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function OrderStageCard({ stage, order, status, onClick }) {
  const borderColor = status === "active" ? "border-l-accent" : status === "ready" ? "border-l-chart-1" : "border-l-chart-2";
  const disabled = status === "done";

  return (
    <Card
      className={`border-l-4 ${borderColor} ${disabled ? "opacity-60" : "cursor-pointer hover:shadow-md"} transition-all`}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">{stage.product_name}</p>
          <p className="text-sm text-muted-foreground">
            Order #{stage.order_number} · {stage.input_qty_lbs || order?.quantity_to_produce || 0} lbs
          </p>
          {order?.target_completion_date && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Due: {new Date(order.target_completion_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {status === "active" && <Badge className="bg-accent/15 text-accent border-accent/30 border">In Progress</Badge>}
          {status === "ready" && <Badge className="bg-chart-1/15 text-chart-1 border-chart-1/30 border">Ready</Badge>}
          {status === "done" && <CheckCircle2 className="w-5 h-5 text-chart-2" />}
          {!disabled && <Play className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );
}