import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import DeleteLotFields from "./DeleteLotFields";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const kgToLbs = (kg) => Math.round((kg || 0) * 2.20462 * 100) / 100;
const lbsToKg = (lbs) => (lbs || 0) / 2.20462;

export default function InventoryAdjustDialog({ open, item, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    quantity_lbs: kgToLbs(item.quantity_kg),
    status: item.status || "available",
    location: item.location || "",
    notes: item.notes || "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [initials, setInitials] = useState("");
  const [reason, setReason] = useState("");

  const handleSave = () => {
    onSave(item.id, {
      ...item,
      quantity_kg: lbsToKg(Number(form.quantity_lbs)),
      status: form.status,
      location: form.location,
      notes: form.notes,
    });
  };

  return (
    <>
      <Dialog open={open && !confirmDelete} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-semibold">{item.product_name}</p>
              <p className="text-muted-foreground font-mono text-xs mt-0.5">{item.lot_number || item.batch_number}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity on Hand (lbs)</Label>
                <Input
                  type="number"
                  value={form.quantity_lbs}
                  onChange={e => setForm(prev => ({ ...prev, quantity_lbs: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="quarantined">Quarantined</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Storage Location</Label>
              <Input
                value={form.location}
                onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. Cooler A, Freezer 2"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="destructive" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove lot <strong>{item.lot_number || item.batch_number}</strong> of {item.product_name} from inventory. The deletion will be logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DeleteLotFields initials={initials} setInitials={setInitials} reason={reason} setReason={setReason} />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!initials.trim()} className="bg-destructive hover:bg-destructive/90" onClick={() => { setConfirmDelete(false); onDelete(item, { initials, reason }); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}