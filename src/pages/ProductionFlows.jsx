import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, GitBranch, Pencil, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import FlowFormDialog from "@/components/flows/FlowFormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export default function ProductionFlows() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const queryClient = useQueryClient();

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: () => base44.entities.ProductionFlow.list("-created_date"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionFlow.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flows"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionFlow.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flows"] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductionFlow.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flows"] }); setDeleting(null); },
  });

  return (
    <div>
      <PageHeader 
        title="Production Flows" 
        subtitle="Design step-by-step processing flows for each product"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Flow
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2].map(i => <Card key={i} className="h-48 animate-pulse bg-muted" />)}
        </div>
      ) : flows.length === 0 ? (
        <Card className="p-12 text-center">
          <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No flows yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create a production flow to define processing steps</p>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> New Flow</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {flows.map(flow => (
            <Card key={flow.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{flow.name}</h3>
                    <p className="text-xs text-muted-foreground">{flow.product_name} · v{flow.version || 1}</p>
                  </div>
                  <StatusBadge status={flow.status} />
                </div>

                {/* Steps visual */}
                <div className="flex items-center gap-1 mb-4 flex-wrap">
                  {(flow.steps || []).map((step, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="px-2.5 py-1 rounded-md bg-muted text-xs font-medium flex items-center gap-1">
                        {step.ccp && <AlertTriangle className="w-3 h-3 text-accent" />}
                        {step.name}
                      </div>
                      {i < (flow.steps || []).length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                    </div>
                  ))}
                  {(flow.steps || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No steps defined</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(flow)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  {flow.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: flow.id, data: { ...flow, status: "active" }})}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Activate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(flow)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <FlowFormDialog open products={products} onClose={() => setShowForm(false)} onSave={(data) => createMutation.mutate(data)} />
      )}
      {editing && (
        <FlowFormDialog open flow={editing} products={products} onClose={() => setEditing(null)} onSave={(data) => updateMutation.mutate({ id: editing.id, data })} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this flow.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleting.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}