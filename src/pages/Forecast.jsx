import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import ForecastCard from "@/components/forecast/ForecastCard";
import { buildForecast } from "@/lib/forecastMath";

const RANK = { red: 0, yellow: 1, green: 2, none: 3 };

async function loadForecastData() {
  const since = new Date(Date.now() - 42 * 86400000).toISOString().slice(0, 10);
  const [products, sales, lots, openOrders, wipOrders] = await Promise.all([
    base44.entities.Product.filter({ status: "active" }),
    base44.entities.DailySalesRecord.filter({ sales_date: { $gte: since } }),
    base44.entities.InventoryItem.filter({ status: { $in: ["available", "quarantined"] } }),
    base44.entities.SalesOrder.filter({ status: { $in: ["draft", "confirmed"] } }),
    base44.entities.ProductionOrder.filter({ status: { $in: ["pending", "in_progress", "paused"] }, archived: { $ne: true } }),
  ]);
  // Lbs already packed into FG from open orders (so WIP isn't double counted)
  const nums = wipOrders.map((o) => o.order_number).filter(Boolean);
  const produced = nums.length ? await base44.entities.InventoryItem.filter({ batch_number: { $in: nums } }) : [];
  const wipProduced = {};
  produced.forEach((i) => {
    wipProduced[i.batch_number] = (wipProduced[i.batch_number] || 0) + (i.original_quantity_lbs || i.quantity_lbs || 0);
  });
  return { products, sales, lots, openOrders, wipOrders, wipProduced };
}

export default function Forecast() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["forecast_data"], queryFn: loadForecastData });

  const items = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return buildForecast(data)
      .filter((i) => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
      .sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name));
  }, [data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Forecast"
        subtitle="2-week target from weighted 6-week sales, open orders, safety stock, holds, expiry and work in progress"
      />
      <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-1">No products found</h3>
          <p className="text-sm text-muted-foreground">Create active products to see forecast data.</p>
        </Card>
      ) : (
        <div className="space-y-3">{items.map((item) => <ForecastCard key={item.id} item={item} />)}</div>
      )}
    </div>
  );
}