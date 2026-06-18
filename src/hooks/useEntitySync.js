import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// ─── Real-time entity → query sync ────────────────────────────────────────────
// The app uses manual cache invalidation, which means every screen's freshness
// depends on every mutation remembering to invalidate the exact query keys that
// screen reads — across files. As the app grew, those keys drifted and admins
// started seeing stale data ("refresh gaps").
//
// This hook removes that whole class of bug for the screens that need live
// oversight. Point it at the entities a screen displays; whenever ANY user
// creates/updates/deletes a record of that entity, the listed query keys are
// invalidated (prefix match), so the screen refreshes without a manual reload —
// no matter where the write happened.
//
// Single source of truth for "which query keys read which entity". When a new
// screen reads an existing entity under a NEW key, add the key here once and
// every subscriber stays in sync.
export const ENTITY_QUERY_KEYS = {
  ProductionOrder: [["productionOrders"], ["activeOrders"]],
  ProductionStage: [["productionStages"], ["allStages"]],
  RackUnit: [["releasedRacks"]],
  UnfinishedCase: [["allCarryOvers"], ["openCarryOvers"]],
  HoldRelease: [["holds"]],
  InventoryItem: [["inventory"]],
  FinishedGoodsBucket: [["fg_buckets"]],
};

// Subscribe to one or more entities and auto-invalidate their query keys on change.
// Usage: useEntitySync(["ProductionStage", "ProductionOrder"]);
export function useEntitySync(entityNames) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const names = Array.isArray(entityNames) ? entityNames : [entityNames];
    const unsubscribers = names.map((name) => {
      const entity = base44.entities[name];
      if (!entity?.subscribe) return () => {};
      return entity.subscribe(() => {
        for (const key of ENTITY_QUERY_KEYS[name] || []) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      });
    });
    return () => unsubscribers.forEach((u) => u && u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(entityNames) ? entityNames.join(",") : entityNames, queryClient]);
}