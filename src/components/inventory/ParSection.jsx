import React from "react";
import { Card } from "@/components/ui/card";
import ParRow from "./ParRow";

// A titled card listing par rows, with a header row and a below-par count.
export default function ParSection({ title, rows, unit, canEdit, onSavePar, isLoading }) {
  const belowPar = rows.filter(r => (Number(r.par) || 0) > 0 && r.onHand < Number(r.par)).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{title} ({rows.length})</h3>
        {belowPar > 0 && <span className="text-xs font-semibold text-destructive">{belowPar} below par</span>}
      </div>
      <Card>
        <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
          <span className="col-span-5">Item</span>
          <span className="col-span-2 text-right">On Hand</span>
          <span className="col-span-3 text-right">Par ({unit})</span>
          <span className="col-span-2 text-right">Status</span>
        </div>
        {isLoading ? (
          <div className="h-32 animate-pulse bg-muted" />
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing to show</p>
        ) : (
          rows.map(r => (
            <ParRow key={r.id} {...r} unit={unit} canEdit={canEdit} onSavePar={val => onSavePar(r.id, val)} />
          ))
        )}
      </Card>
    </div>
  );
}