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
  low: "bg-blue-50 text-blue-700 border-blue-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

const typeColors = {
  batch: "bg-purple-100 text-purple-700",
  production_order: "bg-indigo-100 text-indigo-700",
  raw_material: "bg-cyan-100 text-cyan-700",
  finished_goods: "bg-green-100 text-green-700",
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

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list(),
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
          // Fetch fresh to get true current qty
          const freshItems = await base44.entities.RawMaterial.filter({ id: data.batch_id });
          const currentQty = freshItems[0]?.available_qty_lbs || 0;
          if (heldQty > currentQty) throw new Error(`Cannot hold more than ${currentQty} lbs available`);
          await base44.entities.HoldRelease.create({ ...data, pre_hold_qty: currentQty });
          await base44.entities.RawMaterial.update(data.batch_id, { available_qty_lbs: currentQty - heldQty });
          // Also deduct from the matching RawInventory lot
          const freshLots = await base44.entities.RawInventory.filter({ raw_material_id: data.batch_id });
          if (freshLots[0]) {
            const lotQty = freshLots[0].available_qty || 0;
            await base44.entities.RawInventory.update(freshLots[0].id, { available_qty: Math.max(0, lotQty - heldQty) });
          }
        } else if (data.item_type === "finished_goods") {
          const freshItems = await base44.entities.InventoryItem.filter({ id: data.batch_id });
          const currentQty = freshItems[0]?.quantity_lbs || 0;
          if (heldQty > currentQty) throw new Error(`Cannot hold more than ${currentQty} lbs available`);
          await base44.entities.HoldRelease.create({ ...data, pre_hold_qty: currentQty });
          await base44.entities.InventoryItem.update(data.batch_id, { quantity_lbs: currentQty - heldQty });
        } else if (data.item_type === "production_order") {
          await base44.entities.HoldRelease.create(data);
          await base44.entities.ProductionOrder.update(data.batch_id, { status: "paused" });
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
       queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
       queryClient.invalidateQueries({ queryKey: ["rawMaterials"] });
       queryClient.invalidateQueries({ queryKey: ["inventory"] });
       queryClient.invalidateQueries({ queryKey: ["raw_inventory"] });
       setShowForm(false);
       setPreselectedBatch(null);
     },
  });

  const releaseMutation = useMutation({
    mutationFn: async ({ holdId, data, batchId, itemType, quantityAffected }) => {
      await base44.entities.HoldRelease.update(holdId, data);
      const releaseQty = Number(quantityAffected) || 0;
      if (batchId && data.status === "released") {
        // Determine item type if missing
        let resolvedItemType = itemType;
        if (!resolvedItemType) {
          const batch = await base44.entities.Batch.filter({ id: batchId });
          const prodOrder = await base44.entities.ProductionOrder.filter({ id: batchId });
          const rawMat = await base44.entities.RawMaterial.filter({ id: batchId });
          const invItem = await base44.entities.InventoryItem.filter({ id: batchId });

          if (batch[0]) resolvedItemType = "batch";
          else if (prodOrder[0]) resolvedItemType = "production_order";
          else if (rawMat[0]) resolvedItemType = "raw_material";
          else if (invItem[0]) resolvedItemType = "finished_goods";
        }

        if (resolvedItemType === "raw_material") {
          // Fetch fresh to avoid stale cache values
          const freshItems = await base44.entities.RawMaterial.filter({ id: batchId });
          const currentQty = freshItems[0]?.available_qty_lbs || 0;
          await base44.entities.RawMaterial.update(batchId, { status: "approved", available_qty_lbs: currentQty + releaseQty });
          // Also restore the matching RawInventory lot (fetch fresh)
          const freshLots = await base44.entities.RawInventory.filter({ raw_material_id: batchId });
          if (freshLots[0]) {
            const updatedQty = (freshLots[0].available_qty || 0) + releaseQty;
            await base44.entities.RawInventory.update(freshLots[0].id, { available_qty: updatedQty, status: "available" });
          }
        } else if (resolvedItemType === "finished_goods") {
           const freshItems = await base44.entities.InventoryItem.filter({ id: batchId });
           const currentQty = freshItems[0]?.quantity_lbs || 0;
           await base44.entities.InventoryItem.update(batchId, { quantity_lbs: currentQty + releaseQty, status: "available" });
        } else if (resolvedItemType === "batch") {
           // Batch type: return to completed (back on-hand) when released as safe
           await base44.entities.Batch.update(batchId, { status: "completed" });
         } else if (resolvedItemType === "production_order") {
           // Production order: resume processing (back to in_progress)
           await base44.entities.ProductionOrder.update(batchId, { status: "in_progress" });
         }
        } else if (batchId && data.status === "rejected") {
         if (itemType === "batch") {
           await base44.entities.Batch.update(batchId, { status: "rejected" });
         } else if (itemType === "production_order") {
           await base44.entities.ProductionOrder.update(batchId, { status: "cancelled" });
         }
        }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["holds"] });
       queryClient.invalidateQueries({ queryKey: ["batches"] });
       queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
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
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="active" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <ShieldAlert className="w-4 h-4" /> Active <span className="ml-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">{activeHolds.length}</span>
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
            <ShieldCheck className="w-4 h-4" /> Resolved <span className="ml-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">{resolvedHolds.length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "resolved" && resolvedHolds.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white font-medium"
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
         <Card className="p-12 text-center bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
           {tab === "active" ? (
             <>
               <ShieldCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
               <h3 className="text-xl font-bold mb-2 text-slate-900">All Clear</h3>
               <p className="text-base text-slate-600">No active holds at this time</p>
             </>
           ) : (
             <>
               <ShieldAlert className="w-16 h-16 text-slate-400 mx-auto mb-4" />
               <h3 className="text-xl font-bold mb-2 text-slate-900">No resolved holds</h3>
               <p className="text-base text-slate-600">Resolved holds will appear here</p>
             </>
           )}
         </Card>
       ) : (
         <Card className="border-slate-200 shadow-sm">
           <CardContent className="p-0">
             <div className="overflow-x-auto">
               <Table>
                 <TableHeader className="bg-slate-50 border-b border-slate-200">
                   <TableRow className="hover:bg-slate-50">
                     <TableHead className="font-semibold text-slate-700">Batch/Lot #</TableHead>
                     <TableHead className="font-semibold text-slate-700">Item</TableHead>
                     <TableHead className="font-semibold text-slate-700">Type</TableHead>
                     <TableHead className="font-semibold text-slate-700">Reason</TableHead>
                     <TableHead className="font-semibold text-slate-700">Severity</TableHead>
                     <TableHead className="font-semibold text-slate-700">Status</TableHead>
                     <TableHead className="font-semibold text-slate-700">Date</TableHead>
                     <TableHead className="font-semibold text-slate-700">Action</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {displayed.map(hold => (
                     <TableRow key={hold.id} className="border-slate-100 hover:bg-slate-50 transition-colors">
                       <TableCell className="font-mono text-sm font-semibold text-slate-900">{hold.batch_number}</TableCell>
                       <TableCell className="text-sm text-slate-700">{hold.product_name}</TableCell>
                       <TableCell>
                         <Badge className={cn("capitalize text-xs font-medium", typeColors[hold.item_type] || "bg-slate-100 text-slate-700")}>
                           {(hold.item_type || "batch").replace(/_/g, " ")}
                         </Badge>
                       </TableCell>
                       <TableCell className="text-sm text-slate-700 capitalize">{(hold.hold_reason || "").replace(/_/g, " ")}</TableCell>
                       <TableCell>
                         <Badge variant="outline" className={cn("capitalize text-xs font-medium border-2", severityColors[hold.severity] || "")}>
                           {hold.severity}
                         </Badge>
                       </TableCell>
                       <TableCell><StatusBadge status={hold.status} /></TableCell>
                       <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                         {hold.held_date ? format(new Date(hold.held_date), "MMM d, HH:mm") : "—"}
                       </TableCell>
                       <TableCell>
                         {(hold.status === "on_hold" || hold.status === "under_review") && (
                           <Button size="sm" onClick={() => setReleasing(hold)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                             Review
                           </Button>
                         )}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
           </CardContent>
         </Card>
       )}

      {showForm && (
         <HoldFormDialog
           open
           batches={batches}
           productionOrders={productionOrders}
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