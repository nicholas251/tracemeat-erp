import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle } from "lucide-react";
import FulfillmentDialog from "./FulfillmentDialog";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  invoiced: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function SalesOrderDetailDialog({ open, order, onClose, onUpdated }) {
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.SalesOrder.update(order.id, data),
    onSuccess: () => { onUpdated(); queryClient.invalidateQueries({ queryKey: ["salesOrders"] }); },
  });

  const handleStatusChange = (newStatus) => {
    updateMutation.mutate({ status: newStatus });
  };

  const handlePackingSlip = async () => {
    const customer = {
      customer_name: order.customer_name,
    };
    const payload = {
      order: {
        ...order,
        customer_name: order.customer_name,
      }
    };
    const response = await base44.functions.invoke("generatePackingSlip", payload);
    // open blob
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const totalAmount = (order.line_items || []).reduce((s, l) => s + (l.line_total || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Order {order.order_number || order.id?.slice(-6)}</DialogTitle>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-8 ${STATUS_STYLES[order.status] || ""}`}>
              {order.status}
            </span>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
          <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{order.customer_name}</span></div>
          <div><span className="text-muted-foreground">Order Date:</span> {order.order_date}</div>
          <div><span className="text-muted-foreground">Ship Date:</span> {order.ship_date || "—"}</div>
          <div><span className="text-muted-foreground">Order Total:</span> <span className="font-semibold">${totalAmount.toFixed(2)}</span></div>
        </div>

        {order.notes && (
          <p className="text-sm text-muted-foreground mt-2 bg-muted/30 rounded px-3 py-2">{order.notes}</p>
        )}

        {/* Line Items */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm mb-2">Line Items</h3>
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-right px-3 py-2 font-medium">Cases</th>
                  <th className="text-right px-3 py-2 font-medium">Lbs/Case</th>
                  <th className="text-right px-3 py-2 font-medium">Total Lbs</th>
                  <th className="text-right px-3 py-2 font-medium">Price</th>
                  <th className="text-right px-3 py-2 font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.line_items || []).map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.product_name}</div>
                      {(item.fulfilled_lots || []).length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Lots: {item.fulfilled_lots.map(l => l.lot_number || l.batch_number).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{item.cases_qty}</td>
                    <td className="px-3 py-2 text-right">{item.case_weight_lbs} lbs</td>
                    <td className="px-3 py-2 text-right">{(item.total_lbs || 0).toFixed(1)} lbs</td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                      {item.is_variable_weight ? `$${item.price_per_lb}/lb` : `$${item.price_per_case}/case`}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">${(item.line_total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4 justify-between">
          <div className="flex gap-2">
            {order.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("confirmed")}>
                Confirm Order
              </Button>
            )}
            {(order.status === "confirmed") && (
              <Button size="sm" onClick={() => setFulfillOpen(true)}>
                <CheckCircle className="w-4 h-4 mr-1" /> Fulfill Order
              </Button>
            )}
            {order.status === "fulfilled" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("invoiced")}>
                Mark as Invoiced
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePackingSlip}>
              <FileText className="w-4 h-4 mr-1" /> Packing Slip
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>

      {fulfillOpen && (
        <FulfillmentDialog
          open={fulfillOpen}
          order={order}
          onClose={() => setFulfillOpen(false)}
          onFulfilled={() => {
            setFulfillOpen(false);
            onUpdated();
            queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
          }}
        />
      )}
    </Dialog>
  );
}