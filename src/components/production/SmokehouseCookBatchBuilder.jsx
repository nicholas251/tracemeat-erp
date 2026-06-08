import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Layers, CheckCircle2, AlertCircle } from "lucide-react";

const MAX_RACKS_PER_BATCH = 3;

/**
 * SmokehouseCookBatchBuilder
 *
 * The smokehouse operator sees every rack RELEASED from racking for the SAME product
 * (across multiple tumble batches). They pick 1–3 racks to load into an oven and confirm
 * them as a cook batch. Each rack's lot is shown so mixed-lot batches are identifiable.
 *
 * Emits: { lotNumber, rackIds, racks:[{id,lbs,lot_number,...}], totalLbs, isMixedLot }
 *
 * Props:
 *   stage     – the cooking ProductionStage (carries product_id + order)
 *   cookBatch – current value | null
 *   onChange  – (cookBatch | null) => void
 */
export default function SmokehouseCookBatchBuilder({ stage, cookBatch, onChange }) {
  const [lotNumber, setLotNumber] = useState(
    cookBatch?.lotNumber || `COOK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
  );
  const [selectedIds, setSelectedIds] = useState(cookBatch?.rackIds || []);

  // All released racks for the SAME product (any order/tumble batch of that product).
  const { data: releasedRacks = [], isLoading } = useQuery({
    queryKey: ["releasedRacks", stage?.product_id || stage?.product_name],
    queryFn: async () => {
      const filter = stage?.product_id
        ? { product_id: stage.product_id, status: "released" }
        : { product_name: stage.product_name, status: "released" };
      const racks = await base44.entities.RackUnit.filter(filter, "released_at", 200);
      return racks;
    },
    enabled: !!stage,
  });

  const toggleRack = (rack) => {
    let next;
    if (selectedIds.includes(rack.id)) {
      next = selectedIds.filter(id => id !== rack.id);
    } else {
      if (selectedIds.length >= MAX_RACKS_PER_BATCH) return; // cap at 3
      next = [...selectedIds, rack.id];
    }
    setSelectedIds(next);
    emit(next, lotNumber);
  };

  const handleLotChange = (val) => {
    setLotNumber(val);
    emit(selectedIds, val);
  };

  const emit = (ids, lot) => {
    if (ids.length === 0) {
      onChange(null);
      return;
    }
    const racks = releasedRacks.filter(r => ids.includes(r.id));
    const totalLbs = parseFloat(racks.reduce((s, r) => s + (r.lbs || 0), 0).toFixed(2));
    const lots = [...new Set(racks.map(r => r.lot_number).filter(Boolean))];
    onChange({
      lotNumber: lot,
      rackIds: ids,
      racks: racks.map(r => ({ id: r.id, lbs: r.lbs, lot_number: r.lot_number, rack_number: r.rack_number })),
      totalLbs,
      isMixedLot: lots.length > 1,
      sourceLots: lots,
    });
  };

  const selectedRacks = releasedRacks.filter(r => selectedIds.includes(r.id));
  const selectedLbs = parseFloat(selectedRacks.reduce((s, r) => s + (r.lbs || 0), 0).toFixed(2));
  const selectedLots = [...new Set(selectedRacks.map(r => r.lot_number).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="bg-card p-4 rounded-xl border space-y-1.5">
        <Label className="text-sm font-semibold">Cook Batch Lot #</Label>
        <Input
          value={lotNumber}
          onChange={(e) => handleLotChange(e.target.value)}
          className="h-10 text-sm font-medium font-mono"
        />
      </div>

      <Card className="shadow-sm border">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Layers className="w-4 h-4 text-chart-1" />
            Select Racks for the Oven ({selectedIds.length}/{MAX_RACKS_PER_BATCH})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-6">Loading released racks…</p>
          )}

          {!isLoading && releasedRacks.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground italic">
              No released racks available for this product yet.
            </div>
          )}

          {releasedRacks.map((rack, idx) => {
            const isSelected = selectedIds.includes(rack.id);
            const atCap = !isSelected && selectedIds.length >= MAX_RACKS_PER_BATCH;
            // Number sequentially across all released racks (per-card rack_number repeats
            // across tumble batches and looks confusing here).
            const displayNumber = idx + 1;
            return (
              <button
                key={rack.id}
                type="button"
                disabled={atCap}
                onClick={() => toggleRack(rack)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? "bg-chart-3/5 border-chart-3/50"
                    : atCap
                    ? "bg-slate-50 border-slate-200/60 opacity-50 cursor-not-allowed"
                    : "bg-white border-border hover:border-chart-1/30"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-chart-3 border-chart-3" : "border-muted-foreground/40"
                  }`}>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">Rack #{displayNumber} · {rack.lbs} lbs</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {rack.lot_contributions?.length > 1
                        ? `Lots: ${rack.lot_contributions.map(c => `${c.lot_number} (${c.lbs})`).join(" + ")}`
                        : `Lot: ${rack.lot_number || "—"}`} · Order #{rack.order_number}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <div className="p-4 rounded-xl border-2 border-chart-3/30 bg-chart-3/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-chart-3" />
              <span className="text-sm font-bold">Cook Batch Ready</span>
            </div>
            <Badge variant="outline" className="font-bold">{selectedLbs} lbs · {selectedIds.length} rack(s)</Badge>
          </div>

          <div className="text-xs space-y-1">
            <span className="text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Lots in this batch</span>
            <div className="flex flex-wrap gap-1.5">
              {selectedLots.map((lot) => (
                <Badge key={lot} variant="secondary" className="text-[11px] font-mono">{lot}</Badge>
              ))}
            </div>
          </div>

          {selectedLots.length > 1 && (
            <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Mixed-lot cook batch — {selectedLots.length} different lots combined. All lots are recorded for traceability.
            </div>
          )}
        </div>
      )}
    </div>
  );
}