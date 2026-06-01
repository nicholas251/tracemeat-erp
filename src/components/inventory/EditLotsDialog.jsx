import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = ["available", "in_use", "depleted", "quarantined", "expired"];

export default function EditLotsDialog({ open, onClose, bucket, lots, onSaveLot, onDeleteLot, loading }) {
  const [editingLot, setEditingLot] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleEditClick = (lot) => {
    setEditingLot(lot);
    setEditForm({
      lot_number: lot.lot_number || "",
      description: lot.description || "",
      available_qty: lot.available_qty || 0,
      status: lot.status || "available",
      expiry_date: lot.expiry_date || "",
    });
  };

  const handleSave = async () => {
    await onSaveLot({ id: editingLot.id, data: editForm });
    setEditingLot(null);
  };

  const handleDelete = async () => {
    if (window.confirm("Delete this lot?")) {
      await onDeleteLot(editingLot.id);
      setEditingLot(null);
    }
  };

  if (editingLot) {
    return (
      <Dialog open={open && !!editingLot} onOpenChange={(isOpen) => !isOpen && setEditingLot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Lot</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Lot Number</Label>
              <Input
                value={editForm.lot_number}
                onChange={(e) => setEditForm({ ...editForm, lot_number: e.target.value })}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Available Qty ({bucket?.unit || "lbs"})</Label>
              <Input
                type="number"
                value={editForm.available_qty}
                onChange={(e) => setEditForm({ ...editForm, available_qty: parseFloat(e.target.value) || 0 })}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Expiry Date</Label>
              <Input
                type="date"
                value={editForm.expiry_date}
                onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={loading} className="mr-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <Button variant="outline" onClick={() => setEditingLot(null)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bucket?.name} - Edit Lots</DialogTitle>
        </DialogHeader>

        {lots && lots.length > 0 ? (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Lot #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Available Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell className="font-mono text-xs">{lot.lot_number || "—"}</TableCell>
                  <TableCell className="text-xs">{lot.description || "—"}</TableCell>
                  <TableCell className="font-semibold">{lot.available_qty?.toLocaleString()} {lot.unit}</TableCell>
                  <TableCell className="text-xs capitalize">{lot.status}</TableCell>
                  <TableCell className="text-xs">
                    {lot.expiry_date ? format(new Date(lot.expiry_date), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleEditClick(lot)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No lots for this bucket</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}