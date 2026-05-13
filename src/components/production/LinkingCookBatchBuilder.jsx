import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Layers, Merge, AlertCircle } from "lucide-react";
import { format } from "date-fns";

// Generate a cook batch lot number: e.g. COOK-HOTDOG-20250513-3
async function generateCookBatchLotNumber(productName) {
  const today = format(new Date(), "yyyyMMdd");
  const prefix = `COOK-${productName.replace(/\s+/g, "").toUpperCase().substring(0, 8)}-${today}`;

  // Find existing cook stages today with the same product to determine sequence number
  const existing = await base44.entities.ProductionStage.filter({ capability_key: "cooking" });
  const todaysLots = existing
    .filter(s => s.cook_batch_lot && s.cook_batch_lot.startsWith(prefix))
    .map(s => {
      const parts = s.cook_batch_lot.split("-");
      return parseInt(parts[parts.length - 1]) || 0;
    });

  const nextNum = todaysLots.length > 0 ? Math.max(...todaysLots) + 1 : 1;
  return `${prefix}-${nextNum}`;
}

/**
 * Props:
 *  stage        – current linking ProductionStage record
 *  cookBatch    – { lotNumber, sourceLots, totalQty } | null
 *  onChange     – (cookBatch) => void
 */
export default function LinkingCookBatchBuilder({ stage, cookBatch, onChange }) {
  const [pendingLinkingStages, setPendingLinkingStages] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [manualLot, setManualLot] = useState("");
  const [generatingLot, setGeneratingLot] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load sibling linking stages for the same order that are also available/in_progress
  useEffect(() => {
    if (!stage) return;
    setLoading(true);
    base44.entities.ProductionStage
      .filter({ order_id: stage.order_id, capability_key: "linking" })
      .then(stages => {
        // Include this stage + any others that haven't been merged into a cook batch yet
        const eligible = stages.filter(s =>
          (s.status === "available" || s.status === "in_progress") &&
          !s.cook_batch_lot // not yet assigned to a cook batch
        );
        setPendingLinkingStages(eligible);
        // Pre-select this stage by default
        if (eligible.find(s => s.id === stage.id)) {
          setSelectedIds([stage.id]);
        }
        setLoading(false);
      });
  }, [stage?.id]);

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectedStages = pendingLinkingStages.filter(s => selectedIds.includes(s.id));
  const totalQty = selectedStages.reduce((sum, s) => sum + (s.output_qty_lbs || s.input_qty_lbs || 0), 0);
  const sourceLots = selectedStages.map(s => s.order_number || s.id);

  const handleBuildCookBatch = async () => {
    if (selectedIds.length === 0) return;
    setGeneratingLot(true);
    const lotNumber = manualLot.trim() || await generateCookBatchLotNumber(stage.product_name || "PROD");
    setGeneratingLot(false);
    onChange({
      lotNumber,
      selectedStageIds: selectedIds,
      sourceLots,
      totalQty,
    });
    setManualLot("");
  };

  const handleClear = () => {
    onChange(null);
    setSelectedIds(stage ? [stage.id] : []);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading linking batches...</p>;
  }

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-chart-1" />
        <Label className="font-semibold">Cook Batch Assembly</Label>
      </div>

      {!cookBatch ? (
        <>
          <p className="text-xs text-muted-foreground">
            Select 1–2 linking batches to combine into a single cook batch. Every 2 linking batches = 1 cook batch. Partial (1 batch) is allowed.
          </p>

          {pendingLinkingStages.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded">
              <AlertCircle className="w-3.5 h-3.5" />
              No eligible linking batches found for this order.
            </div>
          )}

          <div className="space-y-1.5">
            {pendingLinkingStages.map(s => {
              const qty = s.output_qty_lbs || s.input_qty_lbs || 0;
              const isSelf = s.id === stage.id;
              const isSelected = selectedIds.includes(s.id);
              const isMaxed = selectedIds.length >= 2 && !isSelected;
              return (
                <div
                  key={s.id}
                  onClick={() => !isMaxed && toggleSelect(s.id)}
                  className={`flex items-center justify-between p-2.5 rounded border text-sm cursor-pointer transition-colors
                    ${isSelected ? "border-chart-1 bg-chart-1/8" : isMaxed ? "opacity-40 cursor-not-allowed bg-muted/20" : "bg-background hover:bg-muted/30"}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isMaxed}
                      onChange={() => !isMaxed && toggleSelect(s.id)}
                      className="w-3.5 h-3.5"
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="font-medium">
                      Linking Batch — Order #{s.order_number}
                      {isSelf && <span className="ml-1 text-chart-1 text-xs">(this batch)</span>}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">{qty} lbs</Badge>
                </div>
              );
            })}
          </div>

          {selectedIds.length > 0 && (
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                <span>{selectedIds.length} batch{selectedIds.length !== 1 ? "es" : ""} selected</span>
                <span className="font-semibold text-foreground">{totalQty} lbs total</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Custom Lot # (optional — leave blank to auto-generate)</Label>
                <Input
                  value={manualLot}
                  onChange={e => setManualLot(e.target.value)}
                  placeholder={`e.g. COOK-HOTDOG-${format(new Date(), "yyyyMMdd")}-1`}
                  className="h-7 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleBuildCookBatch}
                disabled={generatingLot}
              >
                <Merge className="w-3.5 h-3.5" />
                {generatingLot ? "Generating lot..." : `Build Cook Batch (${selectedIds.length} linking batch${selectedIds.length !== 1 ? "es" : ""})`}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border border-chart-2/40 bg-chart-2/8 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-chart-2" />
              <span className="font-semibold text-sm text-chart-2">Cook Batch Ready</span>
            </div>
            <div className="text-sm space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lot Number</span>
                <span className="font-mono font-semibold">{cookBatch.lotNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Qty</span>
                <span className="font-semibold">{cookBatch.totalQty} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Linking Batches</span>
                <span className="font-semibold">{cookBatch.selectedStageIds?.length || 1}</span>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleClear} className="w-full text-xs">
            Change Selection
          </Button>
        </div>
      )}
    </div>
  );
}