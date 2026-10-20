import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PackagePlus } from "lucide-react";
import BuildPalletDialog from "./BuildPalletDialog";

// FG lots not yet on a pallet, grouped by product + lot so new cases of the same lot stack on one row.
export default function PutAwayQueue({ rows, spots, onDone }) {
  const [selected, setSelected] = useState({}); // groupKey -> cases
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const key = `${r.product_id}|${r.lot_number}`;
      if (!map[key]) map[key] = { key, product_name: r.product_name, lot_number: r.lot_number, expiry_date: r.expiry_date, orders: new Set(), members: [], remainingCases: 0 };
      const g = map[key];
      g.members.push(r);
      g.remainingCases += r.remainingCases || 0;
      if (r.batch_number) g.orders.add(r.batch_number);
    });
    return Object.values(map);
  }, [rows]);

  const toggle = (g) => setSelected(s => {
    const n = { ...s };
    if (n[g.key] !== undefined) delete n[g.key]; else n[g.key] = g.remainingCases;
    return n;
  });

  // Spread the chosen case count for each group across its underlying lot records.
  const chosen = groups.filter(g => selected[g.key] !== undefined).flatMap(g => {
    let left = Number(selected[g.key]) || 0;
    return g.members.map(m => {
      const cases = Math.min(left, m.remainingCases);
      left -= cases;
      return { ...m, cases };
    }).filter(m => m.cases > 0);
  });
  const chosenGroups = Object.keys(selected).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{groups.length} lot(s) waiting for a pallet location</p>
        <Button disabled={!chosen.length} onClick={() => setOpen(true)} className="gap-2">
          <PackagePlus className="w-4 h-4" /> Build Pallet ({chosenGroups})
        </Button>
      </div>
      <Card>
        <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
          <span className="col-span-1" /><span className="col-span-4">Product</span><span className="col-span-3">Lot</span>
          <span className="col-span-2 text-right">Unplaced</span><span className="col-span-2 text-right">Cases on pallet</span>
        </div>
        {groups.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Everything is put away</p>}
        {groups.map(g => (
          <div key={g.key} className="grid grid-cols-12 gap-3 items-center px-4 py-2.5 border-b last:border-0 text-sm">
            <div className="col-span-1"><Checkbox checked={selected[g.key] !== undefined} onCheckedChange={() => toggle(g)} /></div>
            <div className="col-span-4 min-w-0">
              <p className="font-medium truncate">{g.product_name}</p>
              <p className="text-xs text-muted-foreground truncate">Order #{[...g.orders].join(", ") || "—"} · Exp {g.expiry_date || "—"}{g.members.length > 1 ? ` · ${g.members.length} entries` : ""}</p>
            </div>
            <span className="col-span-3 font-mono text-xs truncate">{g.lot_number}</span>
            <span className="col-span-2 text-right font-semibold">{g.remainingCases} cs</span>
            <div className="col-span-2">
              {selected[g.key] !== undefined && (
                <Input type="number" className="h-8 text-right" value={selected[g.key]} max={g.remainingCases}
                  onChange={e => setSelected(s => ({ ...s, [g.key]: Math.min(g.remainingCases, Number(e.target.value)) }))} />
              )}
            </div>
          </div>
        ))}
      </Card>
      <BuildPalletDialog open={open} onClose={() => setOpen(false)} lots={chosen} spots={spots}
        onDone={() => { setOpen(false); setSelected({}); onDone(); }} />
    </div>
  );
}