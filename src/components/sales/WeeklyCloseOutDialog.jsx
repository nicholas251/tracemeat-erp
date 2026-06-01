import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Truck, CheckCircle2, AlertTriangle } from "lucide-react";

const ROUTES = ["101", "102", "202", "203", "303", "402", "403", "502", "503"];

export default function DailyCloseOutDialog({ open, onClose, orders, onArchived }) {
  const [routeChecks, setRouteChecks] = useState(
    ROUTES.reduce((acc, r) => ({ ...acc, [r]: false }), {})
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Get today's routes only
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const activeRoutes = ROUTES.filter(r =>
    orders.some(o => o.route === r && o.route_date === todayStr && o.status !== "cancelled")
  );

  const allChecked = activeRoutes.length === 0 || activeRoutes.every(r => routeChecks[r]);

  const toggle = (route) =>
    setRouteChecks(prev => ({ ...prev, [route]: !prev[route] }));

  const handleArchive = async () => {
    setLoading(true);
    await onArchived(notes);
    setLoading(false);
    setNotes("");
    setRouteChecks(ROUTES.reduce((acc, r) => ({ ...acc, [r]: false }), {}));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Daily Route Close-Out
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Confirm all trucks went out correctly. Cases will be consumed from inventory.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Route Confirmation Checklist */}
          <div>
            <p className="text-sm font-medium mb-3">Confirm routes dispatched today:</p>
            {activeRoutes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-3 text-center border rounded-lg">
                No routes scheduled for today.
              </div>
            ) : (
              <div className="space-y-2">
                {activeRoutes.map(route => {
                   const routeOrders = orders.filter(
                     o => o.route === route && o.route_date === todayStr && o.status !== "cancelled"
                   );
                  const checked = routeChecks[route];
                  return (
                    <button
                      key={route}
                      onClick={() => toggle(route)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                        checked
                          ? "bg-green-50 border-green-300"
                          : "bg-white border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          checked ? "bg-green-500 border-green-500" : "border-gray-300"
                        }`}>
                          {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm">Route {route}</div>
                          <div className="text-xs text-muted-foreground">
                            {routeOrders.length} order{routeOrders.length !== 1 ? "s" : ""} ·{" "}
                            {routeOrders.map(o => o.customer_name).join(", ")}
                          </div>
                        </div>
                      </div>
                      {checked ? (
                        <span className="text-xs text-green-600 font-medium">Confirmed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tap to confirm</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium block mb-1">
              Close-out notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="e.g. Route 202 had a late delivery, Route 503 short-shipped 1 case of product X..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-24 text-sm resize-none"
            />
          </div>

          {/* Warning if not all checked */}
          {activeRoutes.length > 0 && !allChecked && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Please confirm all routes before archiving.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleArchive}
            disabled={!allChecked || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Closing out..." : "Close Out Today's Routes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}