import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Admin-only: deletes one produced spice-mix batch (lot) and removes its lbs from the mix's available total.
export default function DeleteSpiceBatchButton({ lot, mix }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["currentUser"], queryFn: () => base44.auth.me() });
  if (me?.role !== "admin") return null;

  const handleDelete = async () => {
    setBusy(true);
    await base44.entities.RawInventory.delete(lot.id);
    const remaining = Math.max(0, (mix.available_qty_lbs || 0) - (lot.available_qty || 0));
    await base44.entities.SpiceMix.update(mix.id, { available_qty_lbs: remaining });
    ["spiceMixes", "spiceMixProducedLots", "raw_inventory"].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-2 text-destructive hover:opacity-70" title="Delete batch">
        <Trash2 className="w-3 h-3" />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete spice mix batch</AlertDialogTitle>
            <AlertDialogDescription>
              Delete batch {lot.lot_number} ({(lot.available_qty || 0).toLocaleString()} lbs) of {mix.name}? This removes it from inventory and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleDelete(); }}>
            {busy ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}