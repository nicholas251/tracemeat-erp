import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, ChevronRight, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import ProductionOrderFormDialog from "@/components/production-orders/ProductionOrderFormDialog";
import OrderStagesPanel from "@/components/production/OrderStagesPanel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { isUserAdminOrSupervisor } from "@/lib/accessControl";

export default function ProductionOrders() {
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["allWorkProfiles"],
    queryFn: () => base44.entities.WorkProfile.filter({ status: "active" }),
    enabled: !!currentUser,
  });

  // Compute allowed capability keys and admin status based on work profiles
  const userProfiles = allProfiles.filter(p => (p.assigned_user_ids || []).includes(currentUser?.id));
  const allowedCapabilityKeys = userProfiles.flatMap(p => p.capability_keys || []);
  const isAdminOrSupervisor = isUserAdminOrSupervisor(userProfiles);
  // null means no restriction (admin sees all); array restricts to specific capabilities
  const capabilityKeyFilter = isAdminOrSupervisor ? null : (allowedCapabilityKeys.length > 0 ? allowedCapabilityKeys : []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: flows = [] } = useQuery({
    queryKey: ["productFlows"],
    queryFn: () => base44.entities.ProductFlow.filter({ status: "active" }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const orderData = {
        ...data,
        flow_id: data.flow_id || "",
        flow_name: data.flow_name || "",
      };
      const order = await base44.entities.ProductionOrder.create(orderData);
      // Create locked stages from flow
      if (data.flow_id) {
        const flow = flows.find(f => f.id === data.flow_id);
        if (flow?.steps) {
            const sorted = [...flow.steps].sort((a, b) => a.step_number - b.step_number);
            // Calculate total raw input needed for ALL batches — read yield % directly from product
            const product = products.find(p => p.id === data.product_id);
            let totalRawInputLbs = data.quantity_to_produce; // fallback
            if (product?.blend_batch_lbs && product?.yield_percent) {
              const yieldPct = product.yield_percent;
              const chopBatchWeight = (product.blend_batch_lbs || 0) + (product.chop_water_lbs || 0) + (product.chop_spice_qty_lbs || 0) + (product.chop_cure_lbs || 0);
              const finishedPerBatch = chopBatchWeight > 0 ? chopBatchWeight * (yieldPct / 100) : product.blend_batch_lbs * ((yieldPct || 100) / 100);
              const numBatches = finishedPerBatch > 0 ? Math.ceil(data.quantity_to_produce / finishedPerBatch) : 1;
              totalRawInputLbs = product.blend_batch_lbs * numBatches;
            }

            // Create stages
            for (let i = 0; i < sorted.length; i++) {
              const step = sorted[i];
              await base44.entities.ProductionStage.create({
                order_id: order.id,
                order_number: order.order_number,
                product_name: data.product_name,
                step_number: step.step_number,
                capability_id: step.capability_id,
                capability_key: step.capability_key,
                capability_name: step.capability_name,
                work_profile_id: step.work_profile_id || "",
                work_profile_name: step.work_profile_name || "",
                status: i === 0 ? "available" : "locked",
                input_qty_lbs: i === 0 ? totalRawInputLbs : 0,
                sub_batches: [],
              });
            }
          }
      }
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
      queryClient.invalidateQueries({ queryKey: ["productionStages"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
      setShowForm(false);
      setEditingOrder(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductionOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
      setDeletingOrderId(null);
    },
  });

  const handleSave = (data) => {
    if (editingOrder) {
      // When updating, ensure flow info is preserved
      updateMutation.mutate({ id: editingOrder.id, data: { ...data, flow_id: data.flow_id, flow_name: data.flow_name } });
    } else {
      createMutation.mutate(data);
    }
  };

  const STATUS_COLORS = {
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-chart-1/15 text-chart-1",
    completed: "bg-chart-2/15 text-chart-2",
    paused: "bg-accent/15 text-accent",
    cancelled: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Production Orders"
        subtitle="Create and track production orders through each stage of the flow"
        actions={
          isAdminOrSupervisor && (
            <Button onClick={() => { setEditingOrder(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> New Order
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No production orders yet.</div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <Card key={order.id} className={viewingOrder?.id === order.id ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-base">{order.product_name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Order #{order.order_number} · {order.quantity_to_produce} lbs · {order.flow_name || "No flow"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`capitalize text-xs ${STATUS_COLORS[order.status]}`}>
                      {order.status?.replace("_", " ")}
                    </Badge>
                    {isAdminOrSupervisor && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditingOrder(order); setShowForm(true); }} className="gap-1 h-7">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <AlertDialog open={deletingOrderId === order.id} onOpenChange={(open) => setDeletingOrderId(open ? order.id : null)}>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1 h-7 text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogTitle>Delete Production Order</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete order #{order.order_number}? This action cannot be undone.
                            </AlertDialogDescription>
                            <div className="flex gap-2 justify-end">
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(order.id)}>
                                {deleteMutation.isPending ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </div>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {isAdminOrSupervisor && (
                      <Button size="sm" variant="outline" onClick={() => setViewingOrder(viewingOrder?.id === order.id ? null : order)} className="gap-1">
                        <Eye className="w-3.5 h-3.5" /> {viewingOrder?.id === order.id ? "Hide" : "Stages"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {viewingOrder?.id === order.id && (
                <CardContent>
                  <OrderStagesPanel orderId={order.id} allowedCapabilityKeys={capabilityKeyFilter} />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <ProductionOrderFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setEditingOrder(null); }}
          onSave={handleSave}
          order={editingOrder}
          products={products}
          flows={flows}
          suppliers={suppliers}
        />
      )}
    </div>
  );
}