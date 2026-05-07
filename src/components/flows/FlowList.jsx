import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GitBranch, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";

export default function FlowList({ flows, isLoading, onEdit, onDelete }) {
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading flows...</div>;

  if (flows.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>No flows yet. Click "New Flow" to build your first production flow.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {flows.map(flow => (
        <Card key={flow.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{flow.name}</CardTitle>
                {flow.product_name && <p className="text-xs text-muted-foreground mt-0.5">{flow.product_name}</p>}
              </div>
              <div className="flex items-center gap-1">
                <StatusBadge status={flow.status} />
                <Button size="icon" variant="ghost" onClick={() => onEdit(flow)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(flow.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {flow.steps?.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {[...flow.steps].sort((a, b) => a.step_number - b.step_number).map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center">
                      <Badge variant="outline" className="text-xs">{step.capability_name}</Badge>
                      {step.work_profile_name && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">{step.work_profile_name}</span>
                      )}
                    </div>
                    {idx < flow.steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No steps configured</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}