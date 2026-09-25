import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ParSection from "./ParSection";

const bySeverity = (a, b) => {
  const score = r => { const p = Number(r.par) || 0; return p <= 0 ? 2 : r.onHand < p ? 0 : 1; };
  return score(a) - score(b) || a.name.localeCompare(b.name);
};

// Par levels for every active finished product (cases) and every raw material bucket (lbs).
export default function ParLevelsView() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const { data: products = [], isLoading: lp } = useQuery({ queryKey: ["parProducts"], queryFn: () => base44.entities.Product.filter({ status: "active" }) });
  const { data: fgBuckets = [], isLoading: lf } = useQuery({ queryKey: ["fgBuckets"], queryFn: () => base44.entities.FinishedGoodsBucket.list() });
  const { data: buckets = [], isLoading: lb } = useQuery({ queryKey: ["parBuckets"], queryFn: () => base44.entities.InventoryBucket.list() });
  const { data: rawInv = [], isLoading: lr } = useQuery({ queryKey: ["parRawInventory"], queryFn: () => base44.entities.RawInventory.list("-created_date", 5000) });
  const canEdit = me?.role === "admin";

  const productRows = products.map(p => {
    const fg = fgBuckets.filter(b => b.product_id === p.id);
    return {
      id: p.id,
      name: p.name,
      subtitle: [p.sku, p.category].filter(Boolean).join(" · "),
      onHand: fg.reduce((s, b) => s + (b.cases_on_hand || 0), 0),
      par: p.par_cases,
    };
  }).sort(bySeverity);

  const bucketRows = buckets.filter(b => b.status !== "inactive").map(b => ({
    id: b.id,
    name: b.name,
    subtitle: [b.code, b.category].filter(Boolean).join(" · "),
    onHand: rawInv
      .filter(r => r.bucket_id === b.id && (r.status === "available" || r.status === "in_use"))
      .reduce((s, r) => s + (r.available_qty ?? 0), 0),
    par: b.par_level_lbs,
  })).sort(bySeverity);

  const saveProductPar = async (id, val) => {
    await base44.entities.Product.update(id, { par_cases: val });
    queryClient.invalidateQueries({ queryKey: ["parProducts"] });
  };
  const saveBucketPar = async (id, val) => {
    await base44.entities.InventoryBucket.update(id, { par_level_lbs: val });
    queryClient.invalidateQueries({ queryKey: ["parBuckets"] });
  };

  return (
    <div className="space-y-8">
      {!canEdit && <p className="text-xs text-muted-foreground">Only admins can change par levels.</p>}
      <ParSection title="Finished Products" unit="cases" rows={productRows} canEdit={canEdit} onSavePar={saveProductPar} isLoading={lp || lf} />
      <ParSection title="Raw Material Buckets" unit="lbs" rows={bucketRows} canEdit={canEdit} onSavePar={saveBucketPar} isLoading={lb || lr} />
    </div>
  );
}