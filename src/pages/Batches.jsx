import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Factory, Eye, Boxes } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import BatchFormDialog from "@/components/batches/BatchFormDialog";
import BatchStepTracker from "@/components/batches/BatchStepTracker";
import { useNavigate } from "react-router-dom";

export default function Batches() {
  const [showForm, setShowForm] = useState(false);
  const [trackingBatch, setTrackingBatch] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: () => base44.entities.Batch.list("-created_date"),
  });

  const { data: flows = [] } = useQuery({
    queryKey: ["flows"],
    queryFn: () => base44.entities.ProductionFlow.list(),
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => base44.entities.RawMaterial.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Batch.create({ ...data, status: "in_progress" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["batches"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Batch.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["batches"] }); },
  });

  const handleAdvanceStep = async (stepData) => {
    const batch = trackingBatch;
    const flow = flows.find(f => f.id === batch.flow_id);
    if (!flow) return;

    const newStepRecords = [...(batch.step_records || [])];
    const currentIdx = batch.current_step || 0;
    const now = new Date().toISOString();

    newStepRecords[currentIdx] = {
      ...newStepRecords[currentIdx],
      status: "completed",
      started_at: newStepRecords[currentIdx]?.started_at || now,
      completed_at: now,
      temp_recorded_c: stepData.temp_recorded_c,
      notes: stepData.notes,
      passed_inspection: stepData.passed_inspection,
    };

    const isLastStep = currentIdx >= (flow.steps || []).length - 1;
    const nextStep = isLastStep ? currentIdx : currentIdx + 1;

    // Mark next step as in_progress if not last
    if (!isLastStep && newStepRecords[nextStep]) {
      newStepRecords[nextStep] = { ...newStepRecords[nextStep], status: "in_progress", started_at: now };
    }

    const updatedBatch = {
      ...batch,
      step_records: newStepRecords,
      current_step: isLastStep ? currentIdx : nextStep,
      status: isLastStep ? "completed" : "in_progress",
    };

    await updateMutation.mutateAsync({ id: batch.id, data: updatedBatch });

    // Auto-create finished goods inventory when batch completes
    if (isLastStep) {
      const product = products.find(p => p.id === batch.product_id);
      await base44.entities.InventoryItem.create({
        product_id: batch.product_id,
        product_name: batch.product_name,
        sku: product?.sku || "",
        batch_id: batch.id,
        batch_number: batch.batch_number,
        lot_number: `FG-${batch.batch_number}`,
        quantity_lbs: batch.quantity_lbs || 0,
        original_quantity_lbs: batch.quantity_lbs || 0,
        status: "available",
        production_date: batch.production_date,
        expiry_date: batch.expiry_date,
        storage_temp_c: product?.storage_temp_c ?? null,
        notes: `Auto-created from completed batch ${batch.batch_number}`,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Batch Completed",
        description: `Finished goods lot FG-${batch.batch_number} added to inventory.`,
      });
    }

    setTrackingBatch(isLastStep ? null : updatedBatch);
  };

  const handleHold = () => {
    const batch = trackingBatch;
    navigate(`/hold-release?batch_id=${batch.id}&batch_number=${batch.batch_number}&product_name=${batch.product_name}`);
    setTrackingBatch(null);
  };

  const filtered = statusFilter === "all" ? batches : batches.filter(b => b.status === statusFilter);
  const trackingFlow = trackingBatch ? flows.find(f => f.id === trackingBatch.flow_id) : null;

  return (
    <div>
      <PageHeader 
        title="Batches" 
        subtitle="Track production batches through their flows"
        actions={
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Batch
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Card className="h-64 animate-pulse bg-muted" />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Factory className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No batches</h3>
          <p className="text-sm text-muted-foreground mb-4">Start a new batch to begin production tracking</p>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> New Batch</Button>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Flow</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Qty (lbs)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(batch => {
                  const completedSteps = (batch.step_records || []).filter(s => s.status === "completed").length;
                  const totalSteps = batch.total_steps || (batch.step_records || []).length;
                  return (
                    <TableRow key={batch.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setTrackingBatch(batch)}>
                      <TableCell className="font-mono text-sm font-medium">{batch.batch_number}</TableCell>
                      <TableCell className="text-sm">{batch.product_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{batch.flow_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-chart-2 rounded-full transition-all" style={{ width: `${totalSteps ? (completedSteps / totalSteps) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{completedSteps}/{totalSteps}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={batch.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {batch.production_date ? format(new Date(batch.production_date), "MMM d") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{batch.quantity_lbs || "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <BatchFormDialog open flows={flows} rawMaterials={rawMaterials} onClose={() => setShowForm(false)} onSave={(data) => createMutation.mutate(data)} />
      )}
      {trackingBatch && trackingFlow && (
        <BatchStepTracker 
          open 
          batch={trackingBatch} 
          flow={trackingFlow} 
          onClose={() => setTrackingBatch(null)} 
          onAdvanceStep={handleAdvanceStep}
          onHold={handleHold}
        />
      )}
    </div>
  );
}