import React, { useState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// Asks whether a spice-mix lot's ingredients go back to raw stock or are just deleted.
export default function SpiceLotDeleteChoice({ lot, onChoose, onCancel }) {
  const [busy, setBusy] = useState(false);
  const choose = async (mode) => { setBusy(true); await onChoose(mode); setBusy(false); };
  return (
    <AlertDialog open={!!lot} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove spice mix lot {lot?.lot_number}</AlertDialogTitle>
          <AlertDialogDescription>
            {(lot?.available_qty || 0).toLocaleString()} lbs. Are you returning the ingredients to raw spice stock, or just deleting it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="outline" disabled={busy} onClick={() => choose("return")}>Return to stock</Button>
          <Button variant="destructive" disabled={busy} onClick={() => choose("discard")}>Just delete</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}