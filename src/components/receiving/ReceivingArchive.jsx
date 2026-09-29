import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { Archive } from "lucide-react";

export default function ReceivingArchive({ pos }) {
  if (pos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">No archived received orders yet.</CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {pos.map(po => (
        <Card key={po.id} className="bg-muted/30">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{po.po_number}</span>
              <span className="ml-auto"><StatusBadge status={po.status} /></span>
            </div>
            <p className="text-sm text-muted-foreground">{po.supplier}</p>
            <ul className="text-xs space-y-0.5">
              {(po.line_items || []).map((li, i) => (
                <li key={i}>{li.material_name} — {li.received_qty_lbs || 0} / {li.quantity_lbs} lbs</li>
              ))}
            </ul>
            {po.received_at && (
              <p className="text-xs text-muted-foreground">Received {format(new Date(po.received_at), "MMM dd, yyyy h:mm a")}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}