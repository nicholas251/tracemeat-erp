import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PackagePlus } from "lucide-react";
import { format } from "date-fns";

export default function TestAmountDialog({ open, bucket, onClose, onAdd }) {
  const [lotNumber, setLotNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(bucket?.unit || "lbs");
  const [supplier, setSupplier] = useState("");
  const [receivedDate, setReceivedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expiryDate, setExpiryDate] = useState(
    format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd")
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!bucket) return null;

  const handleAdd = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      alert("Please enter a valid quantity");
      return;
    }
    if (!lotNumber.trim()) {
      alert("Please enter a lot number");
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        bucket_id: bucket.id,
        bucket_name: bucket.name,
        bucket_category: bucket.category,
        quantity: parseFloat(quantity),
        available_qty: parseFloat(quantity),
        unit,
        lot_number: lotNumber.trim(),
        supplier: supplier.trim() || "Initial Stock",
        received_date: receivedDate,
        expiry_date: expiryDate,
        notes: notes.trim() || "Initial stock entry",
        status: "available",
      });
      // Reset
      setLotNumber("");
      setQuantity("");
      setSupplier("");
      setNotes("");
      setReceivedDate(format(new Date(), "yyyy-MM-dd"));
      setExpiryDate(format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-primary" />
            <DialogTitle>Initial Stock Entry</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Record existing on-hand inventory for <span className="font-semibold text-foreground">{bucket.name}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="lot" className="text-sm font-semibold">Lot Number <span className="text-destructive">*</span></Label>
              <Input
                id="lot"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. 050626-A"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="qty" className="text-sm font-semibold">Quantity <span className="text-destructive">*</span></Label>
              <Input
                id="qty"
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="unit" className="text-sm font-semibold">Unit</Label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-input rounded-md mt-1"
              >
                <option value="lbs">lbs</option>
                <option value="each">each</option>
                <option value="case">case</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="supplier" className="text-sm font-semibold">Supplier</Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g. Acme Meats"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="received" className="text-sm font-semibold">Received Date</Label>
              <Input
                id="received"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="expiry" className="text-sm font-semibold">Expiry Date</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-semibold">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="mt-1"
            />
          </div>

          <Card className="bg-primary/5 border-primary/20 p-3">
            <p className="text-xs text-primary font-medium">
              This records existing stock already on-site. Use this once during system setup — ongoing receipts should go through Purchase Orders.
            </p>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading || !lotNumber.trim() || !quantity}>
            {loading ? "Saving..." : "Add to Inventory"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}