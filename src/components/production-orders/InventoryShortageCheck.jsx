import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Shows per-ingredient availability vs. what's needed for a production order.
 * Props:
 *   recipe       - the Recipe entity (with ingredients array)
 *   rawInputLbs  - total raw input lbs needed (yield-adjusted)
 */
export default function InventoryShortageCheck({ recipe, rawInputLbs }) {
  const { data: rawInventory = [], isLoading } = useQuery({
    queryKey: ["rawInventoryAvailable"],
    queryFn: () => base44.entities.RawInventory.filter({ status: "available" }, "received_date", 500),
    enabled: !!recipe && rawInputLbs > 0,
  });

  if (!recipe || rawInputLbs <= 0) return null;

  const ingredients = recipe.ingredients || [];
  if (ingredients.length === 0) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking inventory...
      </div>
    );
  }

  // Total recipe batch lbs (sum of ingredient quantities per batch)
  const recipeTotalLbs = ingredients.reduce((s, i) => s + (i.quantity_lbs || 0), 0);

  // Scale ratio: how many recipe batches are needed
  const ratio = recipeTotalLbs > 0 ? rawInputLbs / recipeTotalLbs : 1;

  // Per-ingredient needed vs available
  const checks = ingredients.map(ing => {
    const neededLbs = parseFloat((ing.quantity_lbs * ratio).toFixed(2));
    const availableLbs = rawInventory
      .filter(lot => lot.bucket_id === ing.bucket_id)
      .reduce((s, lot) => s + (lot.available_qty || 0), 0);
    const shortfall = parseFloat(Math.max(0, neededLbs - availableLbs).toFixed(2));
    return {
      name: ing.bucket_name || ing.bucket_id,
      neededLbs,
      availableLbs: parseFloat(availableLbs.toFixed(2)),
      shortfall,
      ok: shortfall <= 0,
    };
  });

  const hasShortage = checks.some(c => !c.ok);

  return (
    <div className={`rounded-md border text-xs ${hasShortage ? "border-destructive/40 bg-destructive/5" : "border-chart-2/40 bg-chart-2/5"}`}>
      <div className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b ${hasShortage ? "border-destructive/20 text-destructive" : "border-chart-2/20 text-chart-2"}`}>
        {hasShortage
          ? <><AlertTriangle className="w-3.5 h-3.5" /> Ingredient Shortages Detected</>
          : <><CheckCircle2 className="w-3.5 h-3.5" /> All Ingredients Available</>
        }
      </div>
      <div className="divide-y divide-border/50">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-1.5 gap-2">
            <span className="text-muted-foreground truncate flex-1">{c.name}</span>
            <span className="font-medium tabular-nums">
              {c.availableLbs} / {c.neededLbs} lbs
            </span>
            {!c.ok && (
              <span className="text-destructive font-semibold tabular-nums whitespace-nowrap">
                −{c.shortfall} lbs
              </span>
            )}
            {c.ok && <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}