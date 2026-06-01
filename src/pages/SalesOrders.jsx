import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Eye } from "lucide-react";
import SalesOrderFormDialog from "@/components/sales/SalesOrderFormDialog";
import SalesOrderDetailDialog from "@/components/sales/SalesOrderDetailDialog";

const STATUS_COLORS = {
  draft: "secondary",
  confirmed: "default",
  fulfilled: "default",
  invoiced: "default",
  cancelled: "destructive",
};

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  invoiced: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function SalesOrders() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: () => base44.entities.SalesOrder.list("-created_date"),
  });

  const handleView = (o) => { setSelected(o); setDetailOpen(true); };
  const handleNew = () => { setSelected(null); setFormOpen(true); };

  const totalAmount = (order) => (order.line_items || []).reduce((s, l) => s + (l.line_total || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and fulfill customer sales orders</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" /> New Sales Order
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No sales orders yet. Create your first order to get started.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Order #</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Order Date</th>
                <th className="text-left px-4 py-3 font-medium">Ship Date</th>
                <th className="text-left px-4 py-3 font-medium">Route</th>
                <th className="text-left px-4 py-3 font-medium">Items</th>
                <th className="text-left px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-mono font-medium">{o.order_number || "—"}</td>
                  <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.order_date}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.ship_date || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.route ? `Route ${o.route}` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(o.line_items || []).length} item(s)</td>
                  <td className="px-4 py-3 font-medium">${totalAmount(o).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[o.status] || ""}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleView(o)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SalesOrderFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["salesOrders"] }); setFormOpen(false); }}
      />

      {selected && (
        <SalesOrderDetailDialog
          open={detailOpen}
          order={selected}
          onClose={() => { setDetailOpen(false); setSelected(null); }}
          onUpdated={() => { queryClient.invalidateQueries({ queryKey: ["salesOrders"] }); }}
        />
      )}
    </div>
  );
}