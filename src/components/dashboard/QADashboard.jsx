import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, ShieldAlert, Search, Warehouse, Boxes, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";

function QACard({ label, value, sub, icon: Icon, color, link }) {
  return (
    <Link to={link}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-5 flex items-center gap-4">
          <div className={`p-3 rounded-lg bg-muted ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function QADashboard() {
  const { data: holds = [] } = useQuery({
    queryKey: ["holds"],
    queryFn: () => base44.entities.HoldRelease.list("-created_date", 100),
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["rawMaterials"],
    queryFn: () => base44.entities.RawMaterial.list(),
  });

  const { data: rawInventory = [] } = useQuery({
    queryKey: ["rawInventory"],
    queryFn: () => base44.entities.RawInventory.list(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => base44.entities.InventoryItem.list(),
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["productionStages"],
    queryFn: () => base44.entities.ProductionStage.list("-created_date", 100),
  });

  const activeHolds = holds.filter(h => h.status === "on_hold" || h.status === "under_review").length;
  const criticalHolds = holds.filter(h => h.severity === "critical" && (h.status === "on_hold" || h.status === "under_review")).length;

  const availableRawMaterials = rawMaterials.filter(r => r.status === "approved" || r.status === "in_use").length;
  const rawInventoryLbs = rawInventory.filter(r => r.status === "available").reduce((sum, r) => sum + (r.available_qty || 0), 0);

  const finishedGoodsLbs = inventory.filter(i => i.status === "available").reduce((sum, i) => sum + (i.quantity_lbs || 0), 0);
  const finishedGoodsItems = inventory.filter(i => i.status === "available").length;

  const activeFloorStages = stages.filter(s => s.status === "in_progress").length;
  const availableFloorStages = stages.filter(s => s.status === "available").length;

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-5">Quality Assurance overview — live snapshot of operations.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        <QACard
          label="Floor View"
          value={activeFloorStages}
          sub={`${availableFloorStages} available stages`}
          icon={Monitor}
          color="text-chart-1"
          link="/floor-view"
        />
        <QACard
          label="Active Holds"
          value={activeHolds}
          sub={criticalHolds > 0 ? `${criticalHolds} critical` : "No critical holds"}
          icon={ShieldAlert}
          color="text-destructive"
          link="/hold-release"
        />
        <QACard
          label="Traceability"
          value="Search"
          sub="Trace batches & lots"
          icon={Search}
          color="text-chart-5"
          link="/traceability"
        />
        <QACard
          label="Raw Materials"
          value={availableRawMaterials}
          sub="Approved / In Use"
          icon={Warehouse}
          color="text-chart-2"
          link="/raw-materials"
        />
        <QACard
          label="Raw Inventory"
          value={`${rawInventoryLbs.toLocaleString()} lbs`}
          sub="Available stock"
          icon={Boxes}
          color="text-accent"
          link="/raw-inventory"
        />
        <QACard
          label="Finished Goods"
          value={`${finishedGoodsLbs.toLocaleString()} lbs`}
          sub={`${finishedGoodsItems} lots available`}
          icon={Package}
          color="text-chart-3"
          link="/inventory"
        />
      </div>
    </div>
  );
}