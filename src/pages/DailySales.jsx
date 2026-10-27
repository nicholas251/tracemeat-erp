import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import WeeklyReconciliation from "@/components/sales/WeeklyReconciliation";

export default function DailySales() {

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["products", "daily_sales_all"],
    queryFn: async () => {
      const all = await base44.entities.Product.filter({ status: { $ne: "discontinued" } });
      return all.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    },
    refetchOnMount: "always"
  });

  const { data: fgBuckets = [] } = useQuery({
    queryKey: ["fg_buckets"],
    queryFn: () => base44.entities.FinishedGoodsBucket.list()
  });

  const reconcileWeekMutation = useMutation({
    mutationFn: async ({ weekStart, data }) => {
      // Batch create/update daily sales records for the week
      const records = [];
      for (const [key, qty] of Object.entries(data)) {
        if (qty !== null) {
          const [productId, dayPart] = key.split("-day");
          const dayIndex = parseInt(dayPart);
          records.push({
            product_id: productId,
            quantity_lbs: qty,
            sales_date: new Date(new Date(weekStart).getTime() + dayIndex * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          });
        }
      }
      
      // One at a time so sales for the same product don't overwrite each other
      const errors = [];
      for (const r of records) {
        if (!(r.quantity_lbs > 0)) continue;
        try {
          await base44.functions.invoke("recordDailySales", r);
        } catch (e) {
          errors.push(`${r.sales_date}: ${e.response?.data?.error || e.message}`);
        }
      }
      if (errors.length) alert(`Some sales were not recorded:\n\n${errors.join("\n")}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
      queryClient.invalidateQueries({ queryKey: ["dailySales"] });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Daily Sales" 
        subtitle="Log daily product sales and deduct from finished goods inventory"
      />

      <WeeklyReconciliation 
        products={products}
        fgBuckets={fgBuckets}
        onReconcileWeek={({ weekStart, data }) => 
          reconcileWeekMutation.mutateAsync({ weekStart, data })
        }
      />


    </div>
  );
}