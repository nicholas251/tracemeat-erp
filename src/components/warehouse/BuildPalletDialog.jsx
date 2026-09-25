import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { syncItemLocations } from "@/lib/palletSync";
import SpotSelect from "./SpotSelect";

// Confirm the lots going on one pallet and pick its building + spot.
export default function BuildPalletDialog({ open, onClose, lots, spots, onDone }) {
  const [spotKey, setSpotKey] = useState("");
  const [saving, setSaving] = useState(false);
  const spot = spots.find(s => s.key === spotKey);

  const save = async () => {
    setSaving(true);
    await base44.entities.Pallet.create({
      pallet_number: `PLT-${Date.now().toString().slice(-7)}`,
      building_id: spot.building_id,
      building_name: spot.building_name,
      location: spot.code,
      status: "stored",
      stored_at: new Date().toISOString(),
      lots: lots.map(l => ({
        inventory_item_id: l.id,
        lot_number: l.lot_number,
        product_id: l.product_id,
        product_name: l.product_name,
        cases: l.cases,
        lbs: l.cases >= l.remainingCases ? l.remainingLbs : parseFloat((l.cases * l.caseWeight).toFixed(2)),
        expiry_date: l.expiry_date || "",
      })),
    });
    await syncItemLocations(lots.map(l => l.id));
    setSaving(false);
    setSpotKey("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Build Pallet</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {lots.map(l => (
            <div key={l.id} className="flex justify-between text-sm bg-muted/50 rounded px-3 py-2">
              <span className="min-w-0 truncate"><span className="font-medium">{l.product_name}</span> <span className="font-mono text-xs text-muted-foreground">{l.lot_number}</span></span>
              <span className="font-semibold shrink-0 ml-2">{l.cases} cs</span>
            </div>
          ))}
          {lots.length > 1 && <p className="text-xs text-amber-700">Mixed-lot pallet — {lots.length} lots</p>}
        </div>
        <SpotSelect spots={spots} value={spotKey} onChange={setSpotKey} />
        {spots.length === 0 && <p className="text-xs text-destructive">No free spots — add locations in Setup.</p>}
        <Button disabled={!spot || saving} onClick={save}>
          {saving ? "Saving…" : spot ? `Put away at ${spot.building_name} · ${spot.code}` : "Put away"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}