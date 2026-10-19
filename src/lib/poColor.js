// Stable color per production order so supervisors can spot an order across stages.
const PALETTE = [
  { border: "border-l-blue-500", dot: "bg-blue-500" },
  { border: "border-l-emerald-500", dot: "bg-emerald-500" },
  { border: "border-l-amber-500", dot: "bg-amber-500" },
  { border: "border-l-purple-500", dot: "bg-purple-500" },
  { border: "border-l-rose-500", dot: "bg-rose-500" },
  { border: "border-l-cyan-500", dot: "bg-cyan-500" },
  { border: "border-l-orange-500", dot: "bg-orange-500" },
  { border: "border-l-lime-500", dot: "bg-lime-500" },
];

export function buildPoColors(orderNumbers) {
  const map = {};
  [...new Set(orderNumbers)].sort().forEach((n, i) => { map[n] = PALETTE[i % PALETTE.length]; });
  return map;
}

// What the supervisor should do about this card.
export function stageDirection(stage) {
  const idleHrs = (Date.now() - new Date(stage.updated_date || stage.created_date).getTime()) / 36e5;
  if (stage.status === "on_hold") return { text: "On hold — needs a supervisor decision", cls: "text-destructive" };
  if (idleHrs >= 8) return { text: `No activity for ${Math.floor(idleHrs)}h — possibly left behind`, cls: "text-destructive font-semibold" };
  if (stage.status === "available") return { text: "Needed — waiting for an operator to start", cls: "text-amber-600 font-semibold" };
  return { text: "Being worked now", cls: "text-emerald-600" };
}