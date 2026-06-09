import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2, CheckCircle2 } from "lucide-react";

export default function ResetDataPanel() {
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleClearStages = async () => {
    setClearing(true);
    setError(null);
    setResult(null);
    try {
      // Use the backend function — it clears stages AND smokehouse racks AND
      // carried-over partial racks in one shot.
      const res = await base44.functions.invoke("clearAllStages", {});
      const data = res?.data || {};
      if (data.error) throw new Error(data.error);
      // Force a full refetch so every list (smokehouse, my-work, etc.) reloads.
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries();
      setResult(data);
      setConfirmed(false);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to clear stages");
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

          {result && (
            <div className="flex items-center gap-2 mt-3 text-xs font-medium text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              Cleared {result.deleted ?? 0} stages, {result.deletedRacks ?? 0} racks, {result.clearedPartials ?? 0} partials.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 mt-3 text-xs font-medium text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}