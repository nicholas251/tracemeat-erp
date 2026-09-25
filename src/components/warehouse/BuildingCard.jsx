import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Trash2 } from "lucide-react";
import { sortLocations, palletsInLocation } from "@/lib/warehouseLayout";
import LocationRow from "./LocationRow";

// One building: its locations (name + spot count), add location, delete building.
export default function BuildingCard({ building, locations, pallets, canEdit, onChange }) {
  const [name, setName] = useState("");
  const [spots, setSpots] = useState("");
  const locs = sortLocations(locations);

  const addLocation = async () => {
    const code = name.trim().toUpperCase();
    if (locs.some(l => l.name === code)) return alert(`Location ${code} already exists in ${building.name}.`);
    await base44.entities.WarehouseLocation.create({
      building_id: building.id, building_name: building.name, name: code, spots: Number(spots),
    });
    setName(""); setSpots("");
    onChange();
  };

  const deleteBuilding = async () => {
    if (pallets.some(p => p.building_id === building.id)) return alert("Move or remove the pallets in this building first.");
    if (!confirm(`Delete ${building.name} and all its locations?`)) return;
    for (const l of locs) await base44.entities.WarehouseLocation.delete(l.id);
    await base44.entities.WarehouseBuilding.delete(building.id);
    onChange();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><Building2 className="w-4 h-4" /> {building.name}</h3>
        {canEdit && <Button variant="ghost" size="icon" onClick={deleteBuilding}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
      </div>
      {locs.length === 0 && <p className="text-sm text-muted-foreground">No locations yet.</p>}
      {locs.map(l => (
        <LocationRow key={l.id} loc={l} occupied={palletsInLocation(pallets, l).length} canEdit={canEdit}
          blockedAbove={(n) => palletsInLocation(pallets, l, n).length > 0} onChange={onChange} />
      ))}
      {canEdit && (
        <div className="flex gap-2 pt-2 border-t">
          <Input placeholder="Location (e.g. D)" value={name} onChange={e => setName(e.target.value)} className="h-9" />
          <Input type="number" placeholder="# of spots" value={spots} onChange={e => setSpots(e.target.value)} className="h-9 w-32" />
          <Button disabled={!name.trim() || !(Number(spots) > 0)} onClick={addLocation} className="gap-1"><Plus className="w-4 h-4" /> Add</Button>
        </div>
      )}
    </Card>
  );
}