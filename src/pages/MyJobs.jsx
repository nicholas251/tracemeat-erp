import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, ChevronRight, Briefcase } from "lucide-react";
import StageActionDialog from "@/components/production/StageActionDialog";

export default function MyJobs() {
  const [user, setUser] = useState(null);
  const [activeStage, setActiveStage] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ["myWorkProfile", user?.id],
    queryFn: () => base44.entities.WorkProfile.filter({ status: "active" }),
    enabled: !!user,
  });

  const myProfile = profiles.find(p => (p.assigned_user_ids || []).includes(user?.id));

  const { data: stages = [] } = useQuery({
    queryKey: ["myStages", myProfile?.id],
    queryFn: () => base44.entities.ProductionStage.filter({
      status: { $in: ["available", "in_progress"] }
    }, "step_number", 100),
    enabled: !!myProfile,
  });

  const myStages = myProfile
    ? stages.filter(s => (myProfile.capability_keys || []).includes(s.capability_key))
    : [];

  // Real-time
  useEffect(() => {
    const unsub = base44.entities.ProductionStage.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["myStages"] });
    });
    return unsub;
  }, [queryClient]);

  const inProgress = myStages.filter(s => s.status === "in_progress");
  const available = myStages.filter(s => s.status === "available");

  if (!user) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  if (!myProfile) return (
    <div className="p-8 text-center text-muted-foreground">
      <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No work profile assigned</p>
      <p className="text-sm mt-1">Contact your admin to be assigned to a work profile.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Jobs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {myProfile.name} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {inProgress.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wide mb-3">In Progress</h2>
          <div className="space-y-3">
            {inProgress.map(stage => (
              <StageJobCard key={stage.id} stage={stage} onClick={() => setActiveStage(stage)} />
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-chart-1 uppercase tracking-wide mb-3">Available Now</h2>
          <div className="space-y-3">
            {available.map(stage => (
              <StageJobCard key={stage.id} stage={stage} onClick={() => setActiveStage(stage)} />
            ))}
          </div>
        </div>
      )}

      {myStages.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No jobs available right now. Check back soon.</p>
        </div>
      )}

      {activeStage && (
        <StageActionDialog
          stage={activeStage}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["myStages"] });
            setActiveStage(null);
          }}
        />
      )}
    </div>
  );
}

function StageJobCard({ stage, onClick }) {
  const isInProgress = stage.status === "in_progress";
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${isInProgress ? "border-l-accent" : "border-l-chart-1"}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{stage.capability_name}</p>
            <p className="text-sm text-muted-foreground">{stage.product_name} · Order #{stage.order_number}</p>
            {stage.input_qty_lbs > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Input: {stage.input_qty_lbs} lbs</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={isInProgress ? "text-accent border-accent/30" : "text-chart-1 border-chart-1/30"}>
              {isInProgress ? "In Progress" : "Ready"}
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}