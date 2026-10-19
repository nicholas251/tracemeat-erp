import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CasingInventoryFields({ form, update, buckets }) {
  const casingBuckets = buckets.filter(b => b.category === "casing");
  return (
    <div className="md:col-span-2 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <p className="text-sm font-medium">Casing Inventory (Linking)</p>
        <p className="text-xs text-muted-foreground">Casings deducted from inventory per linking batch.</p>
      </div>
      <div className="space-y-2">
        <Label>Casing Bucket</Label>
        <Select
          value={form.casing_bucket_id || ""}
          onValueChange={v => {
            update("casing_bucket_id", v);
            update("casing_bucket_name", casingBuckets.find(b => b.id === v)?.name || "");
          }}
        >
          <SelectTrigger className="bg-slate-200 border-slate-400"><SelectValue placeholder="Select casing bucket..." /></SelectTrigger>
          <SelectContent>
            {casingBuckets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Casings per Linking Batch (lbs)</Label>
        <Input
          type="number"
          value={form.casing_qty_per_batch_lbs ?? ""}
          onChange={e => update("casing_qty_per_batch_lbs", e.target.value === "" ? null : Number(e.target.value))}
          placeholder="e.g. 5"
        />
      </div>
    </div>
  );
}