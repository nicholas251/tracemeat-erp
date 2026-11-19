import React, { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { generateBillOfLading } from "@/lib/billOfLading";
import ShipFromPicker from "./ShipFromPicker";

export default function BolPromptDialog({ orderId, reprint, onClose }) {
  const [busy, setBusy] = useState(false);
  const [shipFrom, setShipFrom] = useState(null);
  const create = async () => {
    setBusy(true);
    await generateBillOfLading(orderId, shipFrom).finally(() => setBusy(false));
    onClose();
  };
  return (
    <AlertDialog open={!!orderId}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{reprint ? "Bill of lading" : "Order fulfilled"}</AlertDialogTitle>
          <AlertDialogDescription>
            {reprint ? "Choose the ship-from address to print a bill of lading for this order." : "Would you like to create a bill of lading for this shipment?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ShipFromPicker value={shipFrom} onChange={setShipFrom} />
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{reprint ? "Cancel" : "No thanks"}</Button>
          <Button onClick={create} disabled={busy || !shipFrom}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create Bill of Lading
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}