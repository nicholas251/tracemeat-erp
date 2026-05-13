import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function FGBucketAdjustDialog({ open, bucket, onClose, onSave }) {
  const [adjustType, setAdjustType] = useState("add");
  const [lbs, setLbs] = useState("");
  const [cases, setCases] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const qty = parseFloat(lbs) || 0;
    const caseQty = parseFloat(cases) || 0;
    const sign = adjustType === "remove" ? -1 : 1;

    const newLbs = Math.max(0, (bucket.quantity_lbs || 0) + sign * qty);
    const newCases = Math.max(0, (bucket.cases_on_hand || 0) + sign * caseQty);

    const updatedLots = [...(bucket.lots || [])];
    if (adjustType === "add" && lotNumber) {
      updatedLots.push({
        lot_number: lotNumber,
        production_date: new Date().toISOString().slice(0, 10),
        quantity_lbs: qty,
        cases: caseQty,
        status: "available",
        order_number: "manual",
      });
    }

    await onSave(bucket.id, {
      quantity_lbs: newLbs,
      cases_on_hand: newCases,
      lots: updatedLots,
      notes: reason ? `${adjustType === "add" ? "Added" : "Removed"} ${qty} lbs: ${reason}` : bucket.notes,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust — {bucket?.product_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Adjustment Type</Label>
            <Select value={adjustType} onValueChange={setAdjustType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add Stock</SelectItem>
                <SelectItem value="remove">Remove Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity (lbs)</Label>
              <Input type="number" value={lbs} onChange={e => setLbs(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Cases</Label>
              <Input type="number" value={cases} onChange={e => setCases(e.target.value)} placeholder="0" />
            </div>
          </div>
          {adjustType === "add" && (
            <div className="space-y-1.5">
              <Label>Lot Number (optional)</Label>
              <Input value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="e.g. FG-20260513-001" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Reason / Notes</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Manual stock count correction" className="h-20" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || (!lbs && !cases)}>
              {saving ? "Saving..." : "Save Adjustment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}