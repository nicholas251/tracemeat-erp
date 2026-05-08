import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Link2Off, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Create Bucket inline dialog ─────────────────────────────────────────────
function CreateBucketDialog({ open, onClose, onCreated, suggestedName, category }) {
  const [name, setName] = useState(suggestedName || "");
  const [cat, setCat] = useState(category || "spice");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    const bucket = await base44.entities.InventoryBucket.create({ name, category: cat, status: "active" });
    setSaving(false);
    onCreated(bucket);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Inventory Bucket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Bucket Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Prague Powder #1" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="protein">Protein</SelectItem>
                <SelectItem value="spice">Spice / Cure</SelectItem>
                <SelectItem value="packaging">Packaging</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name || saving}>{saving ? "Creating..." : "Create Bucket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * Props:
 *   product      - full Product entity
 *   recipe       - Recipe entity (with ingredients array)
 *   rawInputLbs  - yield-adjusted raw input lbs needed
 *   onProductUpdated - called after linking a bucket to the product
 */
// ─── Inline casing config dialog ────────────────────────────────────────
function CasingConfigDialog({ open, onClose, product, allBuckets, onSaved }) {
  const [casingPerBatch, setCasingPerBatch] = useState(product?.casing_qty_per_batch_lbs || "");
  const [casingBucketId, setCasingBucketId] = useState(product?.casing_bucket_id || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updates = {};
    if (casingPerBatch) updates.casing_qty_per_batch_lbs = Number(casingPerBatch);
    if (casingBucketId) {
      const b = allBuckets.find(x => x.id === casingBucketId);
      updates.casing_bucket_id = casingBucketId;
      updates.casing_bucket_name = b?.name || "";
    }
    await base44.entities.Product.update(product.id, updates);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect Casing Bucket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-sm">
          <div className="space-y-2">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Casings (Linking)</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Casings per linking batch (lbs)</Label>
              <Input type="number" step="0.01" value={casingPerBatch} onChange={e => setCasingPerBatch(e.target.value)} placeholder="e.g. 5.0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Casing Inventory Bucket</Label>
              <Select value={casingBucketId} onValueChange={setCasingBucketId}>
                <SelectTrigger><SelectValue placeholder="Select bucket..." /></SelectTrigger>
                <SelectContent>{allBuckets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Connecting..." : "Connect Bucket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryShortageCheck({ product: productProp, recipe, rawInputLbs, numBatches, onProductUpdated }) {
  const queryClient = useQueryClient();
  const [createBucketFor, setCreateBucketFor] = useState(null);
  const [showCureCasingConfig, setShowCureCasingConfig] = useState(false);

  const product = productProp;

  const { data: rawInventory = [], isLoading } = useQuery({
    queryKey: ["rawInventoryAvailable"],
    queryFn: () => base44.entities.RawInventory.list("received_date", 500),
    enabled: !!product && rawInputLbs > 0,
  });

  const { data: spiceMixData } = useQuery({
    queryKey: ["spiceMixForCheck", product?.chop_spice_mix_id],
    queryFn: () => base44.entities.SpiceMix.filter({ id: product.chop_spice_mix_id }),
    enabled: !!product?.chop_spice_mix_id,
    select: d => d[0] || null,
  });

  const { data: allBuckets = [] } = useQuery({
    queryKey: ["allBuckets"],
    queryFn: () => base44.entities.InventoryBucket.list(),
    enabled: !!product,
  });

  if (!product || rawInputLbs <= 0) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking inventory...
      </div>
    );
  }

  // Helper: sum available_qty for a bucket across usable lots
  const availableForBucket = (bucketId) =>
    rawInventory
      .filter(lot => lot.bucket_id === bucketId && ["available", "in_use"].includes(lot.status))
      .reduce((s, l) => s + (l.available_qty || 0), 0);

  // ── 1. Blending ingredients (from recipe) ──
  const blendIngredients = recipe?.ingredients || [];
  const recipeTotalLbs = blendIngredients.reduce((s, i) => s + (i.quantity_lbs || 0), 0);
  const blendRatio = recipeTotalLbs > 0 ? rawInputLbs / recipeTotalLbs : 1;

  const blendChecks = blendIngredients.map(ing => {
    const needed = parseFloat((ing.quantity_lbs * blendRatio).toFixed(2));
    const available = parseFloat(availableForBucket(ing.bucket_id).toFixed(2));
    return {
      stage: "Blending",
      name: ing.bucket_name || "Unknown",
      needed,
      available,
      shortfall: parseFloat(Math.max(0, needed - available).toFixed(2)),
      bucketId: ing.bucket_id,
      linked: !!ing.bucket_id,
    };
  });

  // ── 2. Spice mix (chopping) ──
  // Use numBatches from parent (accounts for full chop weight incl. water/spice/cure)
  const numChopBatches = numBatches || 1;
  const spiceChecks = [];

  if (product.chop_spice_mix_id) {
    const spiceNeeded = parseFloat(((product.chop_spice_qty_lbs || 0) * numChopBatches).toFixed(2));
    // SpiceMix available_qty_lbs
    const spiceAvail = parseFloat((spiceMixData?.available_qty_lbs || 0).toFixed(2));
    spiceChecks.push({
      stage: "Chopping",
      name: product.chop_spice_mix_name || "Spice Mix",
      needed: spiceNeeded,
      available: spiceAvail,
      shortfall: parseFloat(Math.max(0, spiceNeeded - spiceAvail).toFixed(2)),
      linked: true, // SpiceMix itself is the unit, no separate bucket needed
    });
  }

  // ── 3. Cure (chopping) – skip for now, handled in product config ──
  const cureChecks = [];

  // ── 4. Casings (linking) ──
  // Linking batches = chop batches (1:1) unless merge is enabled, then divided by merge ratio
  const mergeBatches = product.link_merge_batches && product.link_merge_ratio > 1;
  const numLinkBatches = mergeBatches ? Math.ceil(numChopBatches / product.link_merge_ratio) : numChopBatches;

  const casingChecks = [];
  if (product.casing_qty_per_batch_lbs) {
    const casingNeeded = parseFloat(((product.casing_qty_per_batch_lbs || 0) * numLinkBatches).toFixed(2));
    if (product.casing_bucket_id) {
      const casingAvail = parseFloat(availableForBucket(product.casing_bucket_id).toFixed(2));
      casingChecks.push({
        stage: "Linking",
        name: product.casing_bucket_name || "Casings",
        needed: casingNeeded,
        available: casingAvail,
        shortfall: parseFloat(Math.max(0, casingNeeded - casingAvail).toFixed(2)),
        linked: true,
      });
    } else {
      casingChecks.push({
        stage: "Linking",
        name: "Casings",
        needed: casingNeeded,
        available: 0,
        shortfall: casingNeeded,
        linked: false,
        linkAction: {
          label: "Link casing bucket",
          suggestedName: "Casings",
          category: "spice",
          fieldId: "casing",
          fieldName: "casing_bucket",
        },
      });
    }
  }

  const allChecks = [...blendChecks, ...spiceChecks, ...casingChecks];
  if (allChecks.length === 0) return null;

  const hasShortage = allChecks.some(c => !c.linked || c.shortfall > 0);
  const hasUnlinked = allChecks.some(c => !c.linked);
  const missingCasingConfig = !product.casing_qty_per_batch_lbs;

  const handleCasingConfigSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["freshProductForOrder", product.id] });
    onProductUpdated?.();
  };

  // ── Handlers ──
  const handleLinkExistingBucket = async (fieldId, bucketId) => {
    const bucket = allBuckets.find(b => b.id === bucketId);
    if (!bucket || !product?.id) return;
    const updates = fieldId === "cure"
      ? { cure_bucket_id: bucketId, cure_bucket_name: bucket.name }
      : { casing_bucket_id: bucketId, casing_bucket_name: bucket.name };
    await base44.entities.Product.update(product.id, updates);
    queryClient.invalidateQueries({ queryKey: ["rawInventoryAvailable"] });
    queryClient.invalidateQueries({ queryKey: ["freshProductForOrder", product.id] });
    onProductUpdated?.();
  };

  const handleBucketCreated = async (bucket) => {
    const fieldId = createBucketFor?.fieldId;
    setCreateBucketFor(null);
    if (!fieldId || !product?.id) return;
    const updates = fieldId === "cure"
      ? { cure_bucket_id: bucket.id, cure_bucket_name: bucket.name }
      : { casing_bucket_id: bucket.id, casing_bucket_name: bucket.name };
    await base44.entities.Product.update(product.id, updates);
    queryClient.invalidateQueries({ queryKey: ["rawInventoryAvailable"] });
    queryClient.invalidateQueries({ queryKey: ["allBuckets"] });
    queryClient.invalidateQueries({ queryKey: ["freshProductForOrder", product.id] });
    onProductUpdated?.();
  };

  // Group by stage for display
  const stages = ["Blending", "Chopping", "Linking"];

  return (
    <>
      <div className={`rounded-md border text-xs ${hasShortage ? "border-destructive/40 bg-destructive/5" : "border-chart-2/40 bg-chart-2/5"}`}>
        <div className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b ${hasShortage ? "border-destructive/20 text-destructive" : "border-chart-2/20 text-chart-2"}`}>
          {hasShortage
            ? <><AlertTriangle className="w-3.5 h-3.5" /> {hasUnlinked ? "Some ingredients not linked to inventory buckets" : "Ingredient Shortages Detected"}</>
            : <><CheckCircle2 className="w-3.5 h-3.5" /> All Ingredients Available</>
          }
        </div>

        {missingCasingConfig && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200/60">
            <span className="text-amber-700 text-xs">
              Casing quantities not configured on this product
            </span>
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setShowCureCasingConfig(true)}>
              <Link2Off className="w-3 h-3" /> Connect Bucket
            </Button>
          </div>
        )}

        {stages.map(stageName => {
          const stageChecks = allChecks.filter(c => c.stage === stageName);
          if (stageChecks.length === 0) return null;
          return (
            <div key={stageName}>
              <div className="px-3 py-1 bg-muted/30 font-semibold text-muted-foreground uppercase tracking-wide" style={{ fontSize: "10px" }}>
                {stageName}
              </div>
              {stageChecks.map((c, i) => (
                <div key={i} className="px-3 py-2 border-t border-border/30">
                  {!c.linked ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Link2Off className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        <span className="text-amber-700 font-medium">{c.name} — not linked to a bucket</span>
                        <span className="ml-auto text-muted-foreground">{c.needed} lbs needed</span>
                      </div>
                      <div className="flex gap-2 ml-5">
                        {/* Link existing bucket */}
                        <Select onValueChange={v => handleLinkExistingBucket(c.linkAction.fieldId, v)}>
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue placeholder="Link existing bucket..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allBuckets.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 px-2"
                          onClick={() => setCreateBucketFor(c.linkAction)}
                        >
                          <Plus className="w-3 h-3" /> New Bucket
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground truncate flex-1">{c.name}</span>
                      <span className="font-medium tabular-nums">{c.available} / {c.needed} lbs</span>
                      {c.shortfall > 0
                        ? <span className="text-destructive font-semibold tabular-nums whitespace-nowrap">−{c.shortfall} lbs</span>
                        : <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 flex-shrink-0" />
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {showCureCasingConfig && (
        <CasingConfigDialog
          open={showCureCasingConfig}
          onClose={() => setShowCureCasingConfig(false)}
          product={product}
          allBuckets={allBuckets}
          onSaved={handleCasingConfigSaved}
        />
      )}

      {createBucketFor && (
        <CreateBucketDialog
          open={!!createBucketFor}
          onClose={() => setCreateBucketFor(null)}
          onCreated={handleBucketCreated}
          suggestedName={createBucketFor.suggestedName}
          category={createBucketFor.category}
        />
      )}
    </>
  );
}