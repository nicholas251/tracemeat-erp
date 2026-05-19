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
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function TestAmountDialog({ open, bucket, onClose, onAdd }) {
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(bucket?.unit || "lbs");
  const [expiryDate, setExpiryDate] = useState(
    format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd")
  );
  const [notes, setNotes] = useState("TEST AMOUNT");
  const [loading, setLoading] = useState(false);

  if (!bucket) return null;

  const handleAdd = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      alert("Please enter a valid quantity");
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
        expiry_date: expiryDate,
        notes,
        lot_number: `TEST-${Date.now()}`,
        supplier: "Test Data",
        description: "Test amount for development",
        received_date: format(new Date(), "yyyy-MM-dd"),
        status: "available",
      });
      setQuantity("");
      setNotes("TEST AMOUNT");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Test Amount to Bucket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Bucket</Label>
            <p className="text-sm text-muted-foreground mt-1">{bucket.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qty" className="text-sm">
                Quantity
              </Label>
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
              <Label htmlFor="unit" className="text-sm">
                Unit
              </Label>
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
            <Label htmlFor="expiry" className="text-sm">
              Expiry Date
            </Label>
            <Input
              id="expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm">
              Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
            />
          </div>

          <Card className="bg-amber-50 border-amber-200 p-3">
            <div className="flex gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-900">
                Test amounts are marked for tracking and should be removed before production.
              </p>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? "Adding..." : "Add Test Amount"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}