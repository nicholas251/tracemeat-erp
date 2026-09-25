// Chopping bowl weight: what went in (protein + spice + cure + water) is the most that can come out.
const TOLERANCE = 1.01; // 1% allowance for scale differences

export function chopExpectedOutput(stage, form) {
  const spice = form.spice_mix?.lots
    ? form.spice_mix.lots.reduce((s, l) => s + (Number(l.spice_mix_qty_lbs) || 0), 0)
    : Number(form.spice_mix_qty_lbs) || 0;
  const total = (Number(stage?.input_qty_lbs) || 0) + spice
    + (Number(form.cure_amount_lbs) || 0) + (Number(form.water_amount_lbs) || 0);
  return parseFloat(total.toFixed(2));
}

export function chopIsOverweight(stage, form) {
  const out = Number(form.output_qty_lbs) || 0;
  return out > chopExpectedOutput(stage, form) * TOLERANCE;
}

// On completion: returns an error message if overweight with no note; otherwise records
// the override reason in the stage notes.
export function applyChopWeightOverride(updates, stage, form) {
  const note = (form.chop_weight_override_note || "").trim();
  delete updates.chop_weight_override_note;
  if (!chopIsOverweight(stage, form)) return null;
  const expected = chopExpectedOutput(stage, form);
  if (!note) return `Output (${form.output_qty_lbs} lbs) is more than what went into the bowl (${expected} lbs). Correct the weight or add an override note.`;
  updates.notes = [updates.notes, `Weight override: output ${form.output_qty_lbs} lbs vs ${expected} lbs in — ${note}`].filter(Boolean).join("\n");
  return null;
}