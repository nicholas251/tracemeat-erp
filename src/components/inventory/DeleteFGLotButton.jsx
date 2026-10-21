import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DeleteLotFields from "./DeleteLotFields";
import { deleteFgLot } from "@/lib/deleteFgLot";

export default function DeleteFGLotButton({ bucket, lot }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initials, setInitials] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  if (me?.role !== "admin") return null;

  const handleDelete = async () => {
    setBusy(true);
    await deleteFgLot({ productId: bucket.product_id, productName: bucket.product_name, lotNumber: lot.lot_number, initials, reason });
    queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => { setInitials(""); setReason(""); setOpen(true); }}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove lot {lot.lot_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {(lot.quantity_lbs || 0).toLocaleString()} lbs ({lot.cases || 0} cases) of {bucket.product_name} from inventory. The deletion will be logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DeleteLotFields initials={initials} setInitials={setInitials} reason={reason} setReason={setReason} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !initials.trim()} onClick={(e) => { e.preventDefault(); handleDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? "Removing..." : "Remove Lot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}