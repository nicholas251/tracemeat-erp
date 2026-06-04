import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, FlaskConical } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import SpiceMixFormDialog from "@/components/spice-mixes/SpiceMixFormDialog";
import ProduceSpiceMixDialog from "@/components/spice-mixes/ProduceSpiceMixDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function SpiceMixes() {
  const [showForm, setShowForm] = useState(false);
  const [editingMix, setEditingMix] = useState(null);
  const [deleteMix, setDeleteMix] = useState(null);
  const [produceMix, setProduceMix] = useState(null);
  const queryClient = useQueryClient();

  const { data: mixes = [], isLoading } = useQuery({
    queryKey: ['spiceMixes'],
    queryFn: () => base44.entities.SpiceMix.list('-updated_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SpiceMix.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiceMixes'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SpiceMix.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiceMixes'] });
      setEditingMix(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SpiceMix.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiceMixes'] });
      setDeleteMix(null);
    },
  });

  const handleSaveMix = async (data) => {
    if (editingMix) {
      updateMutation.mutate({ id: editingMix.id, data });
    } else {
      // Auto-create a matching is_mix InventoryBucket for this spice mix
      const bucket = await base44.entities.InventoryBucket.create({
        name: data.name,
        category: "spice",
        is_mix: true,
        unit: "lbs",
        code: "",
        description: "",
        status: "active",
      });
      createMutation.mutate({ ...data, bucket_id: bucket.id, bucket_name: bucket.name });
    }
  };

  if (isLoading) return <div className="p-6"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;

  return (
    <div>
      <PageHeader
        title="Spice Mixes"
        subtitle="Pre-batch seasonings for production"
        actions={
          <Button onClick={() => { setEditingMix(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Spice Mix
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mixes.length === 0 ? (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">No spice mixes yet</CardContent></Card>
        ) : (
          mixes.map(mix => (
            <Card key={mix.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{mix.name}</CardTitle>
                  <StatusBadge status={mix.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Batch Size:</span>
                    <span className="font-medium">{mix.quantity_lbs} lbs</span>
                    </div>
                    <div className="flex justify-between">
                    <span className="text-muted-foreground">Available:</span>
                    <span className="font-medium">{mix.available_qty_lbs || 0} lbs</span>
                  </div>
                  {mix.ingredients?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Ingredients:</p>
                      <div className="space-y-1">
                        {mix.ingredients.map((ing, i) => (
                          <p key={i} className="text-xs">{ing.bucket_name || ing.name}: {ing.quantity_lbs} lbs</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setProduceMix(mix)}
                    className="flex-1 gap-1 text-chart-2 border-chart-2/30 hover:bg-chart-2/10"
                  >
                    <FlaskConical className="w-3 h-3" /> Produce
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditingMix(mix); setShowForm(true); }}
                    className="gap-1"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteMix(mix)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <SpiceMixFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingMix(null); }}
        onSave={handleSaveMix}
        mix={editingMix}
      />

      <ProduceSpiceMixDialog
        mix={produceMix}
        open={!!produceMix}
        onClose={() => setProduceMix(null)}
        onProduced={() => {
          queryClient.invalidateQueries({ queryKey: ['spiceMixes'] });
          queryClient.invalidateQueries({ queryKey: ['raw_inventory'] });
          queryClient.invalidateQueries({ queryKey: ['inventory_buckets'] });
        }}
      />

      <AlertDialog open={!!deleteMix} onOpenChange={() => setDeleteMix(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Spice Mix</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteMix?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(deleteMix.id)}>
            Delete
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}