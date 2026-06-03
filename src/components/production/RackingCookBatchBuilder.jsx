import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Flame, RefreshCw, Layers } from "lucide-react";

const LBS_PER_RACK = 320;
const MAX_RACKS_PER_BATCH = 3;

export default function RackingCookBatchBuilder({ totalLbs, product, cookPlan, onChange }) {
  const [lotPrefix, setLotPrefix] = useState(cookPlan?.lotPrefix || "RACK");

  // 1. Individual physical racks and their confirmation status
  const [racks, setRacks] = useState(() => {
    if (cookPlan?.racks) return cookPlan.racks;
    const numRacks = Math.max(1, Math.ceil(totalLbs / LBS_PER_RACK));
    let remainingWeight = totalLbs;
    return Array.from({ length: numRacks }, (_, i) => {
      const rackWeight = Math.min(LBS_PER_RACK, remainingWeight);
      remainingWeight = parseFloat((remainingWeight - rackWeight).toFixed(2));
      return {
        id: `rack-${i + 1}-${Date.now()}`,
        rackNumber: i + 1,
        lbs: parseFloat(rackWeight.toFixed(2)),
        confirmed: false,
        batchNumber: null,
      };
    });
  });

  // 2. Completed/locked cook batches ready for ovens
  const [cookBatches, setCookBatches] = useState(cookPlan?.cookBatches || []);

  const syncPlan = (currentRacks, currentBatches, prefix) => {
    onChange({ lotPrefix: prefix, racks: currentRacks, cookBatches: currentBatches });
  };

  const handleWeightChange = (rackId, weight) => {
    const updated = racks.map((r) => (r.id === rackId ? { ...r, lbs: weight } : r));
    setRacks(updated);
    syncPlan(updated, cookBatches, lotPrefix);
  };

  const toggleConfirmRack = (rackId) => {
    const updated = racks.map((r) => (r.id === rackId ? { ...r, confirmed: !r.confirmed } : r));
    setRacks(updated);
    const confirmedUnassigned = updated.filter((r) => r.confirmed && !r.batchNumber);
    if (confirmedUnassigned.length >= MAX_RACKS_PER_BATCH) {
      assembleBatch(confirmedUnassigned.slice(0, MAX_RACKS_PER_BATCH), updated);
    } else {
      syncPlan(updated, cookBatches, lotPrefix);
    }
  };

  const assembleBatch = (racksToGroup, currentRacksList = racks) => {
    const nextBatchNum = cookBatches.length + 1;
    const batchLot = `${lotPrefix}-CB${nextBatchNum}`;
    const totalBatchLbs = parseFloat(racksToGroup.reduce((sum, r) => sum + r.lbs, 0).toFixed(2));

    const newBatch = {
      batchNumber: nextBatchNum,
      racks: racksToGroup.length,
      lbs: totalBatchLbs,
      lotNumber: batchLot,
      rackIds: racksToGroup.map((r) => r.id),
    };

    const updatedRacks = currentRacksList.map((r) =>
      racksToGroup.some((g) => g.id === r.id)
        ? { ...r, batchNumber: nextBatchNum, confirmed: true }
        : r
    );

    const updatedBatches = [...cookBatches, newBatch];
    setRacks(updatedRacks);
    setCookBatches(updatedBatches);
    syncPlan(updatedRacks, updatedBatches, lotPrefix);
  };

  const resetBatch = (batchNum) => {
    const updatedRacks = racks.map((r) =>
      r.batchNumber === batchNum ? { ...r, batchNumber: null, confirmed: false } : r
    );
    const updatedBatches = cookBatches
      .filter((b) => b.batchNumber !== batchNum)
      .map((b, idx) => ({ ...b, batchNumber: idx + 1, lotNumber: `${lotPrefix}-CB${idx + 1}` }));

    setRacks(updatedRacks);
    setCookBatches(updatedBatches);
    syncPlan(updatedRacks, updatedBatches, lotPrefix);
  };

  const handleLotPrefixChange = (newPrefix) => {
    setLotPrefix(newPrefix);
    const updatedBatches = cookBatches.map((b) => ({
      ...b,
      lotNumber: `${newPrefix}-CB${b.batchNumber}`,
    }));
    setCookBatches(updatedBatches);
    syncPlan(racks, updatedBatches, newPrefix);
  };

  const pendingConfirmedRacks = racks.filter((r) => r.confirmed && !r.batchNumber);
  const totalLbsInBatches = parseFloat(cookBatches.reduce((s, b) => s + b.lbs, 0).toFixed(2));

  return (
    <div className="space-y-4">
      {/* LOT CONFIG */}
      <div className="flex gap-4 items-end bg-card p-4 rounded-xl border">
        <div className="flex-1 space-y-1.5">
          <Label className="text-sm font-semibold">Cook Lot Prefix</Label>
          <Input
            value={lotPrefix}
            onChange={(e) => handleLotPrefixChange(e.target.value)}
            className="h-10 text-sm font-medium"
            placeholder="e.g. RACK"
          />
        </div>
        <div className="text-xs text-muted-foreground pb-2 max-w-xs">
          Oven batches generated as <strong>{lotPrefix}-CB1</strong>, <strong>{lotPrefix}-CB2</strong>, etc.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT: ACTIVE RACK TRACKING */}
        <Card className="shadow-sm border">
          <CardHeader className="py-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-chart-1" />
              Racks to Process ({racks.filter((r) => !r.batchNumber).length} active)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {racks.map((rack) => {
              const isAssigned = rack.batchNumber !== null;
              return (
                <div
                  key={rack.id}
                  className={`flex flex-col p-3 rounded-lg border-2 transition-all ${
                    isAssigned
                      ? "bg-slate-50 border-slate-200/60 opacity-60"
                      : rack.confirmed
                      ? "bg-chart-2/5 border-chart-2/40"
                      : "bg-white border-border hover:border-chart-1/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm">Rack #{rack.rackNumber}</p>
                      {isAssigned ? (
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          Assigned to Cook Batch #{rack.batchNumber}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {rack.lbs === LBS_PER_RACK ? "Standard Capacity" : "Partial Capacity"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-background border px-2 py-1 rounded">
                        <input
                          type="number"
                          step="0.1"
                          disabled={isAssigned || rack.confirmed}
                          value={rack.lbs}
                          onChange={(e) => handleWeightChange(rack.id, parseFloat(e.target.value) || 0)}
                          className="w-16 h-6 text-sm text-right font-bold bg-transparent border-0 focus:outline-none focus:ring-0"
                        />
                        <span className="text-xs text-muted-foreground font-semibold">lbs</span>
                      </div>

                      {!isAssigned && (
                        <Button
                          variant={rack.confirmed ? "secondary" : "default"}
                          size="sm"
                          onClick={() => toggleConfirmRack(rack.id)}
                          className="h-8 text-xs font-semibold gap-1.5"
                        >
                          {rack.confirmed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-chart-2" />
                              Confirmed
                            </>
                          ) : (
                            "Confirm"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* RIGHT: COOK BATCH CONSOLIDATION */}
        <Card className="shadow-sm border">
          <CardHeader className="py-4 border-b bg-slate-50/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Flame className="w-4 h-4 text-chart-3" />
              Assembled Cook Batches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* MANUAL ASSEMBLY PROMPT */}
            {pendingConfirmedRacks.length > 0 && (
              <div className="p-3 bg-chart-3/5 border-2 border-chart-3/30 rounded-xl space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-chart-3 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Custom Cook Batch Assembly</p>
                    <p className="text-[11px] text-muted-foreground">
                      You have {pendingConfirmedRacks.length} confirmed rack(s) ready. Assemble a custom batch now, or wait for 3 to auto-group.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => assembleBatch(pendingConfirmedRacks)}
                  className="w-full bg-chart-3 text-white hover:bg-chart-3/95 h-9 font-bold text-xs"
                >
                  Confirm Cook Batch ({pendingConfirmedRacks.length} Rack{pendingConfirmedRacks.length > 1 ? "s" : ""})
                </Button>
              </div>
            )}

            {cookBatches.length === 0 && pendingConfirmedRacks.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground italic">
                Confirm racks on the left to start building cook batches.
              </div>
            )}

            {/* LIST OF FINALIZED COOK BATCHES */}
            <div className="space-y-3">
              {cookBatches.map((batch) => (
                <div
                  key={batch.batchNumber}
                  className="p-3.5 border-2 border-slate-200 bg-white rounded-xl shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 h-1.5 w-16 bg-chart-2"></div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge
                        variant="outline"
                        className="bg-chart-2/5 border-chart-2/20 font-bold mb-1"
                      >
                        Cook Batch #{batch.batchNumber}
                      </Badge>
                      <h4 className="font-mono text-sm font-bold tracking-tight text-slate-800">
                        {batch.lotNumber}
                      </h4>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetBatch(batch.batchNumber)}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-semibold gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Edit / Reset
                    </Button>
                  </div>

                  <div className="flex justify-between items-baseline pt-2 border-t text-sm">
                    <span className="text-muted-foreground text-xs font-medium">
                      {batch.racks} Physical Rack(s)
                    </span>
                    <span className="font-bold text-slate-900 text-base">{batch.lbs} lbs total</span>
                  </div>
                </div>
              ))}
            </div>

            {/* WEIGHT MATCH WARNING */}
            {totalLbsInBatches !== totalLbs && (
              <div className="flex items-start gap-2.5 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-yellow-800">
                  Batch weight ({totalLbsInBatches} lbs) does not match total starting weight ({totalLbs} lbs). Confirm or adjust rack weights to reconcile the yield.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}