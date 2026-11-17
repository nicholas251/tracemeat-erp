import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterBucketsBySpecies } from "@/lib/proteinSpecies";

// Shown on racking cards that are the FIRST step of a flow (no tumbling before them):
// the operator picks the raw protein bucket that is deducted when the card completes.
export default function RackingProteinPicker({ product, value, onChange }) {
  const { data: allBuckets = [] } = useQuery({
    queryKey: ["proteinBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "protein", status: "active" }),
  });
  const buckets = useMemo(
    () => filterBucketsBySpecies(allBuckets, product?.category),
    [allBuckets, product?.category]
  );

  const { data: lots = [] } = useQuery({
    queryKey: ["rawInventory", value, "racking"],
    queryFn: () => base44.entities.RawInventory.filter({ bucket_id: value }),
    enabled: !!value,
    staleTime: 0,
  });
  const onHand = lots
    .filter((l) => l.status !== "depleted")
    .reduce((s, l) => s + (Number(l.available_qty) || 0), 0);

  // Pre-select the product's own protein bucket, or the only matching one.
  useEffect(() => {
    if (value || buckets.length === 0) return;
    const preferredId = product?.blend_ingredients?.[0]?.bucket_id;
    const pick = buckets.find((b) => b.id === preferredId) || (buckets.length === 1 ? buckets[0] : null);
    if (pick) onChange(pick.id, pick.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, value]);

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
      <Label className="text-sm font-semibold">Raw protein being racked</Label>
      <Select value={value || ""} onValueChange={(id) => onChange(id, buckets.find((b) => b.id === id)?.name || "")}>
        <SelectTrigger className="h-10 bg-slate-200 border-slate-400">
          <SelectValue placeholder="Choose a protein bucket…" />
        </SelectTrigger>
        <SelectContent>
          {buckets.length === 0 && <SelectItem value="__none__" disabled>No protein buckets found</SelectItem>}
          {buckets.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-slate-700">
        {value ? `${onHand.toFixed(1)} lbs on hand. ` : ""}
        The racked weight is taken from this bucket, oldest lot first, when the card is completed.
      </p>
    </div>
  );
}