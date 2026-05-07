import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, ChevronRight, Briefcase, ShoppingCart } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StageActionDialog from "@/components/production/StageActionDialog";

export default function MyWork() {
  const [user, setUser] = useState(null);
  const [activeStage, setActiveStage] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ["myWorkProfile", user?.id],
    queryFn: () => base44.entities.WorkProfile.filter({ status: "active" }),
    enabled: !!user,
  });

  const myProfile = profiles.find(p => (p.assigned_user_ids || []).includes(user?.id));

  const { data: stages = [] } = useQuery({
    queryKey: ["myStages", myProfile?.id],
    queryFn: () => base44.entities.ProductionStage.filter({
      status: { $in: ["available", "in_progress", "locked"] }
    }, "step_number", 100),
    enabled: !!myProfile,
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["openPurchaseOrders"],
    queryFn: () => base44.entities.PurchaseOrder.filter({
      status: { $in: ["draft", "ordered", "partial_received"] }
    }),
    enabled: myProfile?.name === "Warehouse Operator" || user?.role === "admin",
  });

  // Real-time subscriptions
  useEffect(() => {
    const unsub1 = base44.entities.ProductionStage.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["myStages"] });
    });
    return unsub1;
  }, [queryClient]);

  if (!user) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  // Admin/Supervisor/QC see Floor View instead
  if (user?.role === "admin" || user?.role === "supervisor" || user?.role === "quality_control") {
    return <AdminView user={user} />;
  }

  // Warehouse Operator
  if (myProfile?.name === "Warehouse Operator") {
    return <WarehouseOperatorView user={user} purchaseOrders={purchaseOrders} />;
  }

  // Production floor staff
  if (myProfile) {
    const capabilityKeys = myProfile.capability_keys || [];
    
    // Stages assigned to this user's capabilities
    const myStages = stages.filter(s => capabilityKeys.includes(s.capability_key) && s.status !== "locked");
    
    // Get incoming stages - find stages that are in_progress and come right before this user's stages
    const incomingStages = stages
      .filter(s => s.status === "in_progress")
      .filter(s => !capabilityKeys.includes(s.capability_key))
      .sort((a, b) => a.step_number - b.step_number)
      .slice(0, 3); // Show top 3 incoming

    const inProgress = myStages.filter(s => s.status === "in_progress");
    const available = myStages.filter(s => s.status === "available");

    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <PageHeader 
          title="My Work"
          subtitle={`${myProfile.name} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        />

        {inProgress.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wide mb-3">In Progress</h2>
            <div className="space-y-3">
              {inProgress.map(stage => (
                <StageJobCard key={stage.id} stage={stage} onClick={() => setActiveStage(stage)} status="active" />
              ))}
            </div>
          </div>
        )}

        {available.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-chart-1 uppercase tracking-wide mb-3">Available Now</h2>
            <div className="space-y-3">
              {available.map(stage => (
                <StageJobCard key={stage.id} stage={stage} onClick={() => setActiveStage(stage)} status="ready" />
              ))}
            </div>
          </div>
        )}

        {incomingStages.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">On Deck (Next Up)</h2>
            <div className="space-y-3">
              {incomingStages.map(stage => (
                <StageJobCard key={stage.id} stage={stage} status="incoming" disabled />
              ))}
            </div>
          </div>
        )}

        {myStages.length === 0 && incomingStages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm mt-1">No jobs available right now. Check back soon.</p>
          </div>
        )}

        {activeStage && (
          <StageActionDialog
            stage={activeStage}
            open={!!activeStage}
            onClose={() => setActiveStage(null)}
            onUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ["myStages"] });
              setActiveStage(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-8 text-center text-muted-foreground">
      <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No work profile assigned</p>
      <p className="text-sm mt-1">Contact your admin to be assigned to a work profile.</p>
    </div>
  );
}

function AdminView({ user }) {
  return (
    <div className="p-4 md:p-6">
      <PageHeader 
        title="Admin Dashboard"
        subtitle={`${user?.full_name} · Full System Access`}
      />
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">You have full access to all system features. Use the sidebar to navigate to specific areas.</p>
        <p className="text-sm text-muted-foreground">Dashboard, Floor View, Production Orders, and more are available in the main menu.</p>
      </Card>
    </div>
  );
}

function WarehouseOperatorView({ user, purchaseOrders }) {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader 
        title="Warehouse Operations"
        subtitle={`${user?.full_name} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
      />

      {purchaseOrders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wide mb-3">Open Purchase Orders</h2>
          <div className="space-y-3">
            {purchaseOrders.map(po => (
              <Card key={po.id} className="hover:shadow-md transition-all border-l-4 border-l-amber-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {purchaseOrders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pending purchase orders</p>
          <p className="text-sm mt-1">All incoming materials have been received.</p>
        </div>
      )}

      <div className="mt-8 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
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

function StageJobCard({ stage, onClick, status = "active", disabled = false }) {
  const bgColor = status === "incoming" ? "bg-muted/50 opacity-60" : "";
  const borderColor = status === "active" ? "border-l-accent" : status === "ready" ? "border-l-chart-1" : "border-l-muted";
  
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${borderColor} ${bgColor}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{stage.capability_name}</p>
            <p className="text-sm text-muted-foreground">{stage.product_name} · Order #{stage.order_number}</p>
            {stage.input_qty_lbs > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Input: {stage.input_qty_lbs} lbs</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={status === "incoming" ? "text-muted-foreground" : status === "active" ? "text-accent border-accent/30" : "text-chart-1 border-chart-1/30"}>
              {status === "incoming" ? "On Deck" : status === "active" ? "In Progress" : "Ready"}
            </Badge>
            {!disabled && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}