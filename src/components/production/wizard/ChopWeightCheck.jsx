import React, { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { chopExpectedOutput, chopIsOverweight } from "@/lib/chopWeight";

// Pre-fills chopping output with what went into the bowl, and requires an override
// note when the entered output is more than what went in.
export default function ChopWeightCheck({ stage, form, setForm }) {
  const expected = chopExpectedOutput(stage, form);
  const lastAuto = useRef(null);

  // Keep the output in sync with the bowl contents until the operator types their own value.
  useEffect(() => {
    const cur = form.output_qty_lbs;
    if (cur === undefined || cur === "" || cur === 0 || cur === lastAuto.current) {
      lastAuto.current = expected;
      setForm(f => ({ ...f, output_qty_lbs: expected }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expected]);

  const over = chopIsOverweight(stage, form);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Expected output (protein + spice + cure + water): <b className="text-foreground">{expected} lbs</b>
      </p>
      {over && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              Output of <b>{form.output_qty_lbs} lbs</b> is more than the <b>{expected} lbs</b> that went into the bowl.
              Correct the weight, or explain the override below to continue.
            </p>
          </div>
          <Textarea
            value={form.chop_weight_override_note || ""}
            onChange={e => setForm(f => ({ ...f, chop_weight_override_note: e.target.value }))}
            placeholder="Reason for override (required)"
            className="h-20 text-sm bg-white"
          />
        </div>
      )}
    </div>
  );
}