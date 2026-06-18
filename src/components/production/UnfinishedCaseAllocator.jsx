import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Boxes, Check } from "lucide-react";

// Lets the operator park leftover weight (that doesn't fill a full case) as a traceable
// "unfinished case" carry-over to be packed in a future run. Shows the remaining lbs and a
// single button. Once allocated, the remainder is accounted for so completion isn't blocked.
export default function UnfinishedCaseAllocator({ remainderLbs = 0, lotContributions = [], allocated = false, onAllocate }) {
  if (remainderLbs <= 0.001) return null;

  const contribs = (lotContributions || []).filter(c => (c.lbs || 0) > 0);

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Boxes className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Unfinished Case Remainder</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {remainderLbs.toFixed(2)} lbs left over — park it as a carry-over to pack with a future run.
            </p>
          </div>
        </div>

        {contribs.length > 0 && (
          <div className="text-xs text-amber-800 border-t border-amber-200 pt-2 space-y-0.5">
            {contribs.map((c, i) => (
              <div key={i} className="flex justify-between">
                <span className="font-mono">{c.lot_number || "—"}</span>
                <span className="font-semibold">{(c.lbs || 0).toFixed(2)} lbs</span>
              </div>
            ))}
          </div>
        )}

        {allocated ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-chart-2">
            <Check className="w-4 h-4" /> Allocated to unfinished case
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={onAllocate} className="w-full gap-2 border-amber-400 text-amber-800 hover:bg-amber-100">
            <Boxes className="w-4 h-4" /> Allocate to Unfinished Case
          </Button>
        )}
      </CardContent>
    </Card>
  );
}