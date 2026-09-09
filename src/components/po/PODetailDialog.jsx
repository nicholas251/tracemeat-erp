import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/shared/StatusBadge";
import { format, parseISO } from "date-fns";

const fmtDate = (d) => (d ? format(parseISO(d), "MMM dd, yyyy") : "-");

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium whitespace-pre-line">{value || "-"}</p>
    </div>
  );
}

export default function PODetailDialog({ po, onClose }) {
  if (!po) return null;
  const items = po.line_items || [];
  const totalLbs = items.reduce((s, i) => s + (i.quantity_lbs || 0), 0);
  const totalReceived = items.reduce((s, i) => s + (i.received_qty_lbs || 0), 0);

  return (
    <Dialog open={!!po} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            PO #{po.po_number} <StatusBadge status={po.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Supplier" value={po.supplier} />
          <Field label="Supplier Email" value={po.supplier_email} />
          <Field label="Sent From" value={po.sender_email} />
          <Field label="Order Date" value={fmtDate(po.order_date)} />
          <Field label="Expected Delivery" value={fmtDate(po.expected_delivery_date)} />
          <Field label="Total Amount" value={po.total_amount != null ? `$${Number(po.total_amount).toFixed(2)}` : null} />
          <Field label="Ship To" value={po.ship_to_address} />
          <Field label="Ship-To Contact" value={po.ship_to_contact_name} />
          <Field label="Ship-To Phone" value={po.ship_to_contact_phone} />
          <Field
            label="Email Status"
            value={
              po.email_error
                ? `Failed: ${po.email_error}`
                : po.email_sent_at
                ? `Sent ${format(parseISO(po.email_sent_at), "MMM dd, yyyy h:mm a")} to ${po.email_sent_to || ""}`
                : "Not sent"
            }
          />
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Line Items</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Ordered (lbs)</TableHead>
                <TableHead className="text-right">Received (lbs)</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">No line items</TableCell>
                </TableRow>
              ) : (
                items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.material_name}</TableCell>
                    <TableCell className="capitalize">{item.category || "-"}</TableCell>
                    <TableCell className="text-right">{(item.quantity_lbs || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{(item.received_qty_lbs || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "-"}</TableCell>
                    <TableCell className="text-right">
                      {item.unit_price != null ? `$${((item.quantity_lbs || 0) * item.unit_price).toFixed(2)}` : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {items.length > 0 && (
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{totalLbs.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{totalReceived.toFixed(2)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {po.notes && <Field label="Notes" value={po.notes} />}
      </DialogContent>
    </Dialog>
  );
}