import React, { useState, useEffect } from "react";
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
 * Racking finishes ONE rack at a time. Full racks have a single "Release Rack"
 * action that sends them to the smokehouse individually.
 *
 * The LAST rack on a card is often partial (not full). The operator decides what
 * happens to it with TWO explicit buttons:
 *   • "Carry Over" — hand this partial forward to the NEXT racking card, where it
 *     pre-loads as Rack #1 and gets topped up. Nothing is sent to the smokehouse.
 *   • "Release"    — send the partial to the smokehouse now as a short rack (used on
 *     the very last card, when there is no next card to top it up).
 * This keeps partials from being stranded in limbo.
 *
 * A previous card may hand THIS card a carried partial via `openPartialRack`. It is
 * pre-loaded as Rack #1 (already holding the prior lot's lbs) and topped up with this
 * batch's product → a multi-lot rack (lot_contributions) for full traceability.
 *
 * Emits a plan: {
 *   lotNumber,
 *   racks: [{ rackNumber, lbs, released, lot_contributions:[{lot_number,lbs}] }],
 *   carriedPartial: { lbs, lot_contributions } | null   // partial the operator chose to carry over
 * }
 *
 * Props:
 *   totalLbs         – tumbled lbs entering racking (this batch)
 *   capacityLbs      – per-product rack capacity (falls back to 320)
 *   openPartialRack  – { lbs, lot_contributions:[{lot_number,lbs}] } | null carried from prior card
 *   defaultLot       – default racking lot (e.g. the tumble input lot) for fresh cards
 *   plan             – current value | null
 *   onChange         – (plan) => void
 */
export default function RackReleaseBuilder({ totalLbs, capacityLbs, openPartialRack, defaultLot = "", persistedRacks = [], onReleaseRack, plan, onChange }) {
  const RACK_CAP = Number(capacityLbs) > 0 ? Number(capacityLbs) : DEFAULT_LBS_PER_RACK;
  const initialLot = plan?.lotNumber || persistedRacks?.[0]?.lot_number || defaultLot || "";
  const [lotNumber, setLotNumber] = useState(initialLot);
  const [releasing, setReleasing] = useState(null); // rackNumber currently being persisted
  const [carriedOver, setCarriedOver] = useState(plan?.carriedPartial || null);

  // Build the initial rack layout. If an open partial rack was carried over from the
  // prior card, it becomes Rack #1 (pre-filled with the prior lot's lbs); this batch's
  // lbs fill the rest, topping up that partial first.
  const [racks, setRacks] = useState(() => {
    if (plan?.racks) return plan.racks;

    const myLot = initialLot;
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
      const persistedLbs = sorted.reduce((s, r) => s + (r.lbs || 0), 0);
      remaining = parseFloat(Math.max(0, totalLbs - persistedLbs).toFixed(2));
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

  // openPartialRack resolves AFTER mount (async order query). If the initial state was
  // built before it arrived, rebuild so Rack #1 pre-loads the carried-over leftover.
  useEffect(() => {
    if (!openPartialRack || (openPartialRack.lbs || 0) <= 0) return;
    if (persistedRacks && persistedRacks.length > 0) return;
    if (racks.some(r => r.carried_over || r.released || r.persisted)) return;

    const myLot = lotNumber || "";
    const built = [];
    let remaining = totalLbs;
    let rackNumber = 1;

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
    sync(built, myLot, carriedOver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPartialRack]);

  // persistedRacks can resolve AFTER mount (async query). Rebuild to show them released.
  useEffect(() => {
    if (!persistedRacks || persistedRacks.length === 0) return;
    if (racks.some(r => r.persisted)) return;

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

    const persistedLbs = sorted.reduce((s, r) => s + (r.lbs || 0), 0);
    const carriedLot = openPartialRack?.lot_contributions?.[0]?.lot_number;
    const carriedAlreadyPersisted = carriedLot
      ? sorted.some(r => (r.lot_contributions || []).some(c => c.lot_number === carriedLot))
      : false;

    let rackNumber = Math.max(...sorted.map(r => r.rack_number || 0)) + 1;
    const myLot = lotNumber || "";

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
    sync(built, myLot, carriedOver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedRacks]);

  // The trailing partial = last rack that is NOT full, NOT released, NOT yet carried over.
  const computeTrailingPartial = (rackList) => {
    const open = rackList.find(r => !r.released && !r.carried_away && r.lbs < RACK_CAP - 0.001 && r.lbs > 0);
    if (!open) return null;
    return open;
  };

  const sync = (nextRacks, nextLot, nextCarried) => {
    setRacks(nextRacks);
    onChange({
      lotNumber: nextLot,
      racks: nextRacks,
      carriedPartial: nextCarried || null,
    });
  };

  const handleLotChange = (val) => {
    setLotNumber(val);
    const restamped = racks.map(r => ({
      ...r,
      lot_contributions: (r.lot_contributions || []).map(c =>
        c.lot_number === lotNumber || !c.lot_number ? { ...c, lot_number: val } : c
      ),
    }));
    sync(restamped, val, carriedOver);
  };

  const handleWeightChange = (rackNumber, lbs) => {
    sync(
      racks.map(r => {
        if (r.rackNumber !== rackNumber) return r;
        const carriedLbs = (r.lot_contributions || [])
          .filter(c => c.lot_number !== lotNumber)
          .reduce((s, c) => s + (c.lbs || 0), 0);
        const myLbs = parseFloat(Math.max(0, lbs - carriedLbs).toFixed(2));
        const carried = (r.lot_contributions || []).filter(c => c.lot_number !== lotNumber);
        const contributions = myLbs > 0 ? [...carried, { lot_number: lotNumber, lbs: myLbs }] : carried;
        return { ...r, lbs, lot_contributions: contributions };
      }),
      lotNumber,
      carriedOver
    );
  };

  const releaseRack = async (rackNumber) => {
    if (releasing !== null) return;
    const rack = racks.find(r => r.rackNumber === rackNumber);
    if (!rack || rack.released || rack.persisted) return;
    setReleasing(rackNumber);
    try {
      if (onReleaseRack) await onReleaseRack(rack, lotNumber);
      sync(racks.map(r => r.rackNumber === rackNumber ? { ...r, released: true, persisted: true } : r), lotNumber, carriedOver);
    } finally {
      setReleasing(null);
    }
  };

  // Carry the trailing partial forward to the NEXT racking card. It leaves this card
  // (marked carried_away so it no longer blocks completion) and is emitted in the plan
  // as carriedPartial for StageWizard to write onto the next card.
  const carryOverRack = (rackNumber) => {
    const rack = racks.find(r => r.rackNumber === rackNumber);
    if (!rack || rack.released || rack.persisted) return;
    const carried = {
      lbs: parseFloat((rack.lbs || 0).toFixed(2)),
      lot_contributions: (rack.lot_contributions || []).filter(c => (c.lbs || 0) > 0),
    };
    setCarriedOver(carried);
    sync(
      racks.map(r => r.rackNumber === rackNumber ? { ...r, carried_away: true } : r),
      lotNumber,
      carried
    );
  };

  const undoCarryOver = (rackNumber) => {
    setCarriedOver(null);
    sync(
      racks.map(r => r.rackNumber === rackNumber ? { ...r, carried_away: false } : r),
      lotNumber,
      null
    );
  };

  const addRack = () => {
    const nextNum = racks.length + 1;
    sync([...racks, {
      rackNumber: nextNum,
      lbs: RACK_CAP,
      released: false,
      lot_contributions: [{ lot_number: lotNumber, lbs: RACK_CAP }],
    }], lotNumber, carriedOver);
  };

  const anyReleased = racks.some(r => r.released);
  const releasedCount = racks.filter(r => r.released).length;
  const releasedLbs = parseFloat(racks.filter(r => r.released).reduce((s, r) => s + r.lbs, 0).toFixed(2));
  const trailingPartial = computeTrailingPartial(racks);

  return (
    <div className="space-y-4">
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
            const isTrailingPartial = !isFull && !rack.released && trailingPartial?.rackNumber === rack.rackNumber;
            return (
              <div
                key={rack.rackNumber}
                className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
                  rack.released
                    ? "bg-chart-2/5 border-chart-2/40"
                    : rack.carried_away
                      ? "bg-chart-1/5 border-chart-1/40"
                      : "bg-white border-border hover:border-chart-1/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      Rack #{rack.rackNumber}
                      {rack.carried_over && (
                        <Badge variant="secondary" className="text-[10px] gap-1 h-5"><Combine className="w-3 h-3" /> Carried in</Badge>
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
                        disabled={rack.released || rack.carried_away}
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
                    ) : rack.carried_away ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => undoCarryOver(rack.rackNumber)}
                        className="h-8 text-xs font-semibold gap-1.5"
                      >
                        <Combine className="w-3.5 h-3.5" /> Carried — Undo
                      </Button>
                    ) : isTrailingPartial ? (
                      // Trailing partial: TWO explicit choices.
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => carryOverRack(rack.rackNumber)}
                          className="h-8 text-xs font-semibold gap-1.5"
                        >
                          <Combine className="w-3.5 h-3.5" /> Carry Over
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={releasing !== null}
                          onClick={() => releaseRack(rack.rackNumber)}
                          className="h-8 text-xs font-semibold gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {releasing === rack.rackNumber ? "Sending…" : "Release"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
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

          {trailingPartial && (
            <div className="rounded-lg border border-chart-1/30 bg-chart-1/5 px-3 py-2 text-[11px] text-chart-1 flex items-start gap-2">
              <Combine className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Rack #{trailingPartial.rackNumber} is partial ({trailingPartial.lbs} lbs).
                Tap <b>Carry Over</b> to top it up on the next card, or <b>Release</b> to send it
                to the smokehouse now (use Release on the final batch).
              </span>
            </div>
          )}

          {carriedOver && (
            <div className="rounded-lg border border-chart-1/40 bg-chart-1/10 px-3 py-2 text-[11px] text-chart-1 flex items-start gap-2">
              <Combine className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {carriedOver.lbs} lbs will carry over to the next racking card. You can complete this card now.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}