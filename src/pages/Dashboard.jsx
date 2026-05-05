import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Factory, Package, ShieldAlert, Warehouse, Boxes } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/dashboard/StatCard";
import RecentBatches from "@/components/dashboard/RecentBatches";
import ActiveHolds from "@/components/dashboard/ActiveHolds";

export default function Dashboard() {
  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: () => base44.entities.Batch.list("-created_date", 50),
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

  const activeBatches = batches.filter(b => b.status === "in_progress").length;
  const activeHolds = holds.filter(h => h.status === "on_hold" || h.status === "under_review").length;
  const activeProducts = products.filter(p => p.status === "active").length;
  const inventoryKg = inventory.filter(i => i.status === "available").reduce((sum, i) => sum + (i.quantity_kg || 0), 0);

  return (
    <div>
      <PageHeader 
        title="Dashboard" 
        subtitle="Overview of your meat processing operations" 
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Active Batches" value={activeBatches} icon={Factory} color="text-chart-1" link="/batches" />
        <StatCard label="Products" value={activeProducts} icon={Package} color="text-chart-2" link="/products" />
        <StatCard label="Active Holds" value={activeHolds} icon={ShieldAlert} color="text-accent" link="/hold-release" />
        <StatCard label="Raw Materials" value={rawMaterials.length} icon={Warehouse} color="text-chart-5" link="/raw-materials" />
        <StatCard label="Inventory (lbs)" value={inventoryKg.toLocaleString()} icon={Boxes} color="text-chart-3" link="/inventory" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentBatches batches={batches} />
        </div>
        <div>
          <ActiveHolds holds={holds} />
        </div>
      </div>
    </div>
  );
}