import { base44 } from "@/api/base44Client";

// Returns the cook lot unchanged if no cooking card uses it yet; otherwise bumps the
// trailing sequence number until it is free. Stops two linking cards that were opened
// at the same time from sharing one cook lot.
export async function uniqueCookLot(lot) {
  let candidate = lot;
  for (let i = 0; i < 50; i++) {
    const taken = await base44.entities.ProductionStage.filter({ capability_key: "cooking", cook_batch_lot: candidate });
    if (!taken.length) return candidate;
    const m = candidate.match(/^(.*-)(\d{1,3})$/);
    candidate = m ? `${m[1]}${parseInt(m[2], 10) + 1}` : `${candidate}-2`;
  }
  return candidate;
}