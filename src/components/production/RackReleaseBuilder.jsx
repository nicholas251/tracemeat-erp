import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Layers, Plus, Send } from "lucide-react";

const LBS_PER_RACK = 320;

/**
 * RackReleaseBuilder
 *
 * Racking now finishes ONE rack at a time. The operator taps "Release Rack" for each
 * rack (weight auto-filled to the standard 320 lbs, editable). Each released rack is
 * sent to the smokehouse individually — no cook-batch grouping happens here.
 *
 * Emits a plan: { lotNumber, racks: [{ rackNumber, lbs, released }] }
 * The StageWizard turns each released rack into an individual RackUnit record.
 *
 * Props:
 *   totalLbs  – tumbled lbs entering racking
 *   plan      – current value | null
 *   onChange  – (plan) => void
 */
export default function RackReleaseBuilder({ totalLbs, plan, onChange }) {
  const [lotNumber, setLotNumber] = useState(plan?.lotNumber || "");

  const [racks, setRacks] = useState(() => {
    if (plan?.racks) return plan.racks;
    const numRacks = Math.max(1, Math.ceil(totalLbs / LBS_PER_RACK));
    let remaining = totalLbs;
    return Array.from({ length: numRacks }, (_, i) => {
      const rackLbs = Math.min(LBS_PER_RACK, remaining);
      remaining = parseFloat((remaining - rackLbs).toFixed(2));
      return {
        rackNumber: i + 1,
        lbs: parseFloat(rackLbs.toFixed(2)),
        released: false,
      };
    });
  });

  const sync = (nextRacks, nextLot) => {
    setRacks(nextRacks);
    onChange({ lotNumber: nextLot, racks: nextRacks });
  };

  const handleLotChange = (val) => {
    setLotNumber(val);
    onChange({ lotNumber: val, racks });
  };

  const handleWeightChange = (rackNumber, lbs) => {
    sync(racks.map(r => r.rackNumber === rackNumber ? { ...r, lbs } : r), lotNumber);
  };

  const releaseRack = (rackNumber) => {
    sync(racks.map(r => r.rackNumber === rackNumber ? { ...r, released: true } : r), lotNumber);
  };

  const addRack = () => {
    const nextNum = racks.length + 1;
    sync([...racks, { rackNumber: nextNum, lbs: LBS_PER_RACK, released: false }], lotNumber);
  };

  const releasedCount = racks.filter(r => r.released).length;
  const releasedLbs = parseFloat(racks.filter(r => r.released).reduce((s, r) => s + r.lbs, 0).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Lot identification */}
      <div className="bg-card p-4 rounded-xl border space-y-1.5">
        <Label className="text-sm font-semibold">Racking Lot # (for traceability)</Label>
        <Input
          value={lotNumber}
          onChange={(e) => handleLotChange(e.target.value)}
          placeholder="e.g. TUMBLE-20240601-B1"
          className="h-10 text-sm font-medium"
        />
        <p className="text-[11px] text-muted-foreground">
          Each released rack carries this lot so the smokehouse can identify it.
        </p>
      </div>

      <Card className="shadow-sm border">
        <CardHeader className="py-4 border-b flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Layers className="w-4 h-4 text-chart-1" />
            Racks ({releasedCount}/{racks.length} released)
          </CardTitle>
          <Badge variant="outline" className="text-xs">{releasedLbs} lbs released</Badge>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          {racks.map((rack) => (
            <div
              key={rack.rackNumber}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border-2 transition-all ${
                rack.released
                  ? "bg-chart-2/5 border-chart-2/40"
                  : "bg-white border-border hover:border-chart-1/30"
              }`}
            >
              <div>
                <p className="font-bold text-sm">Rack #{rack.rackNumber}</p>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {rack.lbs === LBS_PER_RACK ? "Standard capacity" : "Partial capacity"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-background border px-2 py-1 rounded">
                  <input
                    type="number"
                    step="0.1"
                    disabled={rack.released}
                    value={rack.lbs}
                    onChange={(e) => handleWeightChange(rack.rackNumber, parseFloat(e.target.value) || 0)}
                    className="w-16 h-6 text-sm text-right font-bold bg-transparent border-0 focus:outline-none focus:ring-0"
                  />
                  <span className="text-xs text-muted-foreground font-semibold">lbs</span>
                </div>

                {rack.released ? (
                  <Badge className="bg-chart-2/15 text-chart-2 border-chart-2/30 border gap-1 h-8">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Released
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => releaseRack(rack.rackNumber)}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Release Rack
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addRack}
            className="w-full h-9 text-xs font-semibold gap-1.5 mt-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Rack
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}