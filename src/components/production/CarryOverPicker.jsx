import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Layers } from "lucide-react";

// At packing, lets the operator pull in OPEN unfinished-case carry-overs for THIS product
// (multi-select). Selected carry-overs add their lbs + lot contributions into the run's
// packable weight. Original expiry is preserved on the carry-over record.
export default function CarryOverPicker({ productId, selectedIds = [], onChange }) {
  const { data: carryOvers = [] } = useQuery({
    queryKey: ["openCarryOvers", productId],
    queryFn: () => base44.entities.UnfinishedCase.filter({ product_id: productId, status: "open" }),
    enabled: !!productId,
    staleTime: 0,
  });

  if (!productId || carryOvers.length === 0) return null;

  const toggle = (id) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onChange(next, carryOvers.filter(c => next.includes(c.id)));
  };

  const selectedLbs = carryOvers
    .filter(c => selectedIds.includes(c.id))
    .reduce((s, c) => s + (c.lbs || 0), 0);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4 text-chart-1" /> Add Carry-Over Product
        </Label>
        <p className="text-xs text-muted-foreground">Pull leftover product from earlier runs into this packing.</p>
      </div>
      <div className="space-y-2">
        {carryOvers.map(c => {
          const checked = selectedIds.includes(c.id);
          return (
            <Card key={c.id} className={checked ? "border-chart-1/50 bg-chart-1/5" : ""}>
              <CardContent className="p-3 flex items-start gap-3">
                <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} className="mt-0.5" />
                <div className="flex-1 min-w-0 text-sm" onClick={() => toggle(c.id)} role="button">
                  <div className="flex justify-between">
                    <span className="font-semibold">{(c.lbs || 0).toFixed(2)} lbs</span>
                    <span className="text-xs text-muted-foreground">#{c.source_order_number || "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {(c.lot_contributions || []).length
                      ? c.lot_contributions.map(l => `${l.lot_number} (${(l.lbs || 0).toFixed(1)})`).join(", ")
                      : "No lot detail"}
                    {c.expiry_date ? ` · exp ${c.expiry_date}` : ""}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {selectedLbs > 0 && (
        <div className="rounded-lg border border-chart-1/30 bg-chart-1/5 p-2 text-sm flex justify-between">
          <span className="text-muted-foreground">Carry-over added</span>
          <span className="font-semibold text-chart-1">+{selectedLbs.toFixed(2)} lbs</span>
        </div>
      )}
    </div>
  );
}