import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Factory, Package, ShieldAlert, Boxes, ShoppingCart, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/dashboard/StatCard";
import ActiveHolds from "@/components/dashboard/ActiveHolds";
import ActiveOrdersList from "@/components/dashboard/ActiveOrdersList";
import { isUserAdminOrSupervisor, isUserQualityControl } from "@/lib/accessControl";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import QADashboard from "@/components/dashboard/QADashboard";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["allWorkProfiles"],
    queryFn: () => base44.entities.WorkProfile.filter({ status: "active" }),
    enabled: !!user,
  });

  const myProfiles = allProfiles.filter(p => (p.assigned_user_ids || []).includes(user?.id));
  const showManagement = isUserAdminOrSupervisor(myProfiles);
  const showQA = isUserQualityControl(myProfiles) && !showManagement;

  const { data: orders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 50),
    enabled: showManagement,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
    enabled: showManagement,
  });

  const { data: holds = [] } = useQuery({
    queryKey: ["holds"],
    queryFn: () => base44.entities.HoldRelease.list("-created_date", 50),
    enabled: showManagement,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => base44.entities.InventoryItem.list(),
    enabled: showManagement,
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: () => base44.entities.SalesOrder.list("-created_date", 100),
    enabled: showManagement,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.filter({ status: "active" }),
    enabled: showManagement,
  });

  const activeOrders = orders.filter(o => o.status === "in_progress").length;
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const activeHolds = holds.filter(h => h.status === "on_hold" || h.status === "under_review").length;
  const totalProducts = products.length;
  const inventoryLbs = inventory.filter(i => i.status === "available").reduce((sum, i) => sum + (i.quantity_lbs || 0), 0);
  const openSalesOrders = salesOrders.filter(o => o.status === "confirmed" || o.status === "draft").length;
  const activeCustomers = customers.length;

  return (
    <div>
      <PageHeader 
        title="Dashboard" 
        subtitle="Overview of your meat processing operations" 
      />

      {showManagement && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4 mb-8">
          <StatCard label="Active Orders" value={activeOrders} icon={Factory} color="text-blue-600" link="/production-orders" />
          <StatCard label="Pending Orders" value={pendingOrders} icon={Factory} color="text-amber-600" link="/production-orders" />
          <StatCard label="Products" value={totalProducts} icon={Package} color="text-green-600" link="/products" />
          <StatCard label="Active Holds" value={activeHolds} icon={ShieldAlert} color="text-red-600" link="/hold-release" />
          <StatCard label="Inventory (lbs)" value={inventoryLbs.toLocaleString()} icon={Boxes} color="text-purple-600" link="/inventory" />
          <StatCard label="Open Sales Orders" value={openSalesOrders} icon={ShoppingCart} color="text-teal-600" link="/sales-orders" />
          <StatCard label="Customers" value={activeCustomers} icon={Users} color="text-indigo-600" link="/customers" />
        </div>
      )}

      {showQA && <QADashboard />}

      {showManagement && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActiveOrdersList orders={orders} />
          </div>
          <div>
            <ActiveHolds holds={holds} />
          </div>
        </div>
      )}
    </div>
  );
}