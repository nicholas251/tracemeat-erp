import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2 } from "lucide-react";

export default function ResetDataPanel() {
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleClearStages = async () => {
    setClearing(true);
    try {
      // Use the backend function — it clears stages AND smokehouse racks AND
      // carried-over partial racks in one shot.
      await base44.functions.invoke("clearAllStages", {});
      queryClient.invalidateQueries();
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
          <p className="text-xs text-muted-foreground mt-1">This will delete all production stages, smokehouse racks, and carried-over partial racks. Cannot be undone.</p>
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