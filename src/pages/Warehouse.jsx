import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import PutAwayQueue from "@/components/warehouse/PutAwayQueue";
import LocationMap from "@/components/warehouse/LocationMap";
import ParLevelsView from "@/components/inventory/ParLevelsView";
import { freeSpots } from "@/lib/warehouseLayout";

export default function Warehouse() {
  const queryClient = useQueryClient();
  const { data: pallets = [] } = useQuery({ queryKey: ["pallets"], queryFn: () => base44.entities.Pallet.filter({ status: "stored" }) });
  const { data: items = [], isLoading } = useQuery({ queryKey: ["warehouseItems"], queryFn: () => base44.entities.InventoryItem.filter({ status: "available" }, "-production_date", 1000) });
  const { data: products = [] } = useQuery({ queryKey: ["warehouseProducts"], queryFn: () => base44.entities.Product.list() });

  const caseWeightOf = Object.fromEntries(products.map(p => [p.id, Number(p.case_weight_lbs) || 1]));
  const placedLbs = {};
  pallets.forEach(p => (p.lots || []).forEach(l => { placedLbs[l.inventory_item_id] = (placedLbs[l.inventory_item_id] || 0) + (l.lbs || 0); }));

  const queue = items.map(i => {
    const caseWeight = caseWeightOf[i.product_id] || 1;
    const remainingLbs = parseFloat(((i.quantity_lbs || 0) - (placedLbs[i.id] || 0)).toFixed(2));
    return { ...i, caseWeight, remainingLbs, remainingCases: Math.round(remainingLbs / caseWeight) };
  }).filter(r => r.remainingLbs > 0.01 && r.remainingCases > 0);

  const spots = freeSpots(pallets);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pallets"] });
    queryClient.invalidateQueries({ queryKey: ["warehouseItems"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse" subtitle={`Shipping room · ${pallets.length} pallets stored · ${spots.length} spots free`} />
      <Tabs defaultValue="putaway">
        <TabsList>
          <TabsTrigger value="putaway">Put-Away ({queue.length})</TabsTrigger>
          <TabsTrigger value="map">Locations</TabsTrigger>
          <TabsTrigger value="par">Par Levels</TabsTrigger>
        </TabsList>
        <TabsContent value="putaway" className="mt-4">
          {isLoading ? <div className="h-40 rounded-xl bg-muted animate-pulse" /> : <PutAwayQueue rows={queue} spots={spots} onDone={refresh} />}
        </TabsContent>
        <TabsContent value="map" className="mt-4"><LocationMap pallets={pallets} spots={spots} onDone={refresh} /></TabsContent>
        <TabsContent value="par" className="mt-4"><ParLevelsView finishedOnly /></TabsContent>
      </Tabs>
    </div>
  );
}