import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ChevronRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default function WarehouseOperatorView({ user }) {
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["openPurchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.filter({
      status: { $in: ["draft", "ordered", "partial_received"] }
    }),
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Warehouse Operations"
        subtitle={`${user?.full_name} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
      />

      {purchaseOrders.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wide mb-3">Open Purchase Orders</h2>
          <div className="space-y-3">
            {purchaseOrders.map(po => (
              <Card key={po.id} className="hover:shadow-md transition-all border-l-4 border-l-amber-500">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{po.po_number}</p>
                    <p className="text-sm text-muted-foreground">{po.supplier} · {po.line_items?.length || 0} items</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected: {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : "TBD"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="text-amber-600 border-amber-200">
                      {po.status === "draft" ? "Draft" : po.status === "ordered" ? "Ordered" : "Partial"}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pending purchase orders</p>
          <p className="text-sm mt-1">All incoming materials have been received.</p>
        </div>
      )}

      <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
        <p className="font-medium mb-2">Your Responsibilities:</p>
        <ul className="text-xs space-y-1 ml-4">
          <li>• Manage raw material inventory and receiving</li>
          <li>• Track purchase orders and supplier deliveries</li>
          <li>• Monitor finished goods inventory</li>
          <li>• Process inventory adjustments</li>
        </ul>
      </div>
    </div>
  );
}