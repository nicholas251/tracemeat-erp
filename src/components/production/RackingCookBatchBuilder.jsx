import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2 } from "lucide-react";

export default function RackingCookBatchBuilder({ totalLbs, product, cookPlan, onChange }) {
  // 800 lbs fills 2.5 racks → 320 lbs per rack. Every 3 racks = one smokehouse cook batch.
  const LBS_PER_RACK = product?.tumble_lbs_per_rack || 320;
  const RACKS_PER_BATCH = product?.racks_per_batch || 3;
  const [lotPrefix, setLotPrefix] = useState(cookPlan?.lotPrefix || "RACK");
  const [cookBatches, setCookBatches] = useState(cookPlan?.cookBatches || []);

  useEffect(() => {
    if (!cookPlan) {
      // Total racks needed, then group every 3 racks into a cook batch
      const racksNeeded = Math.ceil(totalLbs / LBS_PER_RACK);
      const batchesNeeded = Math.max(1, Math.ceil(racksNeeded / RACKS_PER_BATCH));
      const newBatches = [];

      let racksRemaining = racksNeeded;
      let lbsRemaining = totalLbs;
      for (let i = 0; i < batchesNeeded; i++) {
        const racksInThisBatch = Math.min(RACKS_PER_BATCH, racksRemaining);
        const isLast = i === batchesNeeded - 1;
        // Last batch carries the remaining lbs so the plan totals exactly to input
        const lbsInThisBatch = isLast
          ? parseFloat(lbsRemaining.toFixed(2))
          : parseFloat((racksInThisBatch * LBS_PER_RACK).toFixed(2));
        newBatches.push({
          batchNumber: i + 1,
          racks: racksInThisBatch,
          lbs: lbsInThisBatch,
          lotNumber: `${lotPrefix}-${i + 1}`,
        });
        racksRemaining -= racksInThisBatch;
        lbsRemaining -= lbsInThisBatch;
      }
      setCookBatches(newBatches);
      onChange({
        lotPrefix,
        cookBatches: newBatches,
      });
    }
  }, []);

  const updateBatch = (idx, field, value) => {
    const updated = [...cookBatches];
    updated[idx] = { ...updated[idx], [field]: value };
    setCookBatches(updated);
    onChange({ lotPrefix, cookBatches: updated });
  };

  const updateLotPrefix = (newPrefix) => {
    setLotPrefix(newPrefix);
    const updated = cookBatches.map((b, i) => ({
      ...b,
      lotNumber: `${newPrefix}-${i + 1}`,
    }));
    setCookBatches(updated);
    onChange({ lotPrefix: newPrefix, cookBatches: updated });
  };

  const removeBatch = (idx) => {
    const updated = cookBatches.filter((_, i) => i !== idx);
    setCookBatches(updated);
    onChange({ lotPrefix, cookBatches: updated });
  };

  const totalRacks = cookBatches.reduce((s, b) => s + b.racks, 0);
  const totalLbsInBatches = cookBatches.reduce((s, b) => s + b.lbs, 0);

  return (
    <div className="space-y-4">
      <Card className="border-chart-1/30 bg-chart-1/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cook Batch Plan</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {totalRacks} racks ({totalLbsInBatches} lbs) → {cookBatches.length} cook batch{cookBatches.length !== 1 ? "es" : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Lot Prefix</Label>
            <Input
              value={lotPrefix}
              onChange={(e) => updateLotPrefix(e.target.value)}
              placeholder="e.g. RACK"
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">Lot numbers will be generated as {lotPrefix}-1, {lotPrefix}-2, etc.</p>
          </div>

          {cookBatches.length > 0 && (
            <div className="space-y-2 pt-2">
              {cookBatches.map((batch, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-white/50 p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Batch #{batch.batchNumber}</p>
                      <p className="text-xs text-muted-foreground">{batch.racks} racks × {LBS_PER_RACK} lbs = {batch.lbs} lbs</p>
                    </div>
                    {cookBatches.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBatch(idx)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Lot #</Label>
                      <Input
                        value={batch.lotNumber}
                        onChange={(e) => updateBatch(idx, "lotNumber", e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Racks</Label>
                        <Input
                          type="number"
                          min="1"
                          value={batch.racks}
                          onChange={(e) => {
                            const racks = parseInt(e.target.value) || 1;
                            updateBatch(idx, "racks", racks);
                            updateBatch(idx, "lbs", racks * LBS_PER_RACK);
                          }}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Total Lbs</Label>
                        <Input
                          type="number"
                          value={batch.lbs}
                          disabled
                          className="h-9 text-sm bg-muted/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalLbsInBatches !== totalLbs && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">
                Batch total {totalLbsInBatches} lbs vs input {totalLbs} lbs — adjust rack counts as needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}