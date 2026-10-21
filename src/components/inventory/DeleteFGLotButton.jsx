import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DeleteFGLotButton({ bucket, lot }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  if (me?.role !== "admin") return null;

  const handleDelete = async () => {
    setBusy(true);
    const lots = (bucket.lots || []).filter(l => l !== lot && l.lot_number !== lot.lot_number);
    const qty = Math.max(0, (bucket.quantity_lbs || 0) - (lot.quantity_lbs || 0));
    const caseWeight = bucket.case_weight_lbs || 0;
    await base44.entities.FinishedGoodsBucket.update(bucket.id, {
      lots,
      quantity_lbs: qty,
      cases_on_hand: caseWeight ? Math.floor(qty / caseWeight) : Math.max(0, (bucket.cases_on_hand || 0) - (lot.cases || 0)),
    });
    const items = await base44.entities.InventoryItem.filter({ product_id: bucket.product_id, lot_number: lot.lot_number });
    await Promise.all(items.map(i => base44.entities.InventoryItem.delete(i.id)));
    queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove lot {lot.lot_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {(lot.quantity_lbs || 0).toLocaleString()} lbs ({lot.cases || 0} cases) of {bucket.product_name} from finished goods inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); handleDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? "Removing..." : "Remove Lot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}