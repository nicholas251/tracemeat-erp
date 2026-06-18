import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ChevronLeft, Play, AlertCircle } from "lucide-react";
import IngredientLotPicker from "../blending/IngredientLotPicker";
import LinkingCookBatchBuilder from "./LinkingCookBatchBuilder";
import RackReleaseBuilder from "./RackReleaseBuilder";
import SmokehouseCookBatchBuilder from "./SmokehouseCookBatchBuilder";
import CarryOverPicker from "./CarryOverPicker";
import UnfinishedCaseAllocator from "./UnfinishedCaseAllocator";
import FieldInput from "./wizard/FieldInput";
import FinalStepComponent from "./wizard/FinalStep";
import { ProgressBar, NavButtons } from "./wizard/WizardNav";

// Re-exported so existing imports from this module keep working after the split.
export const FinalStep = FinalStepComponent;
export { ProgressBar, NavButtons, FieldInput };

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

export function MeasureStep({ stepDef, stepIndex, totalSteps, progressPct, form, setForm, casingBuckets, cureInventory = [], compatibleHotdogProducts = [], capKey, stage, product, cookBatch, setCookBatch, cookPlan, setCookPlan, openPartialRack = null, rackCapacityLbs = 0, rackDefaultLot = "", persistedRacks = [], onReleaseRack, onBack, onNext, isLast, autoCalculatedCases = 0 }) {
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
  const cookTempEntered = isCookStage && form.temperature_f !== undefined && form.temperature_f !== "";
  // Cooking must reach the 165°F food-safety minimum — hard gate, no override.
  const cookTempTooLow = cookTempEntered && Number(form.temperature_f) < 165;
  // Cooking now requires the operator to assemble a cook batch from released racks first.
  const cookNeedsBatch = isCookStage && !cookBatch;

  const isChillStage = capKey === "chilling" && stepDef.id === "chill";
  const chillTempEntered = isChillStage && form.temperature_f !== undefined && form.temperature_f !== "";
  // Chilling must drop to 40°F or lower — hard gate, no override.
  const chillTempTooHigh = chillTempEntered && Number(form.temperature_f) > 40;

  // ── Packaging remainder (for "Allocate to Unfinished Case") ─────────────────
  // Effective input = stage input + any carry-over pulled in. Remainder = effective
  // input minus the main-product full cases minus any split-to-other-product lbs.
  const caseWeightLbs = product?.case_weight_lbs || 0;
  const carryoverLbs = (form.carryover_records || []).reduce((s, r) => s + (r.lbs || 0), 0);
  const effectiveInputLbs = (stage?.input_qty_lbs || 0) + carryoverLbs;
  const mainCaseLbs = (Number(form.packages_produced) || 0) * caseWeightLbs;
  const splitLbs = (form.finished_product_splits || []).reduce((s, sp) => {
    const parsed = typeof sp === "string" ? JSON.parse(sp) : sp;
    return s + ((Number(parsed.quantity_cases) || 0) * (parsed.case_weight_lbs || 0));
  }, 0);
  const packagingRemainderLbs = Math.max(0, parseFloat((effectiveInputLbs - mainCaseLbs - splitLbs).toFixed(2)));
  // If the operator changes cases/splits/carry-over after parking a remainder, the stored
  // amount goes stale — clear the allocation so they re-confirm against the new remainder.
  React.useEffect(() => {
    if (form.unfinished_allocated && Math.abs((form.unfinished_remainder_lbs || 0) - packagingRemainderLbs) > 0.001) {
      setForm(f => ({ ...f, unfinished_allocated: false, unfinished_remainder_lbs: 0, unfinished_remainder_lots: [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packagingRemainderLbs]);
  // Lot breakdown for the parked carry-over: the run's own input lot + each carry-over's lots.
  const packagingRemainderLots = [
    ...(stage?.input_lot_number ? [{ lot_number: stage.input_lot_number, lbs: packagingRemainderLbs }] : []),
    ...(form.carryover_records || []).flatMap(r => r.lot_contributions || []),
  ];

  const canProceed = isLinking ? !!cookBatch
     : isRacking ? (cookPlan?.racks?.some(r => r.released) || !!cookPlan?.carriedPartial)
     : isPackaging ? (form.case_count > 0 && caseWeights.length === parseInt(form.case_count))
     : isMixerInputs ? (!!form.pork_lot_confirmed && (stage?.binder_lot_number ? !!form.binder_lot_confirmed : false))
     : isCookStage ? (cookTempEntered && !cookTempTooLow && !cookNeedsBatch)
     : isChillStage ? (chillTempEntered && !chillTempTooHigh)
     : !spiceBlocksNext;

  return (
    <div className="space-y-5">
      <ProgressBar current={stepIndex + 1} total={totalSteps} pct={progressPct} label="Step" />

      <div className="rounded-xl bg-muted/40 border px-4 py-3">
        <p className="font-bold text-base">{stepDef.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Step {stepIndex + 1} of {totalSteps}</p>
      </div>

      {capKey === "packaging" && stepDef.id === "packaging" && (
        <CarryOverPicker
          productId={product?.id}
          selectedIds={form.carryover_ids || []}
          onChange={(ids, records) => {
            const addedLbs = records.reduce((s, r) => s + (r.lbs || 0), 0);
            const baseLbs = stage?.input_qty_lbs || 0;
            setForm(f => ({
              ...f,
              carryover_ids: ids,
              carryover_records: records,
              output_qty_lbs: parseFloat((baseLbs + addedLbs).toFixed(2)),
            }));
          }}
        />
      )}

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
             totalLbs={
               capKey === "packaging"
                 ? Math.max(0, parseFloat((((form.output_qty_lbs || stage?.input_qty_lbs || 0) - ((Number(form.packages_produced) || 0) * (product?.case_weight_lbs || 0))).toFixed(2))))
                 : (form.output_qty_lbs || stage?.input_qty_lbs || 0)
             }
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

      {capKey === "packaging" && stepDef.id === "packaging" && (
        <div className="space-y-4">
          <UnfinishedCaseAllocator
            remainderLbs={packagingRemainderLbs}
            lotContributions={packagingRemainderLots}
            allocated={!!form.unfinished_allocated}
            onAllocate={() => setForm(f => ({
              ...f,
              unfinished_allocated: true,
              unfinished_remainder_lbs: packagingRemainderLbs,
              unfinished_remainder_lots: packagingRemainderLots,
            }))}
          />
        </div>
      )}

      {isCookStage && cookTempTooLow && (
        <div className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Temperature Below 165°F</p>
              <p className="text-xs text-destructive/90 mt-0.5">Cook must reach at least 165°F to pass food safety. You can't continue until the end temperature is 165°F or higher.</p>
            </div>
          </div>
        </div>
      )}

      {isChillStage && chillTempTooHigh && (
        <div className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Temperature Above 40°F</p>
              <p className="text-xs text-destructive/90 mt-0.5">Chill must drop to 40°F or lower. You can't continue until the exit temperature is 40°F or below.</p>
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

      {isRacking && (
        <RackReleaseBuilder
          totalLbs={form.output_qty_lbs || stage?.input_qty_lbs || 0}
          capacityLbs={rackCapacityLbs}
          openPartialRack={openPartialRack}
          defaultLot={rackDefaultLot}
          persistedRacks={persistedRacks}
          onReleaseRack={onReleaseRack}
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