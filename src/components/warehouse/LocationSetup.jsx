import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import BuildingCard from "./BuildingCard";

// Admin setup: add buildings, then add locations (letter + spot count) inside each.
export default function LocationSetup({ buildings, locations, pallets, canEdit, onChange }) {
  const [name, setName] = useState("");

  const addBuilding = async () => {
    await base44.entities.WarehouseBuilding.create({ name: name.trim() });
    setName("");
    onChange();
  };

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex gap-2 max-w-md">
          <Input placeholder="New building name (e.g. Freezer Building)" value={name} onChange={e => setName(e.target.value)} className="h-9" />
          <Button disabled={!name.trim()} onClick={addBuilding} className="gap-1"><Plus className="w-4 h-4" /> Add Building</Button>
        </div>
      ) : <p className="text-xs text-muted-foreground">Only admins can change buildings and locations.</p>}
      {buildings.length === 0 && <p className="text-sm text-muted-foreground">No buildings yet.</p>}
      {buildings.map(b => (
        <BuildingCard key={b.id} building={b} locations={locations.filter(l => l.building_id === b.id)}
          pallets={pallets} canEdit={canEdit} onChange={onChange} />
      ))}
    </div>
  );
}