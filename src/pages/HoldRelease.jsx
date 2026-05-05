import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import HoldFormDialog from "@/components/holds/HoldFormDialog";
import ReleaseDialog from "@/components/holds/ReleaseDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const severityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent/15 text-accent border-accent/20",
  high: "bg-chart-4/15 text-chart-4 border-chart-4/20",
  critical: "bg-destructive/15 text-destructive border-destructive/20",
};

export default function HoldRelease() {
  const [showForm, setShowForm] = useState(false);
  const [preselectedBatch, setPreselectedBatch] = useState(null);
  const [releasing, setReleasing] = useState(null);
  const [tab, setTab] = useState("active");
  const queryClient = useQueryClient();

  // Check for URL params (from batch page redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get("batch_id");
    if (batchId) {
      setPreselectedBatch({
        id: batchId,
        batch_number: params.get("batch_number") || "",
        product_name: params.get("product_name") || "",
      });
      setShowForm(true);
      window.history.replaceState({}, "", "/hold-release");
    }
  }, []);

  const { data: holds = [], isLoading } = useQuery({
    queryKey: ["holds"],
    queryFn: () => base44.entities.HoldRelease.list("-created_date"),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: () => base44.entities.Batch.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.HoldRelease.create(data);
      // Also update batch status
      if (data.batch_id) {
        await base44.entities.Batch.update(data.batch_id, { status: "on_hold" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holds"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setShowForm(false);
      setPreselectedBatch(null);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async ({ holdId, data, batchId }) => {
      await base44.entities.HoldRelease.update(holdId, data);
      if (batchId) {
        const batchStatus = data.status === "released" ? "released" : "rejected";
        await base44.entities.Batch.update(batchId, { status: batchStatus });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holds"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setReleasing(null);
    },
  });

  const activeHolds = holds.filter(h => h.status === "on_hold" || h.status === "under_review");
  const resolvedHolds = holds.filter(h => h.status === "released" || h.status === "rejected" || h.status === "destroyed");
  const displayed = tab === "active" ? activeHolds : resolvedHolds;

  return (
    <div>
      <PageHeader 
        title="Hold & Release" 
        subtitle="Manage product holds, reviews, and release decisions"
        actions={
          <Button onClick={() => { setPreselectedBatch(null); setShowForm(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" /> New Hold
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <ShieldAlert className="w-4 h-4" /> Active ({activeHolds.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Resolved ({resolvedHolds.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card className="h-48 animate-pulse bg-muted" />
      ) : displayed.length === 0 ? (
        <Card className="p-12 text-center">
          {tab === "active" ? (
            <>
              <ShieldCheck className="w-12 h-12 text-chart-2 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">All Clear</h3>
              <p className="text-sm text-muted-foreground">No active holds at this time</p>
            </>
          ) : (
            <>
              <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No resolved holds</h3>
              <p className="text-sm text-muted-foreground">Resolved holds will appear here</p>
            </>
          )}
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map(hold => (
                  <TableRow key={hold.id}>
                    <TableCell className="font-mono text-sm font-medium">{hold.batch_number}</TableCell>
                    <TableCell className="text-sm">{hold.product_name}</TableCell>
                    <TableCell className="text-sm capitalize">{(hold.hold_reason || "").replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("capitalize text-xs border", severityColors[hold.severity] || "")}>
                        {hold.severity}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={hold.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {hold.held_date ? format(new Date(hold.held_date), "MMM d, HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      {(hold.status === "on_hold" || hold.status === "under_review") && (
                        <Button size="sm" variant="outline" onClick={() => setReleasing(hold)}>
                          Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <HoldFormDialog
          open
          batches={batches}
          preselectedBatch={preselectedBatch}
          onClose={() => { setShowForm(false); setPreselectedBatch(null); }}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}
      {releasing && (
        <ReleaseDialog
          open
          hold={releasing}
          onClose={() => setReleasing(null)}
          onRelease={(data) => releaseMutation.mutate({ holdId: releasing.id, data, batchId: releasing.batch_id })}
        />
      )}
    </div>
  );
}