import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { spotKey, sortLocations } from "@/lib/warehouseLayout";
import LocationGrid from "./LocationGrid";
import PalletDetailDialog from "./PalletDetailDialog";

// Every building → its locations → spot grid.
export default function LocationMap({ buildings, locations, pallets, spots, onDone }) {
  const [active, setActive] = useState(null);
  const bySpot = Object.fromEntries(pallets.map(p => [spotKey(p.building_id, p.location), p]));

  if (buildings.length === 0) {
    return <p className="text-sm text-muted-foreground p-6 text-center">No buildings yet — add one in Setup.</p>;
  }

  return (
    <div className="space-y-5">
      {buildings.map(b => {
        const locs = sortLocations(locations.filter(l => l.building_id === b.id));
        return (
          <Card key={b.id} className="p-4 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Building2 className="w-4 h-4" /> {b.name}</h3>
            {locs.length === 0 && <p className="text-sm text-muted-foreground">No locations in this building yet.</p>}
            {locs.map(l => <LocationGrid key={l.id} loc={l} bySpot={bySpot} onOpen={setActive} />)}
          </Card>
        );
      })}
      <PalletDetailDialog pallet={active} spots={spots} onClose={() => setActive(null)} onDone={() => { setActive(null); onDone(); }} />
    </div>
  );
}