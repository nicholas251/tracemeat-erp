import React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Boxes, Trash2 } from "lucide-react";

// Dashboard tab: open unfinished-case carry-overs waiting to be packed later, grouped by
// product. Read-only overview — operators pull these back in at the packing stage.
// Admins can delete carry-over items that are no longer needed.
export default function CarryOverToPack({ isAdmin = false }) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = React.useState(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UnfinishedCase.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCarryOvers"] });
      setDeletingId(null);
    },
  });

  const { data: carryOvers = [], isLoading } = useQuery({
    queryKey: ["allCarryOvers"],
    queryFn: () => base44.entities.UnfinishedCase.filter({ status: "open" }, "-created_date", 200),
    // Always pull fresh on mount so a carry-over consumed by a packing run drops off
    // the list instead of lingering from a stale cache.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  // Live-update: when any UnfinishedCase is created/updated/deleted (e.g. consumed by a
  // packing run), refetch so the list reflects it without a manual page refresh.
  React.useEffect(() => {
    const unsubscribe = base44.entities.UnfinishedCase.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["allCarryOvers"] });
    });
    return unsubscribe;
  }, [queryClient]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">Loading carry-overs…</p>;
  }

  if (carryOvers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Boxes className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No carry-over product waiting to be packed.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by product
  const groups = {};
  for (const c of carryOvers) {
    const key = c.product_id || c.product_name;
    if (!groups[key]) groups[key] = { product_name: c.product_name, sku: c.sku, items: [], totalLbs: 0 };
    groups[key].items.push(c);
    groups[key].totalLbs += c.lbs || 0;
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([key, g]) => (
        <Card key={key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-600" /> {g.product_name}
                {g.sku && <span className="text-xs text-muted-foreground font-normal">{g.sku}</span>}
              </span>
              <Badge variant="secondary">{g.totalLbs.toFixed(2)} lbs total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {g.items.map(c => (
              <div key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold">{(c.lbs || 0).toFixed(2)} lbs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">from #{c.source_order_number || "—"}</span>
                    {isAdmin && (
                      <AlertDialog open={deletingId === c.id} onOpenChange={(open) => setDeletingId(open ? c.id : null)}>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle>Delete Carry-Over</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete this {(c.lbs || 0).toFixed(2)} lbs carry-over of {g.product_name} from #{c.source_order_number || "—"}? This cannot be undone.
                          </AlertDialogDescription>
                          <div className="flex gap-2 justify-end">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(c.id)}>
                              {deleteMutation.isPending ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(c.lot_contributions || []).length
                    ? c.lot_contributions.map(l => `${l.lot_number} (${(l.lbs || 0).toFixed(2)} lbs)`).join(", ")
                    : "No lot detail"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Produced {c.production_date || "—"}{c.expiry_date ? ` · expires ${c.expiry_date}` : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}