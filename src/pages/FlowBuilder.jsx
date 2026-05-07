import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import FlowList from "@/components/flows/FlowList";
import FlowBuilderDialog from "@/components/flows/FlowBuilderDialog";

export default function FlowBuilder() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
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
    mutationFn: (data) => base44.entities.ProductFlow.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["productFlows"] }); setShowBuilder(false); setEditingFlow(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductFlow.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["productFlows"] }); setShowBuilder(false); setEditingFlow(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductFlow.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["productFlows"] }),
  });

  const handleSave = (data) => {
    if (editingFlow) updateMutation.mutate({ id: editingFlow.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Flow Builder"
        subtitle="Design production flows by enabling capabilities and ordering steps per product"
        actions={
          <Button onClick={() => { setEditingFlow(null); setShowBuilder(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Flow
          </Button>
        }
      />

      <FlowList
        flows={flows}
        isLoading={isLoading}
        onEdit={(flow) => { setEditingFlow(flow); setShowBuilder(true); }}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

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