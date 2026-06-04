import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Boxes } from "lucide-react";
import IngredientLotPicker from "../blending/IngredientLotPicker";
import SpiceMixLotPicker from "./SpiceMixLotPicker";

/**
 * TumbleSpiceSource
 *
 * Lets the operator choose whether the seasoning comes from a produced SpiceMix
 * (default) OR a raw spice InventoryBucket, then pick the specific lot(s).
 *
 * Emits via onChange one of two shapes inside the parent value:
 *   - SpiceMix:    { spice_source: "spice_mix", spice_mix: { lots, ... } }
 *   - Raw bucket:  { spice_source: "raw_bucket", spiceBucketId, spiceBucketName,
 *                    spiceBucketLots: [{ lot_number, raw_inventory_id, actual_lbs }] }
 *
 * Props:
 *   requiredLbs     – seasoning required
 *   product         – Product record (for default mix hint)
 *   value           – current TumbleLotTracking value object
 *   onPatch         – (patch) => void  (merges into parent value)
 */
export default function TumbleSpiceSource({ requiredLbs = 0, product, value = {}, onPatch }) {
  const source = value.spice_source || "spice_mix";

  const { data: spiceBuckets = [] } = useQuery({
    queryKey: ["spiceInventoryBuckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ category: "spice", status: "active" }),
  });

  const spiceBucketId = value.spiceBucketId || "";
  const spiceBucketName = spiceBuckets.find(b => b.id === spiceBucketId)?.name || "";

  const spiceBucketIng = {
    bucket_id: spiceBucketId,
    bucket_name: spiceBucketName || "Spice",
    required_lbs: parseFloat((requiredLbs || 0).toFixed(2)),
    lot_allocations: value.spiceBucketLots || null,
    confirmed: value.spiceBucketConfirmed || false,
    notes: value.spiceBucketNotes || "",
  };

  return (
    <div className="rounded-xl border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spice Used</p>
        {product?.chop_spice_mix_name && source === "spice_mix" && (
          <Badge variant="secondary" className="text-xs">{product.chop_spice_mix_name}</Badge>
        )}
      </div>

      {/* Source toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPatch({ spice_source: "spice_mix" })}
          className={`flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors ${
            source === "spice_mix" ? "border-chart-1 bg-chart-1/10 text-chart-1" : "border-border text-muted-foreground hover:bg-muted/40"
          }`}
        >
          <FlaskConical className="w-4 h-4" /> Spice Mix
        </button>
        <button
          type="button"
          onClick={() => onPatch({ spice_source: "raw_bucket" })}
          className={`flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors ${
            source === "raw_bucket" ? "border-chart-1 bg-chart-1/10 text-chart-1" : "border-border text-muted-foreground hover:bg-muted/40"
          }`}
        >
          <Boxes className="w-4 h-4" /> Raw Spice Bucket
        </button>
      </div>

      {source === "spice_mix" ? (
        <SpiceMixLotPicker
          label=""
          requiredLbs={requiredLbs}
          value={value.spice_mix || {}}
          shortNotes={value.spiceShortNotes}
          onShortNotesChange={(v) => onPatch({ spiceShortNotes: v })}
          onChange={(val) => onPatch({ spice_mix: val })}
        />
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">Spice Bucket</Label>
            <Select
              value={spiceBucketId}
              onValueChange={(v) =>
                onPatch({
                  spiceBucketId: v,
                  spiceBucketName: spiceBuckets.find(b => b.id === v)?.name || "",
                  spiceBucketLots: null,
                })
              }
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Select spice bucket..." />
              </SelectTrigger>
              <SelectContent>
                {spiceBuckets.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
                {spiceBuckets.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No spice buckets found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {spiceBucketId && (
            <IngredientLotPicker
              ing={spiceBucketIng}
              disabled={value.spiceBucketConfirmed || false}
              onChange={(field, val) => {
                if (field === "lot_allocations") onPatch({ spiceBucketLots: val });
                else if (field === "notes") onPatch({ spiceBucketNotes: val });
              }}
              onConfirm={() => onPatch({ spiceBucketConfirmed: true })}
            />
          )}
        </div>
      )}
    </div>
  );
}