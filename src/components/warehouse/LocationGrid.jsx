import React from "react";
import { spotKey } from "@/lib/warehouseLayout";

// One location's spots (e.g. A1…A12); occupied spots are clickable.
export default function LocationGrid({ loc, bySpot, onOpen }) {
  const count = Number(loc.spots) || 0;
  const cells = Array.from({ length: count }, (_, i) => `${loc.name}${i + 1}`);
  const used = cells.filter(c => bySpot[spotKey(loc.building_id, c)]).length;
  return (
    <div>
      <div className="flex justify-between mb-2">
        <h4 className="font-semibold text-sm">Location {loc.name}</h4>
        <span className="text-xs text-muted-foreground">{used} / {count} occupied</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {cells.map(code => {
          const p = bySpot[spotKey(loc.building_id, code)];
          const cases = (p?.lots || []).reduce((s, l) => s + (l.cases || 0), 0);
          const products = [...new Set((p?.lots || []).map(l => l.product_name))];
          return (
            <button key={code} disabled={!p} onClick={() => onOpen(p)}
              className={`rounded-lg border-2 p-2 text-left h-20 transition ${p ? "border-primary/40 bg-primary/10 hover:bg-primary/20" : "border-dashed bg-muted/30 cursor-default"}`}>
              <p className="font-bold text-sm">{code}</p>
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
    </div>
  );
}