import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
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

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["rawMaterials"],
    queryFn: () => base44.entities.RawMaterial.list(),
  });

  const { data: rawInventoryLots = [] } = useQuery({
    queryKey: ["raw_inventory"],
    queryFn: () => base44.entities.RawInventory.list(),
  });

  const { data: finishedGoods = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => base44.entities.InventoryItem.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const heldQty = Number(data.quantity_affected_kg) || 0;
      if (data.batch_id) {
        if (data.item_type === "raw_material") {
          const item = rawMaterials.find(r => r.id === data.batch_id);
          const currentQty = item?.available_qty_lbs || 0;
          const newQty = Math.max(0, currentQty - heldQty);
          await base44.entities.HoldRelease.create({ ...data, pre_hold_qty: currentQty });
          await base44.entities.RawMaterial.update(data.batch_id, { available_qty_lbs: newQty });
          // Also deduct from the matching RawInventory lot
          const lot = rawInventoryLots.find(l => l.raw_material_id === data.batch_id);
          if (lot) {
            const lotQty = lot.available_qty || 0;
            await base44.entities.RawInventory.update(lot.id, { available_qty: Math.max(0, lotQty - heldQty) });
          }
        } else if (data.item_type === "finished_goods") {
          const item = finishedGoods.find(i => i.id === data.batch_id);
          const currentQty = item?.quantity_lbs || 0;
          const newQty = Math.max(0, currentQty - heldQty);
          await base44.entities.HoldRelease.create({ ...data, pre_hold_qty: currentQty });
          await base44.entities.InventoryItem.update(data.batch_id, { quantity_lbs: newQty });
        } else {
          await base44.entities.HoldRelease.create(data);
          await base44.entities.Batch.update(data.batch_id, { status: "on_hold" });
        }
      } else {
        await base44.entities.HoldRelease.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holds"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["rawMaterials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["raw_inventory"] });
      setShowForm(false);
      setPreselectedBatch(null);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async ({ holdId, data, batchId, itemType, quantityAffected, hold }) => {
      await base44.entities.HoldRelease.update(holdId, data);
      if (batchId && data.status === "released") {
        if (itemType === "raw_material") {
          const item = rawMaterials.find(r => r.id === batchId);
          const currentQty = item?.available_qty_lbs || 0;
          const releaseQty = Number(quantityAffected) || 0;
          await base44.entities.RawMaterial.update(batchId, { status: "approved", available_qty_lbs: currentQty + releaseQty });
          // Also restore the matching RawInventory lot
          const lot = rawInventoryLots.find(l => l.raw_material_id === batchId);
          if (lot) {
            const lotQty = lot.available_qty || 0;
            await base44.entities.RawInventory.update(lot.id, { available_qty: lotQty + releaseQty });
          }
        } else if (itemType === "finished_goods") {
          const item = finishedGoods.find(i => i.id === batchId);
          const currentQty = item?.quantity_lbs || 0;
          const releaseQty = Number(quantityAffected) || 0;
          await base44.entities.InventoryItem.update(batchId, { status: "available", quantity_lbs: currentQty + releaseQty });
        } else {
          await base44.entities.Batch.update(batchId, { status: "released" });
        }
      } else if (batchId && data.status === "rejected") {
        if (itemType === "batch") {
          await base44.entities.Batch.update(batchId, { status: "rejected" });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holds"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["rawMaterials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["raw_inventory"] });
      setReleasing(null);
    },
  });

  const clearResolvedMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(resolvedHolds.map(h => base44.entities.HoldRelease.delete(h.id)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holds"] }),
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
      {tab === "resolved" && resolvedHolds.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => clearResolvedMutation.mutate()}
            disabled={clearResolvedMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {clearResolvedMutation.isPending ? "Clearing..." : "Clear All Resolved"}
          </Button>
        </div>
      )}

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
                  <TableHead>Batch/Lot #</TableHead>
                   <TableHead>Item</TableHead>
                   <TableHead>Type</TableHead>
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
                    <TableCell className="text-sm capitalize text-muted-foreground">{(hold.item_type || "batch").replace(/_/g, " ")}</TableCell>
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
          rawMaterials={rawMaterials}
          finishedGoods={finishedGoods}
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
          onRelease={(data) => releaseMutation.mutate({ holdId: releasing.id, data, batchId: releasing.batch_id, itemType: releasing.item_type, quantityAffected: releasing.quantity_affected_kg, hold: releasing })}
        />
      )}
    </div>
  );
}