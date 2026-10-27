// Oven/Cooling food-safety gate. Mutates updates; returns an error string or null.
export function applyOvenCoolingChecks(updates) {
  const cook = Number(updates.cook_temp_f);
  const cool = Number(updates.cool_temp_f);
  if (!updates.cook_temp_f || isNaN(cook)) return "Enter the cook temperature before completing this stage.";
  if (!updates.cool_temp_f || isNaN(cool)) return "Enter the cooling temperature before completing this stage.";
  const cookI = (updates.cook_initials || "").trim().toUpperCase();
  const coolI = (updates.cool_initials || "").trim().toUpperCase();
  if (cook < 165 && !cookI) return "Cook temperature is under 165°F — enter your initials to continue.";
  if (cool > 40 && !coolI) return "Cooling temperature is above 40°F — enter your initials to continue.";

  const log = [`Cook ${cook}°F`, `Cool ${cool}°F`];
  if (cook < 165) log.push(`Cook under 165°F approved by ${cookI}`);
  if (cool > 40) log.push(`Cool above 40°F approved by ${coolI}`);
  updates.notes = [updates.notes, log.join(" · ")].filter(Boolean).join(" | ");
  updates.temperature_c = parseFloat(((cool - 32) * 5 / 9).toFixed(2));
  ["cook_temp_f", "cool_temp_f", "cook_initials", "cool_initials"].forEach(k => delete updates[k]);
  return null;
}