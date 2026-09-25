import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Picker over free spots across all buildings; value is the spot key.
export default function SpotSelect({ spots, value, onChange, placeholder = "Choose a location" }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-slate-200 border-slate-400"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="bg-slate-100 border-slate-300 max-h-72">
        {spots.map(s => <SelectItem key={s.key} value={s.key}>{s.building_name} · {s.code}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}