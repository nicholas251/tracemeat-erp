import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import IngredientLotPicker from "@/components/blending/IngredientLotPicker";

export default function ProduceSpiceMixDialog({ mix, open, onClose, onProduced }) {
  const [batchQty, setBatchQty] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [producing, setProducing] = useState(false);
  const [result, setResult] = useState(null);

  // Reset state whenever a new mix is opened
  React.useEffect(() => {
    if (mix) {
      setBatchQty(mix.quantity_lbs || "");
      setResult(null);
      setIngredients(buildIngredients(mix, mix.quantity_lbs || 0));
    }
  }, [mix]);

  function buildIngredients(m, qty) {
    const scale = m.quantity_lbs ? qty / m.quantity_lbs : 1;
    return (m.ingredients || []).map(ing => ({
      bucket_id: ing.bucket_id,
      bucket_name: ing.bucket_name || ing.name,
      required_lbs: parseFloat(((ing.quantity_lbs || 0) * scale).toFixed(2)),
      lot_allocations: null,
      confirmed: false,
      notes: "",
    }));
  }

  // Recompute required lbs when batch qty changes (resets confirmations)
  const handleQtyChange = (val) => {
    setBatchQty(val);
    setIngredients(buildIngredients(mix, Number(val) || 0));
  };

  const updateIng = (idx, field, value) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  };

  const confirmIng = (idx) => updateIng(idx, "confirmed", true);

  const allConfirmed = ingredients.length > 0 && ingredients.every(i => i.confirmed);

  const handleProduce = async () => {
    if (!allConfirmed || !batchQty) return;
    setProducing(true);
    const ingredientLots = ingredients.map(ing => ({
      bucket_id: ing.bucket_id,
      bucket_name: ing.bucket_name,
      lots: (ing.lot_allocations || []).map(a => ({
        raw_inventory_id: a.raw_inventory_id,
        lot_number: a.lot_number,
        actual_lbs: Number(a.actual_lbs) || 0,
      })),
      notes: ing.notes || "",
    }));
    const res = await base44.functions.invoke("produceSpiceMixBatch", {
      spiceMixId: mix.id,
      batchQtyLbs: Number(batchQty),
      ingredientLots,
    });
    setResult(res.data);
    setProducing(false);
    onProduced?.();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Produce Batch — {mix?.name}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="text-sm space-y-1 border rounded p-3 bg-muted/30">
            <p className="font-medium text-chart-2">✓ Batch produced: {result.batchProduced} lbs</p>
            {result.lotNumber && (
              <p className="text-muted-foreground">Assigned lot: <span className="font-mono font-medium text-foreground">{result.lotNumber}</span></p>
            )}
            <p className="text-muted-foreground">New available: {result.newAvailableQty} lbs</p>
            {result.shortfalls?.length > 0 && (
              <div className="text-destructive mt-1">
                <p className="font-medium">Shortfalls:</p>
                {result.shortfalls.map((s, i) => (
                  <p key={i}>{s.bucket_name}: {s.shortfall.toFixed(1)} lbs short</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Batch Quantity (lbs)</Label>
              <Input
                type="number"
                step="0.1"
                value={batchQty}
                onChange={e => handleQtyChange(e.target.value)}
                placeholder={`Base batch: ${mix?.quantity_lbs} lbs`}
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confirm lots for every ingredient
              </p>
              {ingredients.map((ing, idx) => (
                <div key={ing.bucket_id || idx} className="rounded-lg border p-3">
                  <IngredientLotPicker
                    ing={ing}
                    disabled={ing.confirmed}
                    onChange={(field, value) => updateIng(idx, field, value)}
                    onConfirm={() => confirmIng(idx)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!result && (
            <Button onClick={handleProduce} disabled={producing || !allConfirmed}>
              <CheckCircle2 className="w-4 h-4" />
              {producing ? "Producing..." : "Confirm Produce"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}