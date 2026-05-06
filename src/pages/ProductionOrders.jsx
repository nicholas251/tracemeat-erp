import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import ProductionOrderFormDialog from "@/components/production-orders/ProductionOrderFormDialog";
import ProductionOrderDetail from "@/components/production-orders/ProductionOrderDetail";

export default function ProductionOrders() {
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewDetail, setViewDetail] = useState(false);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['productionOrders'],
    queryFn: () => base44.entities.ProductionOrder.list('-created_date', 100),
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => base44.entities.Recipe.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders'] });
      setViewDetail(false);
    },
  });

  const handleSaveOrder = (data) => {
    const stages = [
      { stage_number: 1, stage_name: "blending", status: "pending" },
      { stage_number: 2, stage_name: "chopping", status: "pending" },
      { stage_number: 3, stage_name: "linking", status: "pending" },
      { stage_number: 4, stage_name: "cooking", status: "pending" },
      { stage_number: 5, stage_name: "chilling", status: "pending" },
      { stage_number: 6, stage_name: "packaging", status: "pending" },
    ];

    const recipe = recipes.find(r => r.id === data.recipe_id);
    const product = products.find(p => p.id === data.product_id);

    createMutation.mutate({
      order_number: `PO-${Date.now()}`,
      product_id: data.product_id,
      product_name: product?.name,
      recipe_id: data.recipe_id,
      recipe_name: recipe?.name,
      quantity_to_produce: data.quantity_to_produce,
      status: "pending",
      current_stage: 0,
      stages,
      order_date: new Date().toISOString().split('T')[0],
      target_completion_date: data.target_completion_date,
      notes: data.notes,
    });
  };

  const stageColors = {
    blending: "bg-chart-1/15 text-chart-1",
    chopping: "bg-chart-3/15 text-chart-3",
    linking: "bg-chart-5/15 text-chart-5",
    cooking: "bg-accent/15 text-accent",
    chilling: "bg-chart-2/15 text-chart-2",
    packaging: "bg-primary/15 text-primary",
  };

  if (isLoading) return <div className="p-6"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;

  return (
    <div className="p-6">
      <PageHeader
        title="Production Orders"
        subtitle="Manage cascading production pipeline from recipe blending to packaging"
        actions={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Production Order
          </Button>
        }
      />

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No production orders yet</CardContent></Card>
        ) : (
          orders.map(order => (
            <Card 
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedOrder(order);
                setViewDetail(true);
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{order.order_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">{order.product_name} - {order.recipe_name}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                     <span className="text-muted-foreground">Quantity:</span>
                     <span className="font-medium">{order.quantity_to_produce} lbs</span>
                   </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Production Pipeline</p>
                    <div className="flex flex-wrap gap-2">
                      {order.stages?.map((stage, idx) => (
                        <div key={idx} className="text-xs">
                          <Badge className={stageColors[stage.stage_name]}>
                            {stage.stage_name}
                            {stage.status === 'completed' && ' ✓'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ProductionOrderFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSaveOrder}
        recipes={recipes}
        products={products}
      />

      {selectedOrder && (
        <ProductionOrderDetail
          open={viewDetail}
          onClose={() => setViewDetail(false)}
          order={selectedOrder}
          onUpdate={(stageIndex, stageData) => {
            const updatedStages = [...selectedOrder.stages];
            updatedStages[stageIndex] = { ...updatedStages[stageIndex], ...stageData };
            updateMutation.mutate({
              id: selectedOrder.id,
              data: {
                stages: updatedStages,
                current_stage: stageIndex,
                status: stageIndex === updatedStages.length - 1 && stageData.status === 'completed' ? 'completed' : 'in_progress',
              }
            });
            setSelectedOrder({ ...selectedOrder, stages: updatedStages });
          }}
        />
      )}
    </div>
  );
}