import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PackagePlus } from "lucide-react";
import BuildPalletDialog from "./BuildPalletDialog";

// FG lots (or the part of a lot) not yet on a pallet. Select one or more to build a pallet.
export default function PutAwayQueue({ rows, spots, onDone }) {
  const [selected, setSelected] = useState({}); // itemId -> cases
  const [open, setOpen] = useState(false);

  const toggle = (r) => setSelected(s => {
    const n = { ...s };
    if (n[r.id] !== undefined) delete n[r.id]; else n[r.id] = r.remainingCases;
    return n;
  });
  const chosen = rows.filter(r => selected[r.id] !== undefined).map(r => ({ ...r, cases: Number(selected[r.id]) || 0 }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} lot(s) waiting for a pallet location</p>
        <Button disabled={!chosen.length || chosen.some(c => c.cases <= 0)} onClick={() => setOpen(true)} className="gap-2">
          <PackagePlus className="w-4 h-4" /> Build Pallet ({chosen.length})
        </Button>
      </div>
      <Card>
        <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
          <span className="col-span-1" /><span className="col-span-4">Product</span><span className="col-span-3">Lot</span>
          <span className="col-span-2 text-right">Unplaced</span><span className="col-span-2 text-right">Cases on pallet</span>
        </div>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Everything is put away</p>}
        {rows.map(r => (
          <div key={r.id} className="grid grid-cols-12 gap-3 items-center px-4 py-2.5 border-b last:border-0 text-sm">
            <div className="col-span-1"><Checkbox checked={selected[r.id] !== undefined} onCheckedChange={() => toggle(r)} /></div>
            <div className="col-span-4 min-w-0">
              <p className="font-medium truncate">{r.product_name}</p>
              <p className="text-xs text-muted-foreground">Order #{r.batch_number} · Exp {r.expiry_date || "—"}</p>
            </div>
            <span className="col-span-3 font-mono text-xs truncate">{r.lot_number}</span>
            <span className="col-span-2 text-right font-semibold">{r.remainingCases} cs</span>
            <div className="col-span-2">
              {selected[r.id] !== undefined && (
                <Input type="number" className="h-8 text-right" value={selected[r.id]} max={r.remainingCases}
                  onChange={e => setSelected(s => ({ ...s, [r.id]: Math.min(r.remainingCases, Number(e.target.value)) }))} />
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