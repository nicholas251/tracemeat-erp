import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AllocationDialog({ open, onClose, onSave, material }) {
  const [allocated, setAllocated] = useState(0);
  const [parLevel, setParLevel] = useState(0);

  useEffect(() => {
    if (material) {
      setAllocated(material.allocated_qty_lbs || 0);
      setParLevel(material.par_level || 0);
    }
  }, [material, open]);

  const handleSave = () => {
    onSave({ allocated: Number(allocated), parLevel: Number(parLevel) });
    setAllocated(0);
    setParLevel(0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Allocation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm font-medium">{material?.name}</p>
            <p className="text-xs text-muted-foreground">Lot: {material?.lot_number}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted p-2 rounded">
              <p className="text-xs text-muted-foreground">Total Available</p>
              <p className="font-semibold">{(material?.available_qty_lbs || 0).toFixed(0)} lbs</p>
            </div>
            <div className="bg-muted p-2 rounded">
              <p className="text-xs text-muted-foreground">Total Qty</p>
              <p className="font-semibold">{(material?.quantity_lbs || 0).toFixed(0)} lbs</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Allocated to Production (lbs)</Label>
            <Input 
              type="number" 
              value={allocated}
              onChange={e => setAllocated(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Par Level (lbs)</Label>
            <Input 
              type="number" 
              value={parLevel}
              onChange={e => setParLevel(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Update Allocation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}