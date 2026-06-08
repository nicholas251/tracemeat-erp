import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Layers, Plus, Send, Combine, Trash2 } from "lucide-react";

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
export default function RackReleaseBuilder({ totalLbs, capacityLbs, openPartialRack, persistedRacks = [], onReleaseRack, onDiscardPartial, plan, onChange }) {
  const RACK_CAP = Number(capacityLbs) > 0 ? Number(capacityLbs) : DEFAULT_LBS_PER_RACK;
  const [lotNumber, setLotNumber] = useState(plan?.lotNumber || persistedRacks?.[0]?.lot_number || "");
  const [releasing, setReleasing] = useState(null); // rackNumber currently being persisted

  // Build the initial rack layout. If an open partial rack was carried over, it
  // becomes Rack #1 (pre-filled with the prior lot's lbs); this batch's lbs fill
  // the rest, topping up that partial first.
  const [racks, setRacks] = useState(() => {
    if (plan?.racks) return plan.racks;

    const myLot = plan?.lotNumber || persistedRacks?.[0]?.lot_number || "";
    const built = [];
    let remaining = totalLbs;
    let rackNumber = 1;

    // Racks already released to the smokehouse for this card → pre-mark as released.
    if (persistedRacks && persistedRacks.length > 0) {
      const sorted = persistedRacks.slice().sort((a, b) => (a.rack_number || 0) - (b.rack_number || 0));
      for (const r of sorted) {
        built.push({
          rackNumber: r.rack_number,
          lbs: parseFloat((r.lbs || 0).toFixed(2)),
          released: true,
          persisted: true,
          lot_contributions: r.lot_contributions?.length
            ? r.lot_contributions
            : [{ lot_number: r.lot_number || "", lbs: parseFloat((r.lbs || 0).toFixed(2)) }],
        });
        rackNumber = Math.max(rackNumber, (r.rack_number || 0) + 1);
      }
      // The persisted racks already account for some of this batch's weight.
      const persistedLbs = sorted.reduce((s, r) => s + (r.lbs || 0), 0);
      remaining = parseFloat(Math.max(0, totalLbs - persistedLbs).toFixed(2));
      // Fill any remaining weight into new unreleased racks.
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
      return built;
    }

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

  // openPartialRack resolves AFTER mount (it comes from an async order query). If the
  // initial state was built before it arrived, Rack #1 won't be pre-loaded with the
  // carried-over leftover. When it shows up (and nothing's been released/persisted yet),
  // rebuild the layout so the next batch auto-fills the carried-over partial as Rack #1.
  useEffect(() => {
    if (!openPartialRack || (openPartialRack.lbs || 0) <= 0) return;
    if (persistedRacks && persistedRacks.length > 0) return; // handled by the persisted effect
    if (racks.some(r => r.carried_over || r.released || r.persisted)) return; // already reflected

    const myLot = lotNumber || "";
    const built = [];
    let remaining = totalLbs;
    let rackNumber = 1;

    // Rack #1 = carried-over partial, topped up with this batch's product first.
    const room = Math.max(0, RACK_CAP - openPartialRack.lbs);
    const topUp = parseFloat(Math.min(room, remaining).toFixed(2));
    remaining = parseFloat((remaining - topUp).toFixed(2));
    const contributions = [...(openPartialRack.lot_contributions || [])];
    if (topUp > 0) contributions.push({ lot_number: myLot, lbs: topUp });
    built.push({
      rackNumber: rackNumber++,
      lbs: parseFloat((openPartialRack.lbs + topUp).toFixed(2)),
      released: false,
      carried_over: true,
      lot_contributions: contributions,
    });

    while (remaining > 0.001) {
      const rackLbs = parseFloat(Math.min(RACK_CAP, remaining).toFixed(2));
      remaining = parseFloat((remaining - rackLbs).toFixed(2));
      built.push({ rackNumber: rackNumber++, lbs: rackLbs, released: false, lot_contributions: [{ lot_number: myLot, lbs: rackLbs }] });
    }
    sync(built, myLot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPartialRack]);

  // persistedRacks can resolve AFTER mount (async query). If they arrive and none of
  // our current racks are marked persisted yet, rebuild the layout to show them released.
  useEffect(() => {
    if (!persistedRacks || persistedRacks.length === 0) return;
    if (racks.some(r => r.persisted)) return; // already reflected

    const sorted = persistedRacks.slice().sort((a, b) => (a.rack_number || 0) - (b.rack_number || 0));
    const built = sorted.map(r => ({
      rackNumber: r.rack_number,
      lbs: parseFloat((r.lbs || 0).toFixed(2)),
      released: true,
      persisted: true,
      lot_contributions: r.lot_contributions?.length
        ? r.lot_contributions
        : [{ lot_number: r.lot_number || "", lbs: parseFloat((r.lbs || 0).toFixed(2)) }],
    }));

    // The persisted racks consume some of this batch's weight. If a partial rack was
    // carried over, its lbs belong to the PREVIOUS batch and must NOT count against
    // this batch's remaining weight — preserve it as an unreleased Rack so it isn't
    // dropped on reopen (#2/#3).
    const persistedLbs = sorted.reduce((s, r) => s + (r.lbs || 0), 0);
    const carriedLbs = persistedRacks.some(r => r.persisted) ? 0 : (openPartialRack?.lbs || 0);
    // Has the carried partial already been persisted (its lot already on a released rack)?
    const carriedLot = openPartialRack?.lot_contributions?.[0]?.lot_number;
    const carriedAlreadyPersisted = carriedLot
      ? sorted.some(r => (r.lot_contributions || []).some(c => c.lot_number === carriedLot))
      : false;

    let rackNumber = Math.max(...sorted.map(r => r.rack_number || 0)) + 1;
    const myLot = lotNumber || "";

    // Re-insert the carried-over partial (if any) that hasn't been released yet.
    let remaining = totalLbs;
    if (openPartialRack && (openPartialRack.lbs || 0) > 0 && !carriedAlreadyPersisted) {
      const room = Math.max(0, RACK_CAP - openPartialRack.lbs);
      const topUp = parseFloat(Math.min(room, Math.max(0, totalLbs - persistedLbs)).toFixed(2));
      const contributions = [...(openPartialRack.lot_contributions || [])];
      if (topUp > 0) contributions.push({ lot_number: myLot, lbs: topUp });
      built.push({
        rackNumber: rackNumber++,
        lbs: parseFloat((openPartialRack.lbs + topUp).toFixed(2)),
        released: false,
        carried_over: true,
        lot_contributions: contributions,
      });
      remaining = parseFloat((totalLbs - persistedLbs - topUp).toFixed(2));
    } else {
      remaining = parseFloat(Math.max(0, totalLbs - persistedLbs).toFixed(2));
    }

    while (remaining > 0.001) {
      const rackLbs = parseFloat(Math.min(RACK_CAP, remaining).toFixed(2));
      remaining = parseFloat((remaining - rackLbs).toFixed(2));
      built.push({ rackNumber: rackNumber++, lbs: rackLbs, released: false, lot_contributions: [{ lot_number: myLot, lbs: rackLbs }] });
    }
    sync(built, myLot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedRacks]);

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

  const releaseRack = async (rackNumber) => {
    // Guardrail: ignore taps while ANY release is in-flight, and never re-release a
    // rack that's already released/persisted. Prevents double-send on rapid taps.
    if (releasing !== null) return;
    const rack = racks.find(r => r.rackNumber === rackNumber);
    if (!rack || rack.released || rack.persisted) return;
    // Releasing a non-full rack means it won't be carried over to top up later. Confirm.
    if (rack.lbs < RACK_CAP - 0.001) {
      const ok = window.confirm(
        `Rack #${rackNumber} is only ${rack.lbs.toFixed(1)} / ${RACK_CAP} lbs. ` +
        `Releasing it now sends it to the smokehouse partially full (it won't carry over to the next batch). Release anyway?`
      );
      if (!ok) return;
    }
    setReleasing(rackNumber);
    try {
      // Persist this single rack to the smokehouse right now, so it survives closing the card.
      if (onReleaseRack) await onReleaseRack(rack, lotNumber);
      sync(racks.map(r => r.rackNumber === rackNumber ? { ...r, released: true, persisted: true } : r), lotNumber);
    } finally {
      setReleasing(null);
    }
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

  // Discard the carried-over partial rack: drop it from the card and clear it on the order
  // so it stops re-appearing. Used when there's nothing left to top it up with.
  const discardCarriedOver = async () => {
    const ok = window.confirm(
      `Discard the carried-over rack (${openPartialRack?.lbs || 0} lbs from a previous tumble)? ` +
      `It will be removed from this card and won't carry over again.`
    );
    if (!ok) return;
    if (onDiscardPartial) await onDiscardPartial();
    sync(racks.filter(r => !r.carried_over), lotNumber);
  };

  const hasCarriedOver = racks.some(r => r.carried_over && !r.released);
  const anyReleased = racks.some(r => r.released);
  const releasedCount = racks.filter(r => r.released).length;
  const releasedLbs = parseFloat(racks.filter(r => r.released).reduce((s, r) => s + r.lbs, 0).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Carry-over notice */}
      {openPartialRack && (openPartialRack.lbs || 0) > 0 && hasCarriedOver && (
        <div className="rounded-xl border-2 border-chart-3/30 bg-chart-3/5 px-3 py-2.5 text-xs text-chart-3 space-y-2">
          <div className="flex items-start gap-2">
            <Combine className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Carried over an open rack with <strong>{openPartialRack.lbs} lbs</strong> from the previous
              tumble (Lot {openPartialRack.lot_contributions?.[0]?.lot_number || "—"}). It's pre-loaded as
              Rack #1 below — top it up to fill it, or discard it if there's nothing left to add.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={discardCarriedOver}
            className="h-7 text-xs gap-1.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" /> Discard carried-over rack
          </Button>
        </div>
      )}

      {/* Lot identification */}
      <div className="bg-card p-4 rounded-xl border space-y-1.5">
        <Label className="text-sm font-semibold">Racking Lot # (for traceability)</Label>
        <Input
          value={lotNumber}
          disabled={anyReleased}
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
                        variant={isFull ? "default" : "destructive"}
                        disabled={releasing !== null}
                        onClick={() => releaseRack(rack.rackNumber)}
                        className="h-8 text-xs font-semibold gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {releasing === rack.rackNumber ? "Sending…" : "Release Rack"}
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