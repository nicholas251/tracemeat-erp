import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CheckCircle2, Clock, Play, Briefcase } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StageActionDialog from "@/components/production/StageActionDialog";
import BlendingWizard from "@/components/blending/BlendingWizard";

export default function StageDashboard({ user, profile, onBack, singleProfile = false }) {
  const [activeStage, setActiveStage] = useState(null);
  const queryClient = useQueryClient();

  const capKeys = profile.capability_keys || [];

  // Get ALL stages so we can cross-reference prior steps
  const { data: allStages = [] } = useQuery({
    queryKey: ["allStages"],
    queryFn: () => base44.entities.ProductionStage.list("created_date", 500),
  });

  const handleUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    queryClient.invalidateQueries({ queryKey: ["blendingStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    setActiveStage(null);
  };

  // Stages that belong to this profile's capabilities
  const myStages = allStages.filter(s => capKeys.includes(s.capability_key));

  // In Progress: stages this profile is actively working
  const inProgress = myStages.filter(s => s.status === "in_progress");

  // Available queue (FIFO): status=available, ordered by when they became available
  // We approximate FIFO order using created_date of the stage record
  const availableQueue = myStages
    .filter(s => s.status === "available")
    .sort((a, b) => {
      // Sort by when prior stage completed (stage created_date is a reasonable proxy)
      return new Date(a.created_date) - new Date(b.created_date);
    });

  // On Deck: stages where the PRIOR step (step_number - 1) is in_progress at another capability
  // These are locked stages whose predecessor is actively being worked
  const onDeck = myStages
    .filter(s => s.status === "locked")
    .filter(stage => {
      const priorStage = allStages.find(
        s => s.order_id === stage.order_id && s.step_number === stage.step_number - 1
      );
      return priorStage?.status === "in_progress";
    });

  // Completed
  const completed = myStages.filter(s => s.status === "completed");

  const dashboardTitles = {
    "chopping": "Bowl Chopper Dashboard",
    "linking": "Linking Dashboard",
    "cooking": "Smokehouse Dashboard",
    "chilling": "Chilling Dashboard",
    "packaging": "Packing Dashboard",
  };

  const title = capKeys.map(k => dashboardTitles[k]).find(Boolean) || `${profile.name} Dashboard`;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title={title}
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
            <StageJobCard key={stage.id} stage={stage} status="active" onClick={() => setActiveStage(stage)} />
          ))}
        </Section>
      )}

      {/* Available Queue (FIFO) */}
      {availableQueue.length > 0 && (
        <Section title={`Queue — ${availableQueue.length} job${availableQueue.length > 1 ? "s" : ""} (FIFO)`} color="text-chart-1">
          {availableQueue.map((stage, idx) => (
            <StageJobCard key={stage.id} stage={stage} status="ready" position={idx + 1} onClick={() => setActiveStage(stage)} />
          ))}
        </Section>
      )}

      {/* On Deck (prior step in progress — grayed out) */}
      {onDeck.length > 0 && (
        <Section title="On Deck" color="text-muted-foreground">
          <p className="text-xs text-muted-foreground mb-2">These jobs are being processed upstream. They'll appear in your queue when ready.</p>
          {onDeck.map(stage => {
            const priorStage = allStages.find(
              s => s.order_id === stage.order_id && s.step_number === stage.step_number - 1
            );
            return (
              <StageJobCard key={stage.id} stage={stage} status="incoming" priorStage={priorStage} />
            );
          })}
        </Section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <Section title="Completed" color="text-chart-2">
          {completed.map(stage => (
            <StageJobCard key={stage.id} stage={stage} status="done" onClick={() => setActiveStage(stage)} />
          ))}
        </Section>
      )}

      {inProgress.length === 0 && availableQueue.length === 0 && onDeck.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No jobs available right now. Check back soon.</p>
        </div>
      )}

      {activeStage && activeStage.capability_key === "blending" ? (
        <BlendingWizard
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onCompleted={handleUpdated}
        />
      ) : activeStage && (
        <StageActionDialog
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onUpdated={handleUpdated}
          allowedCapabilityKeys={capKeys}
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

function StageJobCard({ stage, status, position, priorStage, onClick }) {
  const isIncoming = status === "incoming";
  const isDone = status === "done";
  const borderColor = {
    active: "border-l-accent",
    ready: "border-l-chart-1",
    incoming: "border-l-muted",
    done: "border-l-chart-2",
  }[status] || "border-l-muted";

  return (
    <Card
      className={`border-l-4 ${borderColor} transition-all ${isIncoming ? "opacity-50" : isDone ? "opacity-60" : "cursor-pointer hover:shadow-md"}`}
      onClick={isIncoming || isDone ? undefined : onClick}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {position && <span className="text-xs font-bold text-chart-1 bg-chart-1/10 rounded-full w-5 h-5 flex items-center justify-center">{position}</span>}
            <p className="font-semibold">{stage.product_name}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Order #{stage.order_number} · {stage.input_qty_lbs || 0} lbs input
          </p>
          {isIncoming && priorStage && (
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3 inline mr-1" />
              Upstream: {priorStage.capability_name} in progress
            </p>
          )}
          {stage.output_qty_lbs > 0 && isDone && (
            <p className="text-xs text-muted-foreground mt-1">Output: {stage.output_qty_lbs} lbs</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 ml-4">
          {status === "active" && <Badge className="bg-accent/15 text-accent border-accent/30 border">In Progress</Badge>}
          {status === "ready" && <Badge className="bg-chart-1/15 text-chart-1 border-chart-1/30 border">Ready</Badge>}
          {status === "incoming" && <Badge variant="outline" className="text-muted-foreground">Pending</Badge>}
          {status === "done" && <CheckCircle2 className="w-5 h-5 text-chart-2" />}
          {(status === "active" || status === "ready") && <Play className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );
}