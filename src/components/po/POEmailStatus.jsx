import React from "react";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export const PO_LOGO_URL = "https://media.base44.com/images/public/69fa3d25d6b48b9b300a8c3a/abc6cd33d_MittysFoods_GroteWiegel_MuckesLogos.png";

export const poEmailErrorMessage = (error) =>
  error?.response?.data?.error || error?.data?.error || error?.message || "Unknown error";

export default function POEmailStatus({ po, sending, onSend }) {
  return (
    <div className="flex items-center gap-2">
      {po.email_sent_at ? (
        <span className="flex items-center gap-1 text-xs text-green-700" title={`Sent to ${po.email_sent_to || po.supplier_email}`}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Sent {format(parseISO(po.email_sent_at), "MMM d")}
        </span>
      ) : po.email_error ? (
        <span className="flex items-center gap-1 text-xs text-red-700" title={po.email_error}>
          <AlertCircle className="w-3.5 h-3.5" /> Failed
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Not sent</span>
      )}
      <Button size="sm" variant="outline" disabled={sending} onClick={() => onSend(po)}>
        {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
        {po.email_sent_at ? "Resend" : "Send"}
      </Button>
    </div>
  );
}