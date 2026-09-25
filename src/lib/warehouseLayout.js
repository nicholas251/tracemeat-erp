// Shipping room pallet locations: A1–A12, B1–B20, C1–C16.
export const ZONES = [
  { zone: "A", spots: 12 },
  { zone: "B", spots: 20 },
  { zone: "C", spots: 16 },
];

export const ALL_SPOTS = ZONES.flatMap(z => Array.from({ length: z.spots }, (_, i) => `${z.zone}${i + 1}`));

export const freeSpots = (pallets) => {
  const taken = new Set(pallets.map(p => p.location));
  return ALL_SPOTS.filter(s => !taken.has(s));
};