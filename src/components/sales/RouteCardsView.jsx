import React, { useState } from "react";
import { Truck, ChevronDown, ChevronUp, Package } from "lucide-react";

const ROUTES = ["101", "102", "202", "203", "303", "402", "403", "502", "503"];

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  invoiced: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function RouteCardsView({ orders, onViewOrder }) {
  const [expanded, setExpanded] = useState(null);

  const ordersByRoute = ROUTES.reduce((acc, route) => {
    acc[route] = orders.filter(o => o.route === route && o.status !== "cancelled");
    return acc;
  }, {});

  const toggle = (route) => setExpanded(prev => prev === route ? null : route);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ROUTES.map(route => {
        const routeOrders = ordersByRoute[route];
        const isOpen = expanded === route;
        const totalLbs = routeOrders.reduce((s, o) =>
          s + (o.line_items || []).reduce((ls, li) => ls + (li.total_lbs || 0), 0), 0);

        return (
          <div key={route} className="bg-card border rounded-lg overflow-hidden shadow-sm">
            {/* Card Header */}
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              onClick={() => toggle(route)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Route {route}</div>
                  <div className="text-xs text-muted-foreground">
                    {routeOrders.length} order{routeOrders.length !== 1 ? "s" : ""}
                    {totalLbs > 0 && ` · ${totalLbs.toFixed(0)} lbs`}
                  </div>
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {/* Expanded Content */}
            {isOpen && (
              <div className="border-t divide-y">
                {routeOrders.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No orders assigned to this route
                  </div>
                ) : (
                  routeOrders.map(order => (
                    <div key={order.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-mono text-xs font-medium">{order.order_number || "—"}</span>
                          <span className="ml-2 text-sm font-medium">{order.customer_name}</span>
                          {order.ship_date && <div className="text-xs text-muted-foreground mt-1">Ship: {order.ship_date}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status] || ""}`}>
                            {order.status}
                          </span>
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => onViewOrder(order)}
                          >
                            View
                          </button>
                        </div>
                      </div>
                      {/* Products */}
                      <div className="space-y-1 mt-2">
                        {(order.line_items || []).map((li, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              <span>{li.product_name}</span>
                            </div>
                            <span>{li.cases_qty} case{li.cases_qty !== 1 ? "s" : ""}{li.total_lbs ? ` · ${li.total_lbs.toFixed(0)} lbs` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}