import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import WeeklyReconciliation from "@/components/sales/WeeklyReconciliation";

export default function DailySales() {

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.filter({ status: "active" })
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
      
      if (records.length > 0) {
        await Promise.all(records.map(r => 
          base44.functions.invoke("recordDailySales", {
            product_id: r.product_id,
            quantity_lbs: r.quantity_lbs,
            sales_date: r.sales_date
          })
        ));
      }
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
          reconcileWeekMutation.mutate({ weekStart, data })
        }
      />


    </div>
  );
}