// Plant-local calendar dates (YYYY-MM-DD). Using UTC rolled lots and expiry dates to the
// next day for anything completed in the evening.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysStr(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + (Number(days) || 0));
  return localDateStr(d);
}