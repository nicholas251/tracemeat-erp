import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Layers, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const RACKS_PER_COOK_BATCH = 3;

/**
 * Calculates cook batches from tumble output.
 * - lbsPerBatch: total lbs loaded per tumble batch
 * - lbsPerRack: how many lbs fit on 1 rack
 * - 3 racks = 1 cook batch
 */
function calcCookBatches(totalLbs, lbsPerBatch, lbsPerRack) {
  if (!lbsPerBatch || !lbsPerRack || lbsPerBatch <= 0 || lbsPerRack <= 0) return [];

  const racksPerBatch = Math.floor(lbsPerBatch / lbsPerRack);
  const cookBatchesPerTumbleBatch = Math.floor(racksPerBatch / RACKS_PER_COOK_BATCH);
  const tumbleBatches = Math.ceil(totalLbs / lbsPerBatch);

  const batches = [];
  let remaining = totalLbs;

  for (let t = 0; t < tumbleBatches; t++) {
    const thisBatchLbs = Math.min(lbsPerBatch, remaining);
    const thisRacks = Math.ceil(thisBatchLbs / lbsPerRack);
    const thisCookBatches = Math.max(1, Math.floor(thisRacks / RACKS_PER_COOK_BATCH));

    for (let c = 0; c < thisCookBatches; c++) {
      const racksInThis = c < thisCookBatches - 1 ? RACKS_PER_COOK_BATCH : (thisRacks - c * RACKS_PER_COOK_BATCH);
      const lbsInThis = Math.min(racksInThis * lbsPerRack, thisBatchLbs);
      batches.push({
        cookBatchNum: batches.length + 1,
        tumbleBatchNum: t + 1,
        racks: Math.min(racksInThis, RACKS_PER_COOK_BATCH),
        lbs: parseFloat(lbsInThis.toFixed(2)),
      });
    }
    remaining -= thisBatchLbs;
  }

  return batches;
}

/**
 * Props:
 *   totalLbs   – stage input_qty_lbs
 *   cookPlan   – { lbsPerBatch, lbsPerRack, cookBatches, lotPrefix } | null
 *   onChange   – (cookPlan | null) => void
 */
export default function TumbleCookBatchBuilder({ totalLbs, cookPlan, onChange }) {
  const [lbsPerBatch, setLbsPerBatch] = useState(cookPlan?.lbsPerBatch || "");
  const [lbsPerRack, setLbsPerRack] = useState(cookPlan?.lbsPerRack || "");
  const [lotPrefix, setLotPrefix] = useState(cookPlan?.lotPrefix || "");

  const batches = lbsPerBatch && lbsPerRack
    ? calcCookBatches(totalLbs, Number(lbsPerBatch), Number(lbsPerRack))
    : [];

  const handleBuild = () => {
    if (batches.length === 0) return;
    const today = format(new Date(), "yyyyMMdd");
    const prefix = lotPrefix.trim() || `COOK-${today}`;
    onChange({
      lbsPerBatch: Number(lbsPerBatch),
      lbsPerRack: Number(lbsPerRack),
      lotPrefix: prefix,
      cookBatches: batches.map((b, i) => ({
        ...b,
        lotNumber: `${prefix}-${i + 1}`,
      })),
    });
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-chart-1" />
        <Label className="font-semibold">Cook Batch Assembly</Label>
      </div>

      {!cookPlan ? (
        <>
          <p className="text-xs text-muted-foreground">
            Enter batch size and rack capacity. Every 3 racks = 1 cook batch for the smokehouse.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Lbs per Tumble Batch</Label>
              <Input
                type="number"
                step="0.1"
                value={lbsPerBatch}
                onChange={e => setLbsPerBatch(e.target.value)}
                placeholder="e.g. 300"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lbs per Rack</Label>
              <Input
                type="number"
                step="0.1"
                value={lbsPerRack}
                onChange={e => setLbsPerRack(e.target.value)}
                placeholder="e.g. 100"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Lot # Prefix (optional — auto-generated if blank)</Label>
            <Input
              value={lotPrefix}
              onChange={e => setLotPrefix(e.target.value)}
              placeholder={`e.g. COOK-${format(new Date(), "yyyyMMdd")}`}
              className="h-8 text-sm"
            />
          </div>

          {/* Live preview */}
          {batches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Preview — {batches.length} cook batch{batches.length !== 1 ? "es" : ""}
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {batches.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-xs rounded border bg-background px-2.5 py-1.5">
                    <span className="font-medium">Cook Batch #{b.cookBatchNum}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{b.racks} racks</Badge>
                      <Badge variant="outline" className="text-xs">{b.lbs} lbs</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" className="w-full gap-1.5 mt-1" onClick={handleBuild}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirm {batches.length} Cook Batch{batches.length !== 1 ? "es" : ""}
              </Button>
            </div>
          )}

          {lbsPerBatch && lbsPerRack && batches.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-destructive p-2 bg-destructive/5 rounded">
              <AlertCircle className="w-3.5 h-3.5" />
              Could not calculate batches — check values.
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border border-chart-2/40 bg-chart-2/8 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-chart-2" />
              <span className="font-semibold text-sm text-chart-2">
                {cookPlan.cookBatches.length} Cook Batch{cookPlan.cookBatches.length !== 1 ? "es" : ""} Ready
              </span>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {cookPlan.cookBatches.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{b.lotNumber}</span>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-xs">{b.racks} racks</Badge>
                    <Badge variant="outline" className="text-xs">{b.lbs} lbs</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleClear} className="w-full text-xs">
            Change Configuration
          </Button>
        </div>
      )}
    </div>
  );
}