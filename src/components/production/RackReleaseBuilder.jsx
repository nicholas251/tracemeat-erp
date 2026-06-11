import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Layers, Plus, Send, Combine } from "lucide-react";

const DEFAULT_LBS_PER_RACK = 320;

// Single source of truth for laying out a card's racks.
// 1. Keep racks already released to the smokehouse for this card.
// 2. Pre-load any carried-over partial as Rack #1 and TOP IT UP to capacity FIRST.
// 3. Pack the rest into as many FULL racks as possible.
// 4. Only ONE trailing partial may remain (the final leftover) — middle racks are
//    always full, so partials only ever appear on the first (carried-in) and last cards.
function buildRacks({ totalLbs, rackCap, openPartialRack, persistedRacks, myLot }) {
  const built = [];
  let rackNumber = 1;
  let remaining = parseFloat((totalLbs || 0).toFixed(2));

  const sortedPersisted = (persistedRacks || []).slice().sort((a, b) => (a.rack_number || 0) - (b.rack_number || 0));
  let persistedLbs = 0;
  for (const r of sortedPersisted) {
    built.push({
      rackNumber: r.rack_number,
      lbs: parseFloat((r.lbs || 0).toFixed(2)),
      released: true,
      persisted: true,
      lot_contributions: r.lot_contributions?.length
        ? r.lot_contributions
        : [{ lot_number: r.lot_number || "", lbs: parseFloat((r.lbs || 0).toFixed(2)) }],
    });
    persistedLbs += r.lbs || 0;
    rackNumber = Math.max(rackNumber, (r.rack_number || 0) + 1);
  }
  remaining = parseFloat(Math.max(0, remaining - persistedLbs).toFixed(2));

  // Detect whether the carried-in partial was already released on a prior open of this
  // card. Match on ANY of its lot contributions against each persisted rack's contributions
  // OR its primary lot_number (a topped-up carried rack is stored with the dominant lot,
  // which may be this card's lot rather than the original carried lot).
  const carriedLots = (openPartialRack?.lot_contributions || [])
    .map(c => c.lot_number)
    .filter(Boolean);
  const carriedAlreadyPersisted = carriedLots.length
    ? sortedPersisted.some(r =>
        carriedLots.includes(r.lot_number) ||
        (r.lot_contributions || []).some(c => carriedLots.includes(c.lot_number))
      )
    : false;

  // Rack #1 = carried partial, topped up to capacity FIRST.
  if (openPartialRack && (openPartialRack.lbs || 0) > 0 && !carriedAlreadyPersisted) {
    const room = Math.max(0, rackCap - openPartialRack.lbs);
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
  }

  // Remaining weight → full racks, with a single trailing partial at the end.
  while (remaining > 0.001) {
    const rackLbs = parseFloat(Math.min(rackCap, remaining).toFixed(2));
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
      lbs: parseFloat((totalLbs || 0).toFixed(2)),
      released: false,
      lot_contributions: [{ lot_number: myLot, lbs: parseFloat((totalLbs || 0).toFixed(2)) }],
    });
  }
  return built;
}

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
    return buildRacks({ totalLbs, rackCap: RACK_CAP, openPartialRack, persistedRacks, myLot: initialLot });
  });

  // openPartialRack resolves AFTER mount (async order query). If the initial state was
  // built before it arrived, rebuild so Rack #1 pre-loads the carried-over leftover and
  // tops up to full racks first.
  useEffect(() => {
    if (!openPartialRack || (openPartialRack.lbs || 0) <= 0) return;
    if (persistedRacks && persistedRacks.length > 0) return;
    if (racks.some(r => r.carried_over || r.released || r.persisted)) return;
    const myLot = lotNumber || "";
    sync(buildRacks({ totalLbs, rackCap: RACK_CAP, openPartialRack, persistedRacks: [], myLot }), myLot, carriedOver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPartialRack]);

  // persistedRacks can resolve AFTER mount (async query). Rebuild to show them released.
  useEffect(() => {
    if (!persistedRacks || persistedRacks.length === 0) return;
    if (racks.some(r => r.persisted)) return;
    const myLot = lotNumber || "";
    sync(buildRacks({ totalLbs, rackCap: RACK_CAP, openPartialRack, persistedRacks, myLot }), myLot, carriedOver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedRacks]);

  // The trailing partial = the LAST rack that is NOT full, NOT released, NOT carried away.
  // Scanning from the end guarantees only the final leftover is offered the Carry Over /
  // Release choice — middle racks are always full, so they never show partial controls.
  const computeTrailingPartial = (rackList) => {
    for (let i = rackList.length - 1; i >= 0; i--) {
      const r = rackList[i];
      if (!r.released && !r.carried_away && r.lbs > 0 && r.lbs < RACK_CAP - 0.001) return r;
    }
    return null;
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
                      {rack.carried_over && !isFull && (
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