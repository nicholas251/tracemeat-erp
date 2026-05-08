import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Factory, Package, ShieldAlert, Warehouse, Boxes } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/dashboard/StatCard";
import ActiveHolds from "@/components/dashboard/ActiveHolds";
import ActiveOrdersList from "@/components/dashboard/ActiveOrdersList";

export default function Dashboard() {
  const { data: orders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date", 50),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: holds = [] } = useQuery({
    queryKey: ["holds"],
    queryFn: () => base44.entities.HoldRelease.list("-created_date", 50),
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => base44.entities.RawMaterial.list(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => base44.entities.InventoryItem.list(),
  });

  const activeOrders = orders.filter(o => o.status === "in_progress").length;
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const activeHolds = holds.filter(h => h.status === "on_hold" || h.status === "under_review").length;
  const activeProducts = products.filter(p => p.status === "active").length;
  const inventoryLbs = inventory.filter(i => i.status === "available").reduce((sum, i) => sum + (i.quantity_lbs || 0), 0);

  return (
    <div>
      <PageHeader 
        title="Dashboard" 
        subtitle="Overview of your meat processing operations" 
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 mb-8">
        <StatCard label="Active Orders" value={activeOrders} icon={Factory} color="text-chart-1" link="/production-orders" />
        <StatCard label="Pending Orders" value={pendingOrders} icon={Factory} color="text-accent" link="/production-orders" />
        <StatCard label="Products" value={activeProducts} icon={Package} color="text-chart-2" link="/products" />
        <StatCard label="Active Holds" value={activeHolds} icon={ShieldAlert} color="text-destructive" link="/hold-release" />
        <StatCard label="Inventory (lbs)" value={inventoryLbs.toLocaleString()} icon={Boxes} color="text-chart-3" link="/inventory" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActiveOrdersList orders={orders} />
        </div>
        <div>
          <ActiveHolds holds={holds} />
        </div>
      </div>
    </div>
  );
}