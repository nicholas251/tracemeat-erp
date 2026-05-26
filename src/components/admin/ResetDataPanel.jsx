import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2 } from "lucide-react";

export default function ResetDataPanel() {
  const [clearing, setClearing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleClearStages = async () => {
    setClearing(true);
    try {
      const stages = await base44.entities.ProductionStage.list(undefined, 1000);
      for (const stage of stages) {
        await base44.entities.ProductionStage.delete(stage.id);
      }
      setConfirmed(false);
    } catch (error) {
      console.error("Error clearing stages:", error);
    }
    setClearing(false);
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Reset All Production Stages</p>
          <p className="text-xs text-muted-foreground mt-1">This will delete all ProductionStage records. Cannot be undone.</p>
          {confirmed ? (
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="destructive" onClick={handleClearStages} disabled={clearing}>
                <Trash2 className="w-4 h-4" />
                {clearing ? "Clearing..." : "Confirm Delete"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmed(false)} disabled={clearing}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirmed(true)} className="mt-3">
              Clear All Stages
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}