import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { ZONES } from "@/lib/warehouseLayout";
import PalletDetailDialog from "./PalletDetailDialog";

// Grid of every shipping-room spot; occupied spots open the pallet's contents.
export default function LocationMap({ pallets, spots, onDone }) {
  const [active, setActive] = useState(null);
  const bySpot = Object.fromEntries(pallets.map(p => [p.location, p]));

  return (
    <div className="space-y-5">
      {ZONES.map(z => {
        const used = Array.from({ length: z.spots }, (_, i) => bySpot[`${z.zone}${i + 1}`]).filter(Boolean).length;
        return (
          <Card key={z.zone} className="p-4">
            <div className="flex justify-between mb-3">
              <h3 className="font-bold">Location {z.zone}</h3>
              <span className="text-xs text-muted-foreground">{used} / {z.spots} occupied</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {Array.from({ length: z.spots }, (_, i) => {
                const id = `${z.zone}${i + 1}`;
                const p = bySpot[id];
                const cases = (p?.lots || []).reduce((s, l) => s + (l.cases || 0), 0);
                const products = [...new Set((p?.lots || []).map(l => l.product_name))];
                return (
                  <button key={id} disabled={!p} onClick={() => setActive(p)}
                    className={`rounded-lg border-2 p-2 text-left h-20 transition ${p ? "border-primary/40 bg-primary/10 hover:bg-primary/20" : "border-dashed bg-muted/30 cursor-default"}`}>
                    <p className="font-bold text-sm">{id}</p>
                    {p ? (
                      <>
                        <p className="text-[11px] truncate">{products.length > 1 ? `${products.length} products` : products[0]}</p>
                        <p className="text-[11px] text-muted-foreground">{cases} cs{p.lots.length > 1 ? ` · ${p.lots.length} lots` : ""}</p>
                      </>
                    ) : <p className="text-[11px] text-muted-foreground">Empty</p>}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
      <PalletDetailDialog pallet={active} spots={spots} onClose={() => setActive(null)} onDone={() => { setActive(null); onDone(); }} />
    </div>
  );
}