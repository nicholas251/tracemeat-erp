import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import RecallSummary from "@/components/traceability/RecallSummary";
import OrderTraceCard from "@/components/traceability/OrderTraceCard";
import { buildTrace } from "@/lib/traceGraph";

const LIMIT = 2000;
const useAll = (key, entity, sort = "-created_date") =>
  useQuery({ queryKey: ["trace", key], queryFn: () => base44.entities[entity].list(sort, LIMIT), staleTime: 0 });

export default function Traceability() {
  const [searchTerm, setSearchTerm] = useState("");

  const orders = useAll("orders", "ProductionOrder");
  const stages = useAll("stages", "ProductionStage");
  const racks = useAll("racks", "RackUnit");
  const rawInventory = useAll("raw", "RawInventory");
  const inventoryItems = useAll("items", "InventoryItem");
  const fgBuckets = useAll("fg", "FinishedGoodsBucket");
  const salesOrders = useAll("sales", "SalesOrder");
  const holds = useAll("holds", "HoldRelease");
  const unfinishedCases = useAll("carry", "UnfinishedCase");

  const all = [orders, stages, racks, rawInventory, inventoryItems, fgBuckets, salesOrders, holds, unfinishedCases];
  const loading = all.some(q => q.isLoading);

  const trace = useMemo(() => buildTrace(searchTerm, {
    orders: orders.data || [], stages: stages.data || [], racks: racks.data || [], rawInventory: rawInventory.data || [],
    inventoryItems: inventoryItems.data || [], fgBuckets: fgBuckets.data || [], salesOrders: salesOrders.data || [],
    holds: holds.data || [], unfinishedCases: unfinishedCases.data || [],
  }), [searchTerm, ...all.map(q => q.data)]);

  return (
    <div>
      <PageHeader
        title="Traceability"
        subtitle="Recall lookup — search any supplier lot, PO, spice-mix lot, cook batch, FG lot, order, product, customer or sales order"
      />

      <div className="relative max-w-2xl mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          className="pl-10 h-12 text-base"
          placeholder="Enter a lot number, PO, order #, product, customer or sales order…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {!searchTerm.trim() ? (
        <Card className="p-12 text-center">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Trace anything</h3>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Search a supplier lot to see every product it went into and every customer who received it —
            or search a finished-goods lot to walk back to its raw materials.
          </p>
        </Card>
      ) : !trace || trace.affected.length === 0 ? (
        <Card className="p-12 text-center">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{loading ? "Searching…" : "No results"}</h3>
          {!loading && <p className="text-sm text-muted-foreground">Nothing in the production chain matches "{searchTerm}"</p>}
        </Card>
      ) : (
        <div className="space-y-6">
          <RecallSummary summary={trace.summary} />
          {trace.affected.map(t => <OrderTraceCard key={t.order.id} trace={t} hit={trace.hit} />)}
        </div>
      )}
    </div>
  );
}