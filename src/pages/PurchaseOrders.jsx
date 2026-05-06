import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Eye } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/shared/StatusBadge";
import POFormDialog from "@/components/po/POFormDialog";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export default function PurchaseOrders() {
  const [showForm, setShowForm] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PurchaseOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setShowForm(false);
      toast({
        title: "Purchase Order Created",
        description: "Your purchase order has been successfully created.",
      });
      navigate("/");
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
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan="7" className="text-center py-8 text-muted-foreground">
                    No purchase orders yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                pos.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.data.po_number}</TableCell>
                    <TableCell>{po.data.supplier}</TableCell>
                    <TableCell>{po.data.order_date ? format(new Date(po.data.order_date), 'MMM dd, yyyy') : '-'}</TableCell>
                    <TableCell>{po.data.expected_delivery_date ? format(new Date(po.data.expected_delivery_date), 'MMM dd, yyyy') : '-'}</TableCell>
                    <TableCell>${po.data.total_amount?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell><StatusBadge status={po.data.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link to={`/receiving?po_id=${po.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" /> Receive
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingPO(po); setShowForm(true); }}>
                          Edit
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
      />
    </div>
  );
}