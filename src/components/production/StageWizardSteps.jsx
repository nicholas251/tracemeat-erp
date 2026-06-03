import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, ChevronRight, ChevronLeft, Play, AlertCircle } from "lucide-react";
import IngredientLotPicker from "../blending/IngredientLotPicker";
import LinkingCookBatchBuilder from "./LinkingCookBatchBuilder";
import TumbleCookBatchBuilder from "./TumbleCookBatchBuilder";
import RackReleaseBuilder from "./RackReleaseBuilder";
import SmokehouseCookBatchBuilder from "./SmokehouseCookBatchBuilder";
import SpiceMixLotPicker from "./SpiceMixLotPicker";
import TumbleLotTracking from "./TumbleLotTracking";
import ProductSplitAllocator from "./ProductSplitAllocator";

export function IntroStep({ stage, capKey, stageLabel, resolvedBatches, measureSteps, product, saving, onStart, usesIngredientBatches }) {
  const isAlreadyStarted = stage?.status === "in_progress";
  const isCooking = capKey === "cooking";
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-chart-1/10 border border-chart-1/20 p-5 space-y-4">
        <div>
          <p className="font-bold text-chart-1 text-base">
            {isAlreadyStarted ? `Continue ${stageLabel}` : `Ready to start ${stageLabel}`}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isCooking
              ? "Select released racks to load into an oven and build a cook batch."
              : <><span className="font-semibold text-foreground">{stage?.input_qty_lbs} lbs</span> entering this stage</>}
          </p>
        </div>

        {usesIngredientBatches && resolvedBatches && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Batches to Complete</p>
            {resolvedBatches.map(b => (
              <div key={b.batchNumber} className="flex items-center gap-3 bg-white/50 rounded-lg px-3 py-2.5">
                <span className="w-7 h-7 rounded-full bg-chart-1/20 text-chart-1 text-sm flex items-center justify-center font-bold shrink-0">{b.batchNumber}</span>
                <span className="font-semibold text-sm">{b.batchLbs} lbs</span>
                <span className="text-muted-foreground text-sm">· {b.ingredients.length} ingredient{b.ingredients.length !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}

        {!usesIngredientBatches && measureSteps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Steps in this stage</p>
            {measureSteps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 bg-white/50 rounded-lg px-3 py-2.5">
                <span className="w-7 h-7 rounded-full bg-chart-1/20 text-chart-1 text-sm flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {usesIngredientBatches && !resolvedBatches && (
          <p className="text-sm text-muted-foreground">Loading batch plan...</p>
        )}
      </div>

      <Button
        className="w-full h-12 text-base gap-2 font-semibold"
        onClick={onStart}
        disabled={saving || (usesIngredientBatches && !resolvedBatches)}
      >
        <Play className="w-5 h-5" />
        {isAlreadyStarted ? `Continue ${stageLabel}` : `Start ${stageLabel}`}
      </Button>
    </div>
  );
}

export function BatchConfirmStep({ batch, batchIdx, totalBatches, progressPct, onUpdateIngredient, onConfirmIngredient, allConfirmed, onBack, onComplete, saving }) {
  return (
    <div className="space-y-5">
      <ProgressBar current={batch.batchNumber} total={totalBatches} pct={progressPct} label="Batch" />

      <div className="rounded-xl bg-muted/40 border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-base">Blend Batch #{batch.batchNumber}</p>
          <p className="text-sm text-muted-foreground">{batch.batchLbs} lbs</p>
        </div>
        {allConfirmed && (
          <CheckCircle2 className="w-5 h-5 text-chart-2" />
        )}
      </div>

      {batch.ingredients.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Confirm each ingredient</p>
          {batch.ingredients.map((ing, ingIdx) => (
            <Card key={ingIdx} className={`border-2 transition-colors ${ing.confirmed ? "border-chart-2/40 bg-chart-2/5" : "border-border"}`}>
              <CardContent className="p-4">
                <IngredientLotPicker
                  ing={ing}
                  disabled={ing.confirmed}
                  onChange={(field, value) => onUpdateIngredient(batchIdx, ingIdx, field, value)}
                  onConfirm={() => onConfirmIngredient(batchIdx, ingIdx)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack} disabled={saving}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          className="flex-1 gap-2 h-11 text-base font-semibold bg-chart-2 hover:bg-chart-2/90"
          disabled={!allConfirmed || saving}
          onClick={onComplete}
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? "Saving…" : `Complete Batch #${batch.batchNumber}`}
        </Button>
      </div>
    </div>
  );
}

export function MeasureStep({ stepDef, stepIndex, totalSteps, progressPct, form, setForm, casingBuckets, cureInventory = [], compatibleHotdogProducts = [], capKey, stage, product, cookBatch, setCookBatch, cookPlan, setCookPlan, onBack, onNext, isLast, autoCalculatedCases = 0 }) {
  const [spiceShortNotes, setSpiceShortNotes] = React.useState("");
  const [caseWeights, setCaseWeights] = React.useState(form.case_weights || []);

  React.useEffect(() => {
    const defaults = {};
    for (const field of stepDef.fields) {
      if (field.defaultValue !== undefined && (form[field.key] === undefined || form[field.key] === "")) {
        defaults[field.key] = field.defaultValue;
      }
      if (field.key === "temperature_f" && stage?.temperature_c && !form.temperature_f) {
        defaults[field.key] = parseFloat(((stage.temperature_c * 9/5) + 32).toFixed(2));
      }
    }
    if (Object.keys(defaults).length > 0) {
      setForm(f => ({ ...defaults, ...f }));
    }
  }, [stepDef.id]);
  const isLinking = capKey === "linking" && stepDef.id === "linking";
  const isTumble = (capKey === "tumble" || capKey === "tumbling") && stepDef.id === "tumble" && !stepDef.simpleTumble;
  const isSimpleTumble = (capKey === "tumble" || capKey === "tumbling") && stepDef.id === "tumble" && stepDef.simpleTumble;
  const isRacking = (capKey === "racking" || capKey === "racking_product") && stepDef.id === "racking";
  const isPackaging = capKey === "packaging" && stepDef.id === "packaging" && product?.varied_weights;
  const isMixerInputs = capKey === "mixer" && stepDef.id === "mixer_inputs";

  const spiceField = stepDef.fields.find(f => f.type === "spice_mix_picker");
  const spiceValue = spiceField ? form[spiceField.key] : null;
  const spiceTotalAllocated = spiceValue?.lots
    ? spiceValue.lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0)
    : (Number(spiceValue?.spice_mix_qty_lbs) || 0);
  const spiceRequired = spiceField?.requiredLbs || 0;
  const spiceIsShort = spiceRequired > 0 && spiceTotalAllocated > 0 && spiceTotalAllocated < spiceRequired - 0.001;
  const spiceBlocksNext = spiceIsShort && !spiceShortNotes?.trim();

  const isCookStage = capKey === "cooking" && stepDef.id === "cook";
  const tempTooLow = isCookStage && form.temperature_f !== undefined && form.temperature_f !== "" && Number(form.temperature_f) < 165;
  const lowTempBlocksNext = tempTooLow && !form.notes?.trim();
  // Cooking now requires the operator to assemble a cook batch from released racks first.
  const cookNeedsBatch = isCookStage && !cookBatch;

  const canProceed = isLinking ? !!cookBatch
     : isTumble ? !!cookPlan
     : isSimpleTumble ? (
          !!form.protein_confirmed &&
          (Number(form.spice_mix_qty_lbs) > 0 || !product?.chop_spice_mix_id)
        )
     : isRacking ? (cookPlan?.racks?.some(r => r.released))
     : isPackaging ? (form.case_count > 0 && caseWeights.length === parseInt(form.case_count))
     : isMixerInputs ? (!!form.pork_lot_confirmed && (stage?.binder_lot_number ? !!form.binder_lot_confirmed : false))
     : isCookStage ? (!lowTempBlocksNext && !cookNeedsBatch)
     : !spiceBlocksNext;

  return (
    <div className="space-y-5">
      <ProgressBar current={stepIndex + 1} total={totalSteps} pct={progressPct} label="Step" />

      <div className="rounded-xl bg-muted/40 border px-4 py-3">
        <p className="font-bold text-base">{stepDef.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Step {stepIndex + 1} of {totalSteps}</p>
      </div>

      {stepDef.fields.length > 0 && (
        <div className="space-y-4">
          {stepDef.fields.map(field => (
           <FieldInput
             key={field.key}
             field={field}
             value={form[field.key]}
             casingBuckets={casingBuckets}
             cureInventory={cureInventory}
             compatibleHotdogProducts={compatibleHotdogProducts}
             totalLbs={form.output_qty_lbs || stage?.input_qty_lbs || 0}
             remainingCases={capKey === "packaging" ? autoCalculatedCases - (Number(form.packages_produced) || 0) : 0}
             spiceShortNotes={spiceShortNotes}
             onSpiceShortNotesChange={setSpiceShortNotes}
             onChange={val => {
                if (field.type === "spice_mix_picker") {
                  setForm(f => ({
                    ...f,
                    spice_mix: val,
                    spice_mix_id: val.spice_mix_id || "",
                    spice_mix_name: val.spice_mix_name || "",
                    spice_mix_lot_number: val.spice_mix_lot_number || "",
                    spice_mix_qty_lbs: val.spice_mix_qty_lbs || 0,
                  }));
                } else {
                  setForm(f => ({ ...f, [field.key]: val }));
                }
              }}
              onCasingSelect={(id, name) => setForm(f => ({ ...f, casing_bucket_id: id, casing_bucket_name: name }))}
            />
          ))}
        </div>
      )}

      {isCookStage && tempTooLow && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Temperature Below 165°F</p>
              <p className="text-xs text-amber-800 mt-0.5">Notes are required for temperatures below 165°F safety threshold.</p>
            </div>
          </div>
        </div>
      )}

      {isMixerInputs && (
        <div className="rounded-xl border border-chart-1/30 bg-chart-1/5 p-4 space-y-3">
          <p className="text-xs font-bold text-chart-1 uppercase tracking-wider">Batches Being Combined</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 text-sm">
              <div>
                <span className="font-semibold">Pork Batch</span>
                <span className="text-muted-foreground text-xs ml-2">from Blending</span>
              </div>
              <span className="font-mono text-xs font-bold">{stage?.pork_lot_number || stage?.input_lot_number || "—"}</span>
            </div>
            <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 text-sm">
              <div>
                <span className="font-semibold">Binder Batch</span>
                <span className="text-muted-foreground text-xs ml-2">from Bowl Chopper</span>
              </div>
              <span className="font-mono text-xs font-bold">{stage?.binder_lot_number || "awaiting chopper"}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Both batches must be confirmed before proceeding to mix.</p>
        </div>
      )}

      {isLinking && (
        <LinkingCookBatchBuilder
          stage={stage}
          cookBatch={cookBatch}
          onChange={setCookBatch}
        />
      )}

      {isTumble && (
        <TumbleCookBatchBuilder
          totalLbs={stage?.input_qty_lbs || 0}
          product={product}
          cookPlan={cookPlan}
          onChange={setCookPlan}
        />
      )}

      {isSimpleTumble && (
        <TumbleLotTracking
          totalLbs={stage?.input_qty_lbs || 0}
          product={product}
          value={form.tumble_tracking || {}}
          notes={form.notes}
          onNotesChange={val => setForm(f => ({ ...f, notes: val }))}
          onChange={val => setForm(f => ({
            ...f,
            tumble_tracking: val,
            protein_lots: val.proteinLots || null,
            protein_confirmed: val.proteinConfirmed || false,
            protein_bucket_id: val.proteinBucketId || "",
            protein_bucket_name: val.proteinBucketName || "",
            spice_mix: val.spice_mix || {},
            spice_mix_id: val.spice_mix_id || "",
            spice_mix_name: val.spice_mix_name || "",
            spice_mix_lot_number: val.spice_mix_lot_number || "",
            spice_mix_qty_lbs: val.spice_mix_qty_lbs || 0,
            tumble_batches: val.batches || [],
          }))}
        />
      )}

      {isRacking && (
        <RackReleaseBuilder
          totalLbs={form.output_qty_lbs || stage?.input_qty_lbs || 0}
          plan={cookPlan}
          onChange={setCookPlan}
        />
      )}

      {isCookStage && (
        <SmokehouseCookBatchBuilder
          stage={stage}
          cookBatch={cookBatch}
          onChange={setCookBatch}
        />
      )}

      {isPackaging && (
        <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
          <div>
            <p className="font-semibold text-sm">Individual Case Weights</p>
            <p className="text-xs text-muted-foreground">Enter weight for each case ({form.case_count} total)</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: parseInt(form.case_count) || 0 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <label className="text-xs font-medium">Case {i + 1}</label>
                <input
                  type="number"
                  step="0.01"
                  value={caseWeights[i]?.weight_lbs || ""}
                  onChange={(e) => {
                    const updated = [...caseWeights];
                    if (!updated[i]) updated[i] = {};
                    updated[i].weight_lbs = e.target.value ? Number(e.target.value) : 0;
                    updated[i].case_number = i + 1;
                    setCaseWeights(updated);
                    setForm(prev => ({ ...prev, case_weights: updated }));
                  }}
                  className="h-8 px-2 border border-input rounded text-sm"
                  placeholder="lbs"
                />
              </div>
            ))}
          </div>
          {caseWeights.length > 0 && (
            <div className="pt-2 border-t border-border text-xs space-y-1">
              <p className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{caseWeights.reduce((s, c) => s + (c.weight_lbs || 0), 0).toFixed(2)} lbs</span></p>
              <p className="text-muted-foreground">Average: <span className="font-semibold text-foreground">{(caseWeights.reduce((s, c) => s + (c.weight_lbs || 0), 0) / caseWeights.length).toFixed(2)} lbs</span></p>
            </div>
          )}
        </div>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!canProceed}
        nextLabel={isLast ? "Review & Complete" : "Next Step"}
      />
    </div>
  );
}

export function FieldInput({ field, value, onChange, casingBuckets = [], cureInventory = [], compatibleHotdogProducts = [], totalLbs = 0, remainingCases = 0, onCasingSelect, spiceShortNotes, onSpiceShortNotesChange }) {
  if (field.type === "finished_product_split") {
    return (
      <ProductSplitAllocator
        compatibleProducts={compatibleHotdogProducts}
        splits={value || []}
        onChange={onChange}
        totalLbs={totalLbs}
        remainingCases={remainingCases}
      />
    );
  }
  if (field.type === "finished_product_select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Same as original product (default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Same as original product (default)</SelectItem>
            {compatibleHotdogProducts.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "spice_mix_picker") {
    return (
      <SpiceMixLotPicker
        label={field.label}
        requiredLbs={field.requiredLbs || 0}
        value={value || {}}
        onChange={onChange}
        filterSpiceMixId={field.filterSpiceMixId}
        shortNotes={spiceShortNotes}
        onShortNotesChange={onSpiceShortNotesChange}
      />
    );
  }
  if (field.type === "casing_select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Select value={value || ""} onValueChange={v => {
          const bucket = (field.options || casingBuckets).find(b => b.id === v);
          onCasingSelect(v, bucket?.name || "");
        }}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select casings..." /></SelectTrigger>
          <SelectContent>
            {(field.options || casingBuckets).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "cure_select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder={cureInventory.length === 0 ? "No cure inventory" : "Select cure lot..."} />
          </SelectTrigger>
          <SelectContent>
            {cureInventory.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No cure inventory available</div>
            ) : (
              cureInventory
                .filter(c => (c.available_qty || 0) > 0)
                .sort((a, b) => (a.received_date || "") < (b.received_date || "") ? -1 : 1)
                .map(c => (
                  <SelectItem key={c.id} value={c.lot_number}>
                    {c.lot_number} <span className="text-muted-foreground text-xs ml-1">({c.available_qty} lbs)</span>
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "spice_select") {
    return null;
  }
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
        <Switch checked={!!value} onCheckedChange={onChange} className="scale-125" />
        <Label className="text-sm font-medium cursor-pointer select-none">{field.label}</Label>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="h-24 text-base"
          placeholder={field.placeholder || "Any observations..."}
          disabled={field.disabled}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{field.label}</Label>
      <Input
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "0.1" : undefined}
        value={value ?? field.defaultValue ?? ""}
        onChange={e => {
          let val = field.type === "number" ? Number(e.target.value) : e.target.value;
          onChange(val);
        }}
        placeholder={field.placeholder || ""}
        className="h-11 text-base"
        disabled={field.disabled}
      />
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  );
}

export function FinalStep({ stage, capKey, stageLabel, resolvedBatches, form, cookBatch, cookPlan, saving, onBack, onComplete }) {
  const isLinking = capKey === "linking";
  const isTumble = capKey === "tumble" || capKey === "tumbling";
  const isRacking = capKey === "racking" || capKey === "racking_product";
  const isCooking = capKey === "cooking";
  const isPackaging = capKey === "packaging" && form.case_weights;

  const releasedRacks = isRacking && cookPlan?.racks ? cookPlan.racks.filter(r => r.released) : [];
  const releasedLbs = parseFloat(releasedRacks.reduce((s, r) => s + (r.lbs || 0), 0).toFixed(2));

  // Tumbling absorbs the added seasoning into the batch weight, so output = protein in + spice.
  const tumbleSpiceLbs = isTumble ? (Number(form.spice_mix_qty_lbs) || 0) : 0;
  const outputLbs = resolvedBatches
    ? resolvedBatches.reduce((s, b) => s + b.batchLbs, 0)
    : isRacking
      ? releasedLbs
      : isCooking && cookBatch
        ? cookBatch.totalLbs
        : isTumble && cookPlan
          ? parseFloat((cookPlan.cookBatches.reduce((s, b) => s + b.lbs, 0) + tumbleSpiceLbs).toFixed(2))
          : isTumble
            ? parseFloat(((stage?.input_qty_lbs || 0) + tumbleSpiceLbs).toFixed(2))
            : form.output_qty_lbs || stage?.input_qty_lbs || 0;

  const canComplete = isLinking ? !!cookBatch
    : isRacking ? releasedRacks.length > 0
    : isCooking ? !!cookBatch
    : (isTumble && cookPlan ? !!cookPlan : isTumble ? true : isPackaging ? form.case_weights?.length > 0 : true);

  return (
    <div className="space-y-5">
      <div className={`rounded-xl border-2 p-4 space-y-3 ${canComplete ? "border-chart-2/30 bg-chart-2/8" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-5 h-5 ${canComplete ? "text-chart-2" : "text-muted-foreground"}`} />
          <p className={`font-bold text-base ${canComplete ? "text-chart-2" : "text-muted-foreground"}`}>
            {canComplete ? `Ready to complete ${stageLabel}` : `Review required`}
          </p>
        </div>

        <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
          <span className="text-sm text-muted-foreground">Output quantity</span>
          <span className="font-bold text-lg">{outputLbs} lbs</span>
        </div>

        {isLinking && cookBatch && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batch Lot</span>
              <span className="font-mono font-bold">{cookBatch.lotNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Batch Qty</span>
              <span className="font-semibold">{cookBatch.totalQty} lbs</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Linking Batches</span>
              <span className="font-semibold">{cookBatch.selectedStageIds?.length || 1}</span>
            </div>
          </div>
        )}
        {isLinking && !cookBatch && (
          <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> No cook batch assembled — go back to build one.
          </p>
        )}
        {capKey === "packaging" && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cases (Finished Product)</span>
              <span className="font-semibold">{form.packages_produced || 0}</span>
            </div>
            {form.finished_product_splits && Array.isArray(form.finished_product_splits) && form.finished_product_splits.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Split Into Products</p>
                {form.finished_product_splits.map((split, i) => {
                  const splitData = typeof split === 'string' ? JSON.parse(split) : split;
                  return (
                    <div key={i} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                      <span className="font-semibold">{splitData?.product_name || 'Unknown'}</span>
                      <span className="text-muted-foreground">{splitData?.quantity_cases || 0} cases</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {isTumble && cookPlan?.cookBatches && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batches</span>
              <span className="font-semibold">{cookPlan.cookBatches.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Racks</span>
              <span className="font-semibold">{cookPlan.cookBatches.reduce((s, b) => s + b.racks, 0)}</span>
            </div>
            <div className="space-y-1 pt-1">
              {cookPlan.cookBatches.map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{b.lotNumber}</span>
                  <div className="flex gap-2 text-muted-foreground">
                    <span>{b.racks} racks</span>
                    <span>·</span>
                    <span>{b.lbs} lbs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Racking: list released racks (each goes individually to the smokehouse) */}
        {isRacking && (
          releasedRacks.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Racks Released</span>
                <span className="font-semibold">{releasedRacks.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Racking Lot</span>
                <span className="font-mono font-semibold">{cookPlan?.lotNumber || "—"}</span>
              </div>
              <div className="space-y-1 pt-1">
                {releasedRacks.map((r) => (
                  <div key={r.rackNumber} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                    <span className="font-semibold">Rack #{r.rackNumber}</span>
                    <span className="text-muted-foreground">{r.lbs} lbs</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> No racks released — go back and release at least one rack.
            </p>
          )
        )}

        {/* Cooking: cook batch assembled from released racks */}
        {isCooking && cookBatch && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cook Batch Lot</span>
              <span className="font-mono font-semibold">{cookBatch.lotNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Racks in Oven</span>
              <span className="font-semibold">{cookBatch.rackIds.length}</span>
            </div>
            <div className="space-y-1 pt-1">
              {cookBatch.racks.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-white/60 rounded px-2.5 py-1.5 text-xs">
                  <span className="font-semibold">Rack #{r.rack_number} <span className="font-mono text-muted-foreground ml-1">{r.lot_number}</span></span>
                  <span className="text-muted-foreground">{r.lbs} lbs</span>
                </div>
              ))}
            </div>
            {cookBatch.isMixedLot && (
              <p className="text-[11px] text-amber-700 flex items-center gap-1.5 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5" /> Mixed-lot batch — {cookBatch.sourceLots.length} lots combined.
              </p>
            )}
          </div>
        )}
      </div>

      {resolvedBatches && resolvedBatches.map(b => (
        <div key={b.batchNumber} className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Batch #{b.batchNumber} — {b.batchLbs} lbs
          </p>
          <div className="rounded-xl border divide-y text-sm overflow-hidden">
            {b.ingredients.map((ing, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ing.bucket_name}</span>
                  <span className="text-muted-foreground text-xs font-medium">
                    {(ing.lot_allocations?.reduce((s, a) => s + (Number(a.actual_lbs) || 0), 0) || 0).toFixed(2)} lbs
                  </span>
                </div>
                {ing.lot_allocations?.map((a, ai) => (
                  <div key={ai} className="flex justify-between text-xs text-muted-foreground mt-0.5 pl-2">
                    <span className="font-mono">{a.lot_number}</span>
                    <span>{a.actual_lbs} lbs</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

       {!resolvedBatches && Object.keys(form).length > 0 && (
         <div className="rounded-xl border divide-y text-sm overflow-hidden">
           {Object.entries(form).filter(([, v]) => v !== "" && v !== null && v !== undefined).map(([k, v]) => {
             if (k === 'finished_product_splits') return null;
             if (Array.isArray(v)) return null;
             if (typeof v === 'object') return null;
             return (
               <div key={k} className="flex items-center justify-between px-3 py-2.5">
                 <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                 <span className="font-semibold">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</span>
               </div>
             );
           })}
         </div>
       )}

      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          className="flex-1 gap-2 h-12 text-base font-bold bg-chart-2 hover:bg-chart-2/90"
          onClick={onComplete}
          disabled={saving || !canComplete}
        >
          <CheckCircle2 className="w-5 h-5" />
          {saving ? "Completing…" : `Complete ${stageLabel}`}
        </Button>
      </div>
    </div>
  );
}

export function ProgressBar({ current, total, pct, label }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground">
        <span>{label} {current} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-chart-1 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function NavButtons({ onBack, onNext, nextDisabled, nextLabel }) {
  return (
    <div className="flex gap-3 pt-1">
      <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack}>
        <ChevronLeft className="w-4 h-4" /> Back
      </Button>
      <Button className="flex-1 gap-2 h-11 font-semibold" disabled={nextDisabled} onClick={onNext}>
        {nextLabel} <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}