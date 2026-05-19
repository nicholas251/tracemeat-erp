import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, Edit, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import FlowList from "@/components/flows/FlowList";
import FlowBuilderDialog from "@/components/flows/FlowBuilderDialog";
import CapabilityDialog from "@/components/capabilities/CapabilityDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function FlowBuilder() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [showCapDialog, setShowCapDialog] = useState(false);
  const [editingCap, setEditingCap] = useState(null);
  const [deleteCap, setDeleteCap] = useState(null);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const queryClient = useQueryClient();

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["productFlows"],
    queryFn: () => base44.entities.ProductFlow.list("-created_date"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: capabilities = [] } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => base44.entities.Capability.filter({ status: "active" }),
  });

  const { data: workProfiles = [] } = useQuery({
    queryKey: ["workProfiles"],
    queryFn: () => base44.entities.WorkProfile.filter({ status: "active" }),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const flow = await base44.entities.ProductFlow.create(data);
      if (data.product_id) {
        await base44.entities.Product.update(data.product_id, { flow_id: flow.id, flow_name: data.name });
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
      return flow;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["productFlows"] }); setShowBuilder(false); setEditingFlow(null); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const flow = await base44.entities.ProductFlow.update(id, data);
      if (data.product_id) {
        await base44.entities.Product.update(data.product_id, { flow_id: id, flow_name: data.name });
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
      return flow;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["productFlows"] }); setShowBuilder(false); setEditingFlow(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductFlow.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["productFlows"] }),
  });

  const createCapMutation = useMutation({
    mutationFn: (data) => base44.entities.Capability.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["capabilities"] }); setShowCapDialog(false); setEditingCap(null); },
  });

  const updateCapMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Capability.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["capabilities"] }); setShowCapDialog(false); setEditingCap(null); },
  });

  const deleteCapMutation = useMutation({
    mutationFn: (id) => base44.entities.Capability.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["capabilities"] }); setDeleteCap(null); },
  });

  const handleSave = (data) => {
    if (editingFlow) updateMutation.mutate({ id: editingFlow.id, data });
    else createMutation.mutate(data);
  };

  const handleCapSave = (data) => {
    if (editingCap) updateCapMutation.mutate({ id: editingCap.id, data });
    else createCapMutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Flow Builder"
        subtitle="Design production flows by enabling capabilities and ordering steps per product"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCapabilities(v => !v)} className="gap-2">
              <Settings2 className="w-4 h-4" /> {showCapabilities ? "Hide" : "Manage"} Capabilities
            </Button>
            <Button onClick={() => { setEditingFlow(null); setShowBuilder(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> New Flow
            </Button>
          </div>
        }
      />

      {showCapabilities && (
        <div className="mb-6 border rounded-xl p-4 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Capabilities Library</h2>
            <Button size="sm" onClick={() => { setEditingCap(null); setShowCapDialog(true); }} className="gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Capability
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {capabilities.map(cap => (
              <div key={cap.id} className="flex items-center justify-between bg-background rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{cap.name}</p>
                  <p className="text-xs text-muted-foreground">{cap.consumes} → {cap.produces}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => { setEditingCap(cap); setShowCapDialog(true); }}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteCap(cap)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FlowList
        flows={flows}
        isLoading={isLoading}
        onEdit={(flow) => { setEditingFlow(flow); setShowBuilder(true); }}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      {showCapDialog && (
        <CapabilityDialog
          open={showCapDialog}
          onClose={() => { setShowCapDialog(false); setEditingCap(null); }}
          onSave={handleCapSave}
          capability={editingCap}
        />
      )}

      <AlertDialog open={!!deleteCap} onOpenChange={() => setDeleteCap(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteCap?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the capability. Flows using it will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCapMutation.mutate(deleteCap.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showBuilder && (
        <FlowBuilderDialog
          open={showBuilder}
          onClose={() => { setShowBuilder(false); setEditingFlow(null); }}
          onSave={handleSave}
          flow={editingFlow}
          products={products}
          capabilities={capabilities}
          workProfiles={workProfiles}
        />
      )}
    </div>
  );
}