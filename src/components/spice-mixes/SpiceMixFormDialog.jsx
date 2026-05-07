import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { X, Plus } from "lucide-react";

function lbsOzToLbs(lbs, oz) {
  return (Number(lbs) || 0) + (Number(oz) || 0) / 16;
}

export default function SpiceMixFormDialog({ open, onClose, onSave, mix }) {
  const [form, setForm] = useState({
    name: "",
    quantity_lbs: "",
    available_qty_lbs: "",
    status: "draft",
    ingredients: [],
    notes: "",
  });

  const [newIng, setNewIng] = useState({ bucket_id: "", bucket_name: "", lbs: "", oz: "" });

  useEffect(() => {
    if (mix) {
      setForm(mix);
    } else {
      setForm({ name: "", quantity_lbs: "", available_qty_lbs: "", status: "draft", ingredients: [], notes: "" });
    }
    setNewIng({ bucket_id: "", bucket_name: "", lbs: "", oz: "" });
  }, [mix, open]);

  const { data: buckets = [] } = useQuery({
    queryKey: ["spice_buckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ status: "active", category: "spice" }),
    enabled: open,
  });

  // Fetch raw inventory to get available quantities per bucket
  const { data: rawInventory = [] } = useQuery({
    queryKey: ["raw_inventory_spice"],
    queryFn: () => base44.entities.RawInventory.filter({ bucket_category: "spice", status: "available" }),
    enabled: open,
  });

  // Sum available qty per bucket_id
  const availableByBucket = rawInventory.reduce((acc, row) => {
    acc[row.bucket_id] = (acc[row.bucket_id] || 0) + (row.available_qty || 0);
    return acc;
  }, {});

  const handleBucketSelect = (bucketId) => {
    const bucket = buckets.find(b => b.id === bucketId);
    setNewIng({ ...newIng, bucket_id: bucketId, bucket_name: bucket?.name || "" });
  };

  const handleAddIngredient = () => {
    if (!newIng.bucket_id || (!newIng.lbs && !newIng.oz)) return;
    const qty = lbsOzToLbs(newIng.lbs, newIng.oz);
    setForm({
      ...form,
      ingredients: [...(form.ingredients || []), {
        bucket_id: newIng.bucket_id,
        bucket_name: newIng.bucket_name,
        quantity_lbs: qty,
      }]
    });
    setNewIng({ bucket_id: "", bucket_name: "", lbs: "", oz: "" });
  };

  const handleRemoveIngredient = (idx) => {
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    if (!form.name || !form.quantity_lbs) return;
    onSave({
      ...form,
      quantity_lbs: Number(form.quantity_lbs),
      available_qty_lbs: mix ? Number(form.available_qty_lbs) : Number(form.quantity_lbs),
      date_created: mix?.date_created || new Date().toISOString().split('T')[0],
    });
  };

  const selectedBucketAvail = availableByBucket[newIng.bucket_id];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mix ? "Edit Spice Mix" : "Create Spice Mix"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mix Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Classic Hot Dog Blend"
            />
          </div>

          <div className="space-y-2">
            <Label>Total Batch Quantity (lbs)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.quantity_lbs}
              onChange={e => setForm({ ...form, quantity_lbs: e.target.value })}
              placeholder="e.g., 50"
            />
          </div>

          {mix && (
            <div className="space-y-2">
              <Label>Available Quantity (lbs)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.available_qty_lbs}
                onChange={e => setForm({ ...form, available_qty_lbs: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ingredients */}
          <div className="space-y-3">
            <Label>Ingredients</Label>

            {/* Existing ingredients */}
            {form.ingredients?.length > 0 && (
              <div className="space-y-2">
                {form.ingredients.map((ing, idx) => {
                  const totalOz = Math.round((ing.quantity_lbs % 1) * 16);
                  const wholeLbs = Math.floor(ing.quantity_lbs);
                  return (
                    <Card key={idx} className="p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <p className="font-medium">{ing.bucket_name}</p>
                        <p className="text-muted-foreground">
                          {wholeLbs > 0 ? `${wholeLbs} lb${wholeLbs !== 1 ? "s" : ""}` : ""}
                          {wholeLbs > 0 && totalOz > 0 ? " " : ""}
                          {totalOz > 0 ? `${totalOz} oz` : ""}
                          {wholeLbs === 0 && totalOz === 0 ? `${ing.quantity_lbs} lbs` : ""}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleRemoveIngredient(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Add new ingredient */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Add Ingredient</Label>
              {buckets.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No spice buckets found. Add spice buckets in Inventory first.</p>
              ) : (
                <>
                  <Select value={newIng.bucket_id} onValueChange={handleBucketSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select spice bucket..." />
                    </SelectTrigger>
                    <SelectContent>
                      {buckets.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          <span>{b.name}</span>
                          {availableByBucket[b.id] !== undefined && (
                            <span className="ml-2 text-xs text-muted-foreground">({availableByBucket[b.id].toFixed(1)} lbs avail.)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {newIng.bucket_id && selectedBucketAvail !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Available in inventory: <span className="font-medium text-foreground">{selectedBucketAvail.toFixed(2)} lbs</span>
                    </p>
                  )}

                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Pounds (lbs)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={newIng.lbs}
                        onChange={e => setNewIng({ ...newIng, lbs: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Ounces (oz)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="15"
                        step="0.1"
                        value={newIng.oz}
                        onChange={e => setNewIng({ ...newIng, oz: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <Button size="sm" onClick={handleAddIngredient} variant="outline" className="w-full gap-1">
                    <Plus className="w-3 h-3" /> Add Ingredient
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special notes..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{mix ? "Update" : "Create"} Mix</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}