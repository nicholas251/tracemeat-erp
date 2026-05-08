import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Warehouse, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import MaterialFormDialog from "@/components/materials/MaterialFormDialog";
import AllocationDialog from "@/components/materials/AllocationDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export default function RawMaterials() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [allocating, setAllocating] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => base44.entities.RawMaterial.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RawMaterial.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["raw-materials"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RawMaterial.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["raw-materials"] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RawMaterial.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["raw-materials"] }); setDeleting(null); },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: ({ id, allocated, parLevel }) => base44.entities.RawMaterial.update(id, { allocated_qty_lbs: allocated, par_level: parLevel }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["raw-materials"] }); setAllocating(null); },
  });

  const filteredMaterials = activeTab === "all" ? materials : materials.filter(m => m.category === activeTab);

  return (
    <div>
      <PageHeader 
        title="Raw Materials" 
        subtitle="Track incoming materials with lot numbers and supplier info"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Receive Material
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All Materials</TabsTrigger>
          <TabsTrigger value="casing">Casings</TabsTrigger>
          <TabsTrigger value="seasoning">Seasonings</TabsTrigger>
          <TabsTrigger value="packaging">Packaging</TabsTrigger>
          <TabsTrigger value="additive">Additives</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card className="h-48 animate-pulse bg-muted" />
      ) : filteredMaterials.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <Warehouse className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No raw materials</h3>
          <p className="text-sm text-muted-foreground mb-4">Record incoming materials to start tracking</p>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Receive Material</Button>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty (lbs)</TableHead>
                      <TableHead>Temp (°F)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaterials.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm font-medium">{m.lot_number}</TableCell>
                        <TableCell className="text-sm font-medium">{m.name}</TableCell>
                        <TableCell className="text-sm">{m.supplier}</TableCell>
                        <TableCell className="text-sm capitalize">{(m.category || "").replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-sm">{m.quantity_lbs || "—"}</TableCell>
                        <TableCell className="text-sm">{m.temp_on_arrival_c != null ? `${m.temp_on_arrival_c}°` : "—"}</TableCell>
                        <TableCell><StatusBadge status={m.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.received_date ? format(new Date(m.received_date), "MMM d") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" title="Update Allocation" onClick={() => setAllocating(m)}>
                              📦
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(m)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {filteredMaterials.map(m => (
              <Card key={m.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold">{m.lot_number}</p>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Supplier</p>
                      <p className="font-medium">{m.supplier}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Category</p>
                      <p className="font-medium capitalize">{(m.category || "").replace(/_/g, " ")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Quantity</p>
                      <p className="font-medium">{m.quantity_lbs || "—"} lbs</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Temp</p>
                      <p className="font-medium">{m.temp_on_arrival_c != null ? `${m.temp_on_arrival_c}°` : "—"}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.received_date ? format(new Date(m.received_date), "MMM d, yyyy") : "—"}
                  </p>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setAllocating(m)}>📦 Allocate</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleting(m)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <MaterialFormDialog open onClose={() => setShowForm(false)} onSave={(data) => createMutation.mutate(data)} />
      )}
      {editing && (
        <MaterialFormDialog open material={editing} onClose={() => setEditing(null)} onSave={(data) => updateMutation.mutate({ id: editing.id, data })} />
      )}
      {allocating && (
        <AllocationDialog open onClose={() => setAllocating(null)} material={allocating} onSave={({ allocated, parLevel }) => updateAllocationMutation.mutate({ id: allocating.id, allocated, parLevel })} />
      )}

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this raw material record.</AlertDialogDescription>
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