import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Package } from "lucide-react";

const STAGE_NAMES = {
  blending: "Blending",
  chopping: "Chopping",
  linking: "Linking",
  cooking: "Cooking",
  chilling: "Chilling",
  packaging: "Packaging",
};

const STAGE_COLORS = {
  blending: "bg-blue-50 border-blue-200",
  chopping: "bg-purple-50 border-purple-200",
  linking: "bg-indigo-50 border-indigo-200",
  cooking: "bg-orange-50 border-orange-200",
  chilling: "bg-cyan-50 border-cyan-200",
  packaging: "bg-green-50 border-green-200",
};

export default function TraceabilityPath({ stages }) {
  if (!stages || stages.length === 0) return null;

  // Sort by step number
  const sortedStages = [...stages].sort((a, b) => (a.step_number || 0) - (b.step_number || 0));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lot Traceability Path</h3>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {sortedStages.map((stage, idx) => {
          const capKey = stage.capability_key || "";
          const stageName = STAGE_NAMES[capKey] || capKey;
          const colorClass = STAGE_COLORS[capKey] || "bg-gray-50 border-gray-200";
          
          // Determine which lot number to display
          let lotDisplay = "";
          if (stage.status === "completed") {
            if (capKey === "blending") {
              lotDisplay = stage.input_lot_number || "—";
            } else if (capKey === "linking") {
              lotDisplay = stage.cook_batch_lot || stage.input_lot_number || "—";
            } else {
              lotDisplay = stage.output_lot_number || stage.input_lot_number || "—";
            }
          } else {
            lotDisplay = stage.input_lot_number || "—";
          }

          return (
            <React.Fragment key={stage.id}>
              {idx > 0 && (
                <div className="flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              
              <Card className={`flex-shrink-0 ${colorClass} border`}>
                <CardContent className="p-2 text-center text-xs">
                  <div className="font-semibold text-foreground mb-1">{stageName}</div>
                  <div className="font-mono text-[10px] font-bold break-all max-w-[90px]">
                    {lotDisplay}
                  </div>
                  {stage.status === "completed" && (
                    <Badge variant="outline" className="mt-1 text-[10px] h-4 px-1">
                      ✓
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </React.Fragment>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {sortedStages
          .filter(s => s.status === "completed")
          .map(stage => {
            const capKey = stage.capability_key || "";
            const stageName = STAGE_NAMES[capKey] || capKey;
            
            let lotLabel = "Input";
            let lotValue = stage.input_lot_number;
            
            if (capKey === "blending") {
              lotLabel = "Blend Lot";
              lotValue = stage.input_lot_number;
            } else if (capKey === "linking") {
              lotLabel = "Cook Batch";
              lotValue = stage.cook_batch_lot;
            } else if (capKey === "packaging") {
              lotLabel = "FG Lot";
              lotValue = stage.output_lot_number || stage.lot_number;
            } else {
              lotLabel = "Output Lot";
              lotValue = stage.output_lot_number || stage.input_lot_number;
            }

            return (
              <div key={stage.id} className="border rounded p-2 bg-card">
                <p className="font-mono text-xs break-all font-bold text-chart-1">{lotValue || "—"}</p>
                <p className="text-[10px] text-muted-foreground">{stageName} · {lotLabel}</p>
              </div>
            );
          })}
      </div>
    </div>
  );
}