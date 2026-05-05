import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ label, value, icon: Icon, trend, color = "text-primary" }) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-2 font-medium", trend > 0 ? "text-chart-2" : "text-destructive")}>
              {trend > 0 ? "+" : ""}{trend}% from last week
            </p>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-muted", color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}