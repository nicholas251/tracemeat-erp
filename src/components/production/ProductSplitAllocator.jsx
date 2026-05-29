import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export default function ProductSplitAllocator({ compatibleProducts = [], splits = [], onChange, totalLbs = 0 }) {
  const [localSplits, setLocalSplits] = useState(splits && splits.length > 0 ? splits : []);

  useEffect(() => {
    onChange(localSplits);
  }, [localSplits]);

  const addSplit = () => {
    const newSplit = {
      product_id: compatibleProducts[0]?.id || "",
      product_name: compatibleProducts[0]?.name || "",
      quantity_lbs: 0,
    };
    setLocalSplits([...localSplits, newSplit]);
  };

  const updateSplit = (idx, field, value) => {
    const updated = [...localSplits];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "product_id") {
      const product = compatibleProducts.find(p => p.id === value);
      updated[idx].product_name = product?.name || "";
    }
    setLocalSplits(updated);
  };

  const removeSplit = (idx) => {
    setLocalSplits(localSplits.filter((_, i) => i !== idx));
  };

  const totalAllocated = localSplits.reduce((s, sp) => s + (Number(sp.quantity_lbs) || 0), 0);
  const isBalanced = totalAllocated > 0 && totalAllocated === totalLbs;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Split Packaging Output</Label>
        <p className="text-xs text-muted-foreground">Allocate finished goods across compatible products</p>
      </div>

      {localSplits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">No splits configured yet</p>
          <Button size="sm" variant="outline" onClick={addSplit} className="gap-2">
            <Plus className="w-4 h-4" /> Add Product Split
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {localSplits.map((split, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Product</Label>
                    <Select value={split.product_id || ""} onValueChange={(val) => updateSplit(idx, "product_id", val)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleProducts.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Quantity (lbs)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={split.quantity_lbs || ""}
                      onChange={(e) => updateSplit(idx, "quantity_lbs", Number(e.target.value))}
                      className="h-9 text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSplit(idx)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            size="sm"
            variant="outline"
            onClick={addSplit}
            className="w-full gap-2"
          >
            <Plus className="w-4 h-4" /> Add Another Split
          </Button>
        </div>
      )}

      {localSplits.length > 0 && totalLbs > 0 && (
        <div className={`rounded-lg border p-3 space-y-2 ${isBalanced ? "border-chart-2/30 bg-chart-2/5" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Allocated</span>
            <span className={`font-semibold ${isBalanced ? "text-chart-2" : "text-amber-700"}`}>
              {totalAllocated.toFixed(2)} / {totalLbs.toFixed(2)} lbs
            </span>
          </div>
          {!isBalanced && (
            <p className={`text-xs ${isBalanced ? "text-chart-2" : "text-amber-700"}`}>
              {totalAllocated < totalLbs
                ? `Remaining: ${(totalLbs - totalAllocated).toFixed(2)} lbs`
                : `Over by: ${(totalAllocated - totalLbs).toFixed(2)} lbs`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}