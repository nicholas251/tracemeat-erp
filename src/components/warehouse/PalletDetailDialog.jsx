import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { syncItemLocations } from "@/lib/palletSync";
import SpotSelect from "./SpotSelect";

// Pallet contents, with move-to-another-spot and remove (shipped/emptied).
export default function PalletDetailDialog({ pallet, spots, onClose, onDone }) {
  const [moveTo, setMoveTo] = useState("");
  const [saving, setSaving] = useState(false);
  if (!pallet) return null;
  const itemIds = (pallet.lots || []).map(l => l.inventory_item_id);

  const run = async (data) => {
    setSaving(true);
    await base44.entities.Pallet.update(pallet.id, data);
    await syncItemLocations(itemIds);
    setSaving(false);
    setMoveTo("");
    onDone();
  };
  const move = () => {
    const s = spots.find(x => x.key === moveTo);
    run({ building_id: s.building_id, building_name: s.building_name, location: s.code });
  };

  return (
    <Dialog open={!!pallet} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{pallet.building_name} · {pallet.location} — {pallet.pallet_number}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {(pallet.lots || []).map((l, i) => (
            <div key={i} className="bg-muted/50 rounded px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="font-medium">{l.product_name}</span><span className="font-semibold">{l.cases} cs</span></div>
              <p className="text-xs text-muted-foreground font-mono">{l.lot_number} · Exp {l.expiry_date || "—"}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1"><SpotSelect spots={spots} value={moveTo} onChange={setMoveTo} placeholder="Move to…" /></div>
          <Button disabled={!moveTo || saving} onClick={move}>Move</Button>
        </div>
        <Button variant="destructive" disabled={saving}
          onClick={() => confirm(`Remove pallet from ${pallet.location}? Its lots go back to the put-away queue unless shipped.`) &&
            run({ status: "removed", removed_at: new Date().toISOString() })}>
          Remove Pallet (shipped / emptied)
        </Button>
      </DialogContent>
    </Dialog>
  );
}