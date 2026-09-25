// Spots are generated from configured locations: location "A" with 12 spots → A1…A12.
export const spotKey = (buildingId, code) => `${buildingId}:${code}`;

export const sortLocations = (locations) => [...locations].sort((a, b) => a.name.localeCompare(b.name));

export const buildSpots = (locations) =>
  sortLocations(locations).flatMap(l =>
    Array.from({ length: Number(l.spots) || 0 }, (_, i) => ({
      key: spotKey(l.building_id, `${l.name}${i + 1}`),
      building_id: l.building_id,
      building_name: l.building_name,
      code: `${l.name}${i + 1}`,
    }))
  );

export const freeSpots = (spots, pallets) => {
  const taken = new Set(pallets.map(p => spotKey(p.building_id, p.location)));
  return spots.filter(s => !taken.has(s.key));
};

// Pallets sitting in spots of this location numbered above `limit` (0 = any spot).
export const palletsInLocation = (pallets, loc, limit = 0) =>
  pallets.filter(p => {
    if (p.building_id !== loc.building_id) return false;
    const m = (p.location || "").match(new RegExp(`^${loc.name}(\\d+)$`));
    return m && Number(m[1]) > limit;
  });