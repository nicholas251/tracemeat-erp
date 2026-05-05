import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/shared/StatusBadge";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export default function ActiveHolds({ holds }) {
  const activeHolds = holds.filter(h => h.status === "on_hold" || h.status === "under_review");

  return (
    <Card className={activeHolds.length > 0 ? "border-accent/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeHolds.length > 0 && <AlertTriangle className="w-4 h-4 text-accent" />}
            <CardTitle className="text-base font-semibold">Active Holds</CardTitle>
          </div>
          <Link to="/hold-release" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {activeHolds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No active holds — all clear</p>
        ) : (
          <div className="space-y-3">
            {activeHolds.slice(0, 5).map((hold) => (
              <div key={hold.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{hold.batch_number}</p>
                  <p className="text-xs text-muted-foreground">{hold.product_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {(hold.hold_reason || "").replace(/_/g, " ")}
                  </p>
                </div>
                <StatusBadge status={hold.status} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}