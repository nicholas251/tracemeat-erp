import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Layers, Plus, Send, Combine } from "lucide-react";

const DEFAULT_LBS_PER_RACK = 320;

/**
 * RackReleaseBuilder
 *
 * Racking finishes ONE rack at a time. The operator taps "Release Rack" for each
 * rack (weight auto-filled to capacity, editable). Each released rack is sent to
 * the smokehouse individually — no cook-batch grouping here.
 *
 * Carry-over: a previous racking card may leave its LAST rack partially full. That
 * "open partial rack" is passed in via `openPartialRack` and pre-loaded here as
 * Rack #1, already holding the prior lot's lbs. The operator tops it up with this
 * batch's product, producing a multi-lot rack (lot_contributions). Whatever rack is
 * still not full at the end of THIS card is emitted back out as the new open partial.
 *
 * Each rack tracks `lot_contributions: [{ lot_number, lbs }]` so mixed-lot racks are
 * fully traceable.
 *
 * Emits a plan: {
 *   lotNumber,
 *   racks: [{ rackNumber, lbs, released, lot_contributions:[{lot_number,lbs}] }],
 *   openPartial: { lbs, lot_contributions } | null   // leftover not-full, not-released rack
 * }
 *
 * Props:
 *   totalLbs         – tumbled lbs entering racking (this batch)
 *   capacityLbs      – per-product rack capacity (falls back to 320)
 *   openPartialRack  – { lbs, lot_contributions:[{lot_number,lbs}] } | null carried from prior card
 *   plan             – current value | null
 *   onChange         – (plan) => void
 */
export default function RackReleaseBuilder({ totalLbs, capacityLbs, openPartialRack, plan, onChange }) {
  const RACK_CAP = Number(capacityLbs) > 0 ? Number(capacityLbs) : DEFAULT_LBS_PER_RACK;
  const [lotNumber, setLotNumber] = useState(plan?.lotNumber || "");

  // Build the initial rack layout. If an open partial rack was carried over, it
  // becomes Rack #1 (pre-filled with the prior lot's lbs); this batch's lbs fill
  // the rest, topping up that partial first.
  const [racks, setRacks] = useState(() => {
    if (plan?.racks) return plan.racks;

    const myLot = plan?.lotNumber || "";
    const built = [];
    let remaining = totalLbs;
    let rackNumber = 1;

    // Rack #1 = carried-over partial, if any
    if (openPartialRack && (openPartialRack.lbs || 0) > 0) {
      const room = Math.max(0, RACK_CAP - openPartialRack.lbs);
      const topUp = parseFloat(Math.min(room, remaining).toFixed(2));
      remaining = parseFloat((remaining - topUp).toFixed(2));
      const contributions = [...(openPartialRack.lot_contributions || [])];
      if (topUp > 0) contributions.push({ lot_number: myLot, lbs: topUp });
      built.push({
        rackNumber: rackNumber++,
        lbs: parseFloat((openPartialRack.lbs + topUp).toFixed(2)),
        released: false,
        lot_contributions: contributions,
        carried_over: true,
      });
    }

    // Remaining racks filled from this batch
    while (remaining > 0.001) {
      const rackLbs = parseFloat(Math.min(RACK_CAP, remaining).toFixed(2));
      remaining = parseFloat((remaining - rackLbs).toFixed(2));
      built.push({
        rackNumber: rackNumber++,
        lbs: rackLbs,
        released: false,
        lot_contributions: [{ lot_number: myLot, lbs: rackLbs }],
      });
    }

    if (built.length === 0) {
      built.push({
        rackNumber: 1,
        lbs: parseFloat(totalLbs.toFixed(2)),
        released: false,
        lot_contributions: [{ lot_number: myLot, lbs: parseFloat(totalLbs.toFixed(2)) }],
      });
    }
    return built;
  });

  // Compute the leftover open partial rack (last rack that is NOT full and NOT released).
  const computeOpenPartial = (rackList) => {
    const open = rackList.find(r => !r.released && r.lbs < RACK_CAP - 0.001 && r.lbs > 0);
    if (!open) return null;
    return {
      lbs: parseFloat(open.lbs.toFixed(2)),
      lot_contributions: open.lot_contributions || [],
    };
  };

  const sync = (nextRacks, nextLot) => {
    setRacks(nextRacks);
    onChange({
      lotNumber: nextLot,
      racks: nextRacks,
      openPartial: computeOpenPartial(nextRacks),
    });
  };

  // Re-stamp this batch's lot onto contributions that reference the current batch.
  const handleLotChange = (val) => {
    setLotNumber(val);
    const restamped = racks.map(r => ({
      ...r,
      lot_contributions: (r.lot_contributions || []).map(c =>
        // Only rename contributions that belonged to "this batch" (empty or previous self lot)
        c.lot_number === lotNumber || !c.lot_number ? { ...c, lot_number: val } : c
      ),
    }));
    sync(restamped, val);
  };

  const handleWeightChange = (rackNumber, lbs) => {
    sync(
      racks.map(r => {
        if (r.rackNumber !== rackNumber) return r;
        // Keep the contribution breakdown proportional-simple: adjust THIS batch's
        // contribution to absorb the weight change (carried-over lots stay fixed).
        const carriedLbs = (r.lot_contributions || [])
          .filter(c => c.lot_number !== lotNumber)
          .reduce((s, c) => s + (c.lbs || 0), 0);
        const myLbs = parseFloat(Math.max(0, lbs - carriedLbs).toFixed(2));
        const carried = (r.lot_contributions || []).filter(c => c.lot_number !== lotNumber);
        const contributions = myLbs > 0 ? [...carried, { lot_number: lotNumber, lbs: myLbs }] : carried;
        return { ...r, lbs, lot_contributions: contributions };
      }),
      lotNumber
    );
  };

  const releaseRack = (rackNumber) => {
    sync(racks.map(r => r.rackNumber === rackNumber ? { ...r, released: true } : r), lotNumber);
  };

  const addRack = () => {
    const nextNum = racks.length + 1;
    sync([...racks, {
      rackNumber: nextNum,
      lbs: RACK_CAP,
      released: false,
      lot_contributions: [{ lot_number: lotNumber, lbs: RACK_CAP }],
    }], lotNumber);
  };

  const releasedCount = racks.filter(r => r.released).length;
  const releasedLbs = parseFloat(racks.filter(r => r.released).reduce((s, r) => s + r.lbs, 0).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Carry-over notice */}
      {openPartialRack && (openPartialRack.lbs || 0) > 0 && (
        <div className="flex items-start gap-2 rounded-xl border-2 border-chart-3/30 bg-chart-3/5 px-3 py-2.5 text-xs text-chart-3">
          <Combine className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Carried over an open rack with <strong>{openPartialRack.lbs} lbs</strong> from the previous
            tumble (Lot {openPartialRack.lot_contributions?.[0]?.lot_number || "—"}). It's pre-loaded as
            Rack #1 below — top it up to fill it.
          </span>
        </div>
      )}

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
          Each released rack carries this lot so the smokehouse can identify it. Rack capacity: {RACK_CAP} lbs.
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
          {racks.map((rack) => {
            const isFull = rack.lbs >= RACK_CAP - 0.001;
            const isMixed = (rack.lot_contributions || []).filter(c => (c.lbs || 0) > 0).length > 1;
            return (
              <div
                key={rack.rackNumber}
                className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
                  rack.released
                    ? "bg-chart-2/5 border-chart-2/40"
                    : "bg-white border-border hover:border-chart-1/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      Rack #{rack.rackNumber}
                      {rack.carried_over && (
                        <Badge variant="secondary" className="text-[10px] gap-1 h-5"><Combine className="w-3 h-3" /> Carried over</Badge>
                      )}
                    </p>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {isFull ? "Standard capacity" : "Partial capacity"}
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

                {/* Multi-lot composition */}
                {isMixed && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-dashed">
                    {(rack.lot_contributions || []).filter(c => (c.lbs || 0) > 0).map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">
                        {c.lot_number || "—"}: {c.lbs} lbs
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

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