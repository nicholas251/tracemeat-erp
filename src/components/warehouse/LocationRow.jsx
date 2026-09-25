import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

// A location within a building: edit its spot count or delete it (only when empty).
export default function LocationRow({ loc, occupied, canEdit, blockedAbove, onChange }) {
  const [spots, setSpots] = useState(loc.spots);

  const saveSpots = async () => {
    const n = Number(spots);
    if (n === loc.spots || !(n > 0)) return setSpots(loc.spots);
    if (blockedAbove(n)) { alert(`Pallets sit in spots above ${loc.name}${n}. Move them first.`); return setSpots(loc.spots); }
    await base44.entities.WarehouseLocation.update(loc.id, { spots: n });
    onChange();
  };

  const remove = async () => {
    if (occupied > 0) return alert(`Location ${loc.name} still holds ${occupied} pallet(s). Move them first.`);
    if (!confirm(`Delete location ${loc.name}?`)) return;
    await base44.entities.WarehouseLocation.delete(loc.id);
    onChange();
  };

  return (
    <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2 text-sm">
      <span className="font-bold w-10">{loc.name}</span>
      <span className="text-muted-foreground flex-1">{loc.name}1 – {loc.name}{loc.spots} · {occupied} occupied</span>
      {canEdit ? (
        <>
          <Input type="number" value={spots} onChange={e => setSpots(e.target.value)} onBlur={saveSpots}
            onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} className="h-8 w-20 text-right" />
          <span className="text-xs text-muted-foreground">spots</span>
          <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </>
      ) : <span className="font-semibold">{loc.spots} spots</span>}
    </div>
  );
}