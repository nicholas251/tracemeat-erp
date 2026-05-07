import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Merge, X } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

// Simple ID generator without uuid dependency
const genId = () => Math.random().toString(36).substring(2, 10);

export default function SubBatchManager({ stage, subBatches, onChange }) {
  const [newBatchQty, setNewBatchQty] = useState("");
  const [selectedForMerge, setSelectedForMerge] = useState([]);

  const activeBatches = subBatches.filter(b => b.status === "active");

  const addBatch = () => {
    if (!newBatchQty) return;
    const idx = subBatches.filter(b => b.status !== "merged").length + 1;
    onChange([...subBatches, {
      sub_batch_id: genId(),
      label: `Batch #${idx}`,
      qty_lbs: Number(newBatchQty),
      merged_from: [],
      racks: 0,
      status: "active"
    }]);
    setNewBatchQty("");
  };

  const removeBatch = (id) => {
    onChange(subBatches.filter(b => b.sub_batch_id !== id));
  };

  const toggleMergeSelect = (id) => {
    setSelectedForMerge(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const mergeBatches = () => {
    if (selectedForMerge.length < 2) return;
    const toBeMerged = subBatches.filter(b => selectedForMerge.includes(b.sub_batch_id));
    const totalQty = toBeMerged.reduce((sum, b) => sum + (b.qty_lbs || 0), 0);
    const mergedBatch = {
      sub_batch_id: genId(),
      label: `Cooking Batch #${subBatches.filter(b => b.merged_from?.length > 0).length + 1}`,
      qty_lbs: totalQty,
      merged_from: selectedForMerge,
      racks: stage?.racks_per_batch || 3,
      status: "active"
    };
    const updated = subBatches.map(b =>
      selectedForMerge.includes(b.sub_batch_id) ? { ...b, status: "merged" } : b
    );
    onChange([...updated, mergedBatch]);
    setSelectedForMerge([]);
  };

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label>Sub-Batches</Label>
        {selectedForMerge.length >= 2 && (
          <Button size="sm" variant="outline" onClick={mergeBatches} className="gap-1 text-xs">
            <Merge className="w-3 h-3" /> Merge Selected ({selectedForMerge.length})
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {subBatches.map(batch => (
          <div
            key={batch.sub_batch_id}
            className={`flex items-center justify-between p-2 rounded border text-sm ${batch.status === "merged" ? "opacity-40 bg-muted/30" : selectedForMerge.includes(batch.sub_batch_id) ? "border-primary bg-primary/5" : "bg-background"}`}
          >
            <div className="flex items-center gap-2">
              {batch.status === "active" && (
                <input
                  type="checkbox"
                  checked={selectedForMerge.includes(batch.sub_batch_id)}
                  onChange={() => toggleMergeSelect(batch.sub_batch_id)}
                  className="w-3.5 h-3.5"
                />
              )}
              <span className="font-medium">{batch.label}</span>
              <span className="text-muted-foreground">{batch.qty_lbs} lbs</span>
              {batch.racks > 0 && <Badge variant="outline" className="text-xs">{batch.racks} racks</Badge>}
              {batch.merged_from?.length > 0 && <Badge variant="secondary" className="text-xs">Merged</Badge>}
              {batch.status === "merged" && <Badge variant="outline" className="text-xs opacity-60">Used</Badge>}
            </div>
            {batch.status === "active" && (
              <Button size="icon" variant="ghost" onClick={() => removeBatch(batch.sub_batch_id)} className="w-6 h-6">
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          step="0.1"
          value={newBatchQty}
          onChange={e => setNewBatchQty(e.target.value)}
          placeholder="Qty (lbs)"
          className="h-7 text-xs"
        />
        <Button size="sm" variant="outline" onClick={addBatch} className="gap-1 text-xs whitespace-nowrap">
          <Plus className="w-3 h-3" /> Add Batch
        </Button>
      </div>
    </div>
  );
}