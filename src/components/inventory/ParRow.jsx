import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// One par-level row: name, on-hand, editable par minimum, and status.
export default function ParRow({ name, subtitle, onHand, unit, par, canEdit, onSavePar }) {
  const [value, setValue] = useState(par ?? "");
  useEffect(() => { setValue(par ?? ""); }, [par]);

  const parNum = Number(par) || 0;
  const status = parNum <= 0 ? "unset" : onHand < parNum * 0.5 ? "critical" : onHand < parNum ? "low" : "ok";
  const badge = {
    unset: ["No par set", "bg-muted text-muted-foreground"],
    critical: ["Critical", "bg-destructive/15 text-destructive"],
    low: ["Below par", "bg-amber-100 text-amber-800"],
    ok: ["OK", "bg-chart-2/15 text-chart-2"],
  }[status];

  const commit = () => {
    const next = value === "" ? null : Number(value);
    if (next !== (par ?? null)) onSavePar(next);
  };

  return (
    <div className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 border-b last:border-0 text-sm">
      <div className="col-span-5 min-w-0">
        <p className="font-medium truncate">{name}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <div className="col-span-2 text-right font-semibold">
        {onHand.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
      </div>
      <div className="col-span-3">
        {canEdit ? (
          <Input
            type="number"
            className="h-8 text-right"
            placeholder="Set par"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
          />
        ) : (
          <p className="text-right">{parNum > 0 ? `${parNum} ${unit}` : "—"}</p>
        )}
      </div>
      <div className="col-span-2 text-right">
        <Badge className={`${badge[1]} border-0`}>{badge[0]}</Badge>
      </div>
    </div>
  );
}