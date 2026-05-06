import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RawInventoryAdjustDialog({ open, item, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    available_qty: item.available_qty || 0,
    quantity: item.quantity || 0,
    status: item.status || "available",
    notes: item.notes || "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onSave(item.id, {
      ...item,
      available_qty: Number(form.available_qty),
      quantity: Number(form.quantity),
      status: form.status,
      notes: form.notes,
    });
  };

  return (
    <>
      <Dialog open={open && !confirmDelete} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Raw Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-semibold">{item.bucket_name}</p>
              <p className="text-muted-foreground font-mono text-xs mt-0.5">
                Lot: {item.lot_number || "—"} · Supplier: {item.supplier || "—"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Available Qty ({item.unit || "lbs"})</Label>
                <Input
                  type="number"
                  value={form.available_qty}
                  onChange={e => setForm(prev => ({ ...prev, available_qty: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Qty ({item.unit || "lbs"})</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="depleted">Depleted</SelectItem>
                  <SelectItem value="quarantined">Quarantined</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Delete Raw Material Lot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove lot <strong>{item.lot_number || item.bucket_name}</strong> from inventory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => { setConfirmDelete(false); onDelete(item.id); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}