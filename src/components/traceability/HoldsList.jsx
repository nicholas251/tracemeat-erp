import React from "react";
import StatusBadge from "@/components/shared/StatusBadge";

export default function HoldsList({ holds }) {
  if (!holds.length) return <p className="text-xs text-muted-foreground italic">No holds on record for this order.</p>;
  return (
    <div className="space-y-2">
      {holds.map(h => (
        <div key={h.id} className="p-2.5 rounded-lg bg-muted/50 text-xs">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-medium capitalize">{(h.hold_reason || "").replace(/_/g, " ")}{h.batch_number ? <span className="font-mono text-muted-foreground ml-2">{h.batch_number}</span> : null}</span>
            <StatusBadge status={h.status} />
          </div>
          {h.hold_description && <p className="text-muted-foreground">{h.hold_description}</p>}
          {h.resolution_notes && <p className="mt-1"><strong>Resolution:</strong> {h.resolution_notes}</p>}
        </div>
      ))}
    </div>
  );
}