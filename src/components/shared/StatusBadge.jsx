import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  // Batch statuses
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-chart-1/15 text-chart-1 border-chart-1/20",
  completed: "bg-chart-2/15 text-chart-2 border-chart-2/20",
  on_hold: "bg-accent/15 text-accent border-accent/20",
  released: "bg-chart-2/15 text-chart-2 border-chart-2/20",
  rejected: "bg-destructive/15 text-destructive border-destructive/20",
  destroyed: "bg-destructive/15 text-destructive border-destructive/20",
  under_review: "bg-chart-5/15 text-chart-5 border-chart-5/20",
  // Product statuses
  draft: "bg-muted text-muted-foreground",
  active: "bg-chart-2/15 text-chart-2 border-chart-2/20",
  discontinued: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
  // Raw material
  received: "bg-chart-1/15 text-chart-1 border-chart-1/20",
  inspected: "bg-chart-5/15 text-chart-5 border-chart-5/20",
  approved: "bg-chart-2/15 text-chart-2 border-chart-2/20",
  in_use: "bg-chart-3/15 text-chart-3 border-chart-3/20",
  depleted: "bg-muted text-muted-foreground",
};

export default function StatusBadge({ status }) {
  const label = (status || "unknown").replace(/_/g, " ");
  return (
    <Badge variant="outline" className={cn("capitalize font-medium text-xs border", statusStyles[status] || "bg-muted text-muted-foreground")}>
      {label}
    </Badge>
  );
}