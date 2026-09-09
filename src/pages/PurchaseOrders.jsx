import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Archive } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/shared/StatusBadge";
import POFormDialog from "@/components/po/POFormDialog";
import PODetailDialog from "@/components/po/PODetailDialog";
import POEmailStatus, { PO_LOGO_URL, poEmailErrorMessage } from "@/components/po/POEmailStatus";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PurchaseOrders() {
  const [showForm, setShowForm] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [deletingPO, setDeletingPO] = useState(null);
  const [viewingPO, setViewingPO] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const created = await base44.entities.PurchaseOrder.create({ ...data, status: "active" });
      // Send email notification — but DON'T fail the whole PO creation if email fails.
      // The PO is already saved; a failed email shouldn't trigger a retry that duplicates it.
      let emailError = null;
      try {
        await base44.functions.invoke('sendPOEmail', { po: created, logoUrl: PO_LOGO_URL });
      } catch (error) {
        console.error('Failed to send PO email:', error);
        emailError = poEmailErrorMessage(error);
      }
      return { created, emailError };
    },
    onSuccess: ({ emailError }) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setShowForm(false);
      toast({
        title: "Purchase Order Created",
        description: emailError
          ? `Saved, but the email could not be sent: ${emailError}. Use "Send" on the PO to retry.`
          : "Your purchase order has been created and emailed to the supplier.",
        variant: emailError ? "destructive" : undefined,
        duration: emailError ? 8000 : 4000,
      });
      if (!emailError) setTimeout(() => navigate("/"), 3500);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create purchase order: ${error.message}`,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setShowForm(false);
      setEditingPO(null);
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: (po) => base44.functions.invoke('sendPOEmail', { po: { id: po.id }, logoUrl: PO_LOGO_URL }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast({ title: "Email Sent", description: `PO ${res.data?.po_number} sent to ${res.data?.sent_to}.`, duration: 4000 });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast({ title: "Email Failed", description: poEmailErrorMessage(error), variant: "destructive", duration: 8000 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setDeletingPO(null);
    },
  });

  const handleSave = (data) => {
    if (editingPO) {
      updateMutation.mutate({ id: editingPO.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Create and manage supplier orders"
        actions={
          <Button onClick={() => { setEditingPO(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New PO
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Materials</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan="9" className="text-center py-8 text-muted-foreground">
                    No purchase orders yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                pos.filter(po => po && po.status !== "archived").map((po) => (
                   <TableRow key={po.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setViewingPO(po)}>
                     <TableCell className="font-medium">{po.po_number}</TableCell>
                     <TableCell>{po.supplier}</TableCell>
                     <TableCell className="text-sm">
                       {(po.line_items || []).length === 0 ? (
                         <span className="text-muted-foreground">-</span>
                       ) : (
                         <ul className="space-y-0.5">
                           {po.line_items.map((item, i) => (
                             <li key={i} className="whitespace-nowrap">
                               {item.material_name}
                               <span className="text-muted-foreground"> · {(item.quantity_lbs || 0).toFixed(0)} lbs</span>
                             </li>
                           ))}
                         </ul>
                       )}
                     </TableCell>
                     <TableCell>{po.order_date ? format(parseISO(po.order_date), 'MMM dd, yyyy') : '-'}</TableCell>
                     <TableCell>{po.expected_delivery_date ? format(parseISO(po.expected_delivery_date), 'MMM dd, yyyy') : '-'}</TableCell>
                     <TableCell>{(po.line_items?.reduce((sum, item) => sum + (item.quantity_lbs || 0), 0) || 0).toFixed(2)} lbs</TableCell>
                     <TableCell><StatusBadge status={po.status} /></TableCell>
                     <TableCell onClick={(e) => e.stopPropagation()}>
                       <POEmailStatus
                         po={po}
                         sending={sendEmailMutation.isPending && sendEmailMutation.variables?.id === po.id}
                         onSend={(p) => sendEmailMutation.mutate(p)}
                       />
                     </TableCell>
                     <TableCell onClick={(e) => e.stopPropagation()}>
                       <div className="flex gap-2">
                         {po.status === "received" && (
                           <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: po.id, data: { status: "archived" } })}>
                             <Archive className="w-4 h-4 mr-1" /> Archive
                           </Button>
                         )}
                         <Button size="sm" variant="ghost" onClick={() => { setEditingPO(po); setShowForm(true); }}>
                           Edit
                         </Button>
                         <Button size="sm" variant="ghost" onClick={() => setDeletingPO(po)}>
                           <Trash2 className="w-4 h-4" />
                         </Button>
                         </div>
                         </TableCell>
                   </TableRow>
                 ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <POFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingPO(null); }}
        onSave={handleSave}
        po={editingPO}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      <PODetailDialog po={viewingPO} onClose={() => setViewingPO(null)} />

      <AlertDialog open={!!deletingPO} onOpenChange={(open) => !open && setDeletingPO(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete PO #{deletingPO?.po_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deletingPO.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}