import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default function Forecast() {
  const [search, setSearch] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.filter({ status: "active" })
  });

  const { data: fgBuckets = [] } = useQuery({
    queryKey: ["fg_buckets"],
    queryFn: () => base44.entities.FinishedGoodsBucket.list()
  });

  const { data: salesRecords = [] } = useQuery({
    queryKey: ["daily_sales_records"],
    queryFn: () => base44.entities.DailySalesRecord.list()
  });

  const forecastData = useMemo(() => {
    const today = new Date();
    const sixWeeksAgo = new Date(today.getTime() - 42 * 24 * 60 * 60 * 1000);

    return products
      .filter(p => p.status === "active")
      .map(product => {
        // Get sales for last 42 days
        const recentSales = salesRecords.filter(record => {
          if (record.product_id !== product.id) return false;
          const saleDate = new Date(record.sales_date);
          return saleDate >= sixWeeksAgo && saleDate <= today;
        });

        // Calculate 6-week rolling average
        const totalSalesSixWeeks = recentSales.reduce((sum, r) => sum + (r.quantity_lbs || 0), 0);
        const rollingAvg = recentSales.length > 0 ? totalSalesSixWeeks / 42 : 0;

        // Full inventory target = rolling average × 2
        const fullInventory = rollingAvg * 2;

        // Current inventory
        const bucket = fgBuckets.find(b => b.product_id === product.id);
        const currentInventory = bucket?.quantity_lbs || 0;

        // Inventory status based on percentage of full inventory
        let status = "red";
        let statusLabel = "Critical";
        let statusColor = "bg-destructive";
        
        if (fullInventory > 0) {
          const percentage = (currentInventory / fullInventory) * 100;
          if (percentage >= 75) {
            status = "green";
            statusLabel = "Optimal";
            statusColor = "bg-green-600";
          } else if (percentage >= 50) {
            status = "yellow";
            statusLabel = "Low";
            statusColor = "bg-yellow-500";
          }
        } else if (currentInventory > 0) {
          status = "green";
          statusLabel = "Optimal";
          statusColor = "bg-green-600";
        }

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          rollingAvg: Math.round(rollingAvg * 10) / 10,
          fullInventory: Math.round(fullInventory * 10) / 10,
          currentInventory: Math.round(currentInventory * 10) / 10,
          status,
          statusLabel,
          statusColor,
          percentage: fullInventory > 0 ? Math.round((currentInventory / fullInventory) * 100) : 0,
          totalSalesDays: recentSales.length
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, fgBuckets, salesRecords]);

  const filteredData = forecastData.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusIcon = (status) => {
    if (status === "green") return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (status === "yellow") return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    return <TrendingDown className="w-4 h-4 text-destructive" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Inventory Forecast" 
        subtitle="6-week rolling average analysis with full inventory targets"
      />

      <Input
        placeholder="Search products..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {filteredData.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-1">No products found</h3>
          <p className="text-sm text-muted-foreground">Create active products to see forecast data.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredData.map(item => (
            <Card key={item.id} className={item.status === "red" ? "border-destructive" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                    </div>
                  </div>
                  <Badge className={`${item.statusColor} text-white`}>
                    {item.statusLabel}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">6-Wk Avg</p>
                    <p className="text-lg font-bold">{item.rollingAvg}</p>
                    <p className="text-xs text-muted-foreground">lbs/day</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Full Target</p>
                    <p className="text-lg font-bold">{item.fullInventory.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">lbs</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Current</p>
                    <p className="text-lg font-bold">{item.currentInventory.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">lbs</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">% of Target</p>
                    <p className="text-lg font-bold">{item.percentage}%</p>
                    <p className="text-xs text-muted-foreground">{item.totalSalesDays} days</p>
                  </div>
                </div>

                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${item.statusColor}`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}