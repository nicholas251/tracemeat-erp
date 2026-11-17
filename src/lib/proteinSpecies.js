// Protein buckets a product may draw from: each species is isolated, and only
// products without a recognised species (e.g. "mixed") see every bucket.
const SPECIES = {
  poultry: ["chicken", "poultry", "turkey"],
  beef: ["beef"],
  pork: ["pork"],
  lamb: ["lamb"],
};

export function filterBucketsBySpecies(buckets, productCategory) {
  const words = SPECIES[productCategory];
  if (!words) return buckets;
  return buckets.filter((b) => {
    const name = (b.name || "").toLowerCase();
    return words.some((w) => name.includes(w));
  });
}