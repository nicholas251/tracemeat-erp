import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Briefcase } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StageWizard from "@/components/production/StageWizard";
import SousVidePackWizard from "@/components/production/SousVidePackWizard";
import TumbleWizard from "@/components/production/TumbleWizard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CarryOverToPack from "@/components/dashboard/CarryOverToPack";

export default function StageDashboard({ user, profile, onBack, singleProfile = false }) {
  const [activeStage, setActiveStage] = useState(null);
  const queryClient = useQueryClient();

  const capKeys = profile.capability_keys || [];

  const { data: allStages = [] } = useQuery({
    queryKey: ["allStages"],
    queryFn: () => base44.entities.ProductionStage.list("created_date", 500),
  });

  // Count of released racks per product so smokehouse cards show how many are waiting.
  const { data: releasedRacks = [] } = useQuery({
    queryKey: ["releasedRacks"],
    queryFn: () => base44.entities.RackUnit.filter({ status: "released" }, "released_at", 500),
    enabled: capKeys.includes("cooking"),
  });
  const releasedByProduct = React.useMemo(() => {
    const map = {};
    for (const r of releasedRacks) {
      map[r.product_name] = (map[r.product_name] || 0) + 1;
    }
    return map;
  }, [releasedRacks]);

  const handleUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["allStages"] });
    queryClient.invalidateQueries({ queryKey: ["blendingStages"] });
    queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    setActiveStage(null);
  };

  // When activeStage is open, lock the stage prop so allStages refetches don't replace it
  const lockedActiveStage = React.useRef(null);
  if (activeStage && lockedActiveStage.current?.id !== activeStage.id) {
    lockedActiveStage.current = activeStage;
  }
  if (!activeStage) lockedActiveStage.current = null;

  // Only show stages assigned to this work profile that are available or in-progress
  // Completed stages are locked and not editable
  // If profile has cooking capability, also show chilling (auto-created from cooking)
  const showChilling = capKeys.includes("cooking");
  // Tumbling and racking always belong to the same operator, so a tumble operator
  // should also see the racking stage that gets auto-created after tumbling completes.
  const showRacking = capKeys.includes("tumble") || capKeys.includes("tumbling");
  const myStages = allStages.filter(s => {
    const isAssigned =
      capKeys.includes(s.capability_key) ||
      (showChilling && s.capability_key === "chilling") ||
      (showRacking && (s.capability_key === "racking" || s.capability_key === "racking_product"));
    return isAssigned && (s.status === "in_progress" || s.status === "available");
  });

  // Group stages by capability. Within each group, sort largest batch first so
  // the smallest (e.g. a 20 lb remainder) is always made last.
  const byLbsDesc = (a, b) => (b.input_qty_lbs || 0) - (a.input_qty_lbs || 0);
  const cookingStages = myStages.filter(s => s.capability_key === "cooking").sort(byLbsDesc);
  const chillingStages = myStages.filter(s => s.capability_key === "chilling").sort(byLbsDesc);
  const otherStages = myStages.filter(s => s.capability_key !== "cooking" && s.capability_key !== "chilling").sort(byLbsDesc);
  const sortedStages = [...cookingStages, ...otherStages, ...chillingStages];

  const title = profile.name;
  const showCarryOverTab = capKeys.includes("packaging");

  const jobsContent = (
    <>
      {myStages.length > 0 ? (
        <div className="space-y-2">
           {sortedStages.map(stage => {
            const bgClass = stage.capability_key === "cooking" 
              ? "bg-red-50 hover:bg-red-100 border-red-200" 
              : stage.capability_key === "chilling" 
              ? "bg-blue-50 hover:bg-blue-100 border-blue-200" 
              : stage.capability_key === "racking" 
              ? "bg-amber-50 hover:bg-amber-100 border-amber-200" 
              : "bg-card hover:bg-muted/50";

            return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage)}
              className={`w-full text-left p-3 rounded-lg border hover:shadow-sm transition-all ${bgClass}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{stage.product_name}</p>
                  {stage.capability_key === "cooking" ? (
                    <p className="text-xs text-muted-foreground">
                      Order #{stage.order_number} · {releasedByProduct[stage.product_name] || 0} rack(s) released
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Order #{stage.order_number} · {stage.input_qty_lbs} lbs
                      {/* Show the batch tag (…-B<n>) so multiple same-product racking cards
                          (e.g. B1/B2/B3 from a tumbled-portions order) are distinguishable —
                          otherwise a finished batch looks identical to its still-open siblings. */}
                      {(() => {
                        const m = (stage.input_lot_number || "").match(/-B(\d+)$/);
                        return m ? ` · Batch ${m[1]}` : "";
                      })()}
                    </p>
                  )}
                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{(stage.capability_name || stage.capability_key || "").replace(/_/g, " ")}</span>
                </div>
                {stage.status === "in_progress" && <Badge className="bg-accent/15 text-accent border-accent/30 border text-xs">In Progress</Badge>}
                {stage.status === "available" && <Badge className="bg-chart-1/15 text-chart-1 border-chart-1/30 border text-xs">Ready</Badge>}
                </div>
                </button>
                );
                })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No jobs assigned</p>
        </div>
      )}
    </>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={title}
        subtitle={`${user?.full_name} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        actions={onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Profiles
          </Button>
        )}
      />

      {showCarryOverTab ? (
        <Tabs defaultValue="jobs">
          <TabsList className="mb-4">
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="carryover">Carry-Over to Pack</TabsTrigger>
          </TabsList>
          <TabsContent value="jobs">{jobsContent}</TabsContent>
          <TabsContent value="carryover"><CarryOverToPack /></TabsContent>
        </Tabs>
      ) : (
        jobsContent
      )}

      {activeStage && activeStage.capability_key === "sous_vide_pack" && (
        <SousVidePackWizard
          key={lockedActiveStage.current?.id}
          stage={lockedActiveStage.current}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onCompleted={handleUpdated}
        />
      )}

      {activeStage && (activeStage.capability_key === "tumble" || activeStage.capability_key === "tumbling") && (
        <TumbleWizard
          key={lockedActiveStage.current?.id}
          stage={lockedActiveStage.current}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onCompleted={handleUpdated}
        />
      )}

      {activeStage && activeStage.capability_key !== "sous_vide_pack" && activeStage.capability_key !== "tumble" && activeStage.capability_key !== "tumbling" && (
        <StageWizard
          stage={lockedActiveStage.current}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onCompleted={handleUpdated}
        />
      )}
    </div>
  );
}