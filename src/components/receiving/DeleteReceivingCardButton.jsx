import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DeleteReceivingCardButton({ po, onDeleted }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: me } = useQuery({ queryKey: ["currentUser"], queryFn: () => base44.auth.me() });

  if (me?.role !== "admin") return null;

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.PurchaseOrder.delete(po.id);
    queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
    setDeleting(false);
    setOpen(false);
    onDeleted?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="absolute bottom-3 right-3 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        aria-label="Delete receiving card"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {po.po_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the purchase order and its receiving card. Inventory already received stays in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}