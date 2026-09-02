import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, Warehouse, Layers, Package, Truck, ShieldAlert, Recycle } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import TraceabilityPath from "@/components/production/TraceabilityPath";
import RawLotsTable from "./RawLotsTable";
import StageList from "./StageList";
import RacksList from "./RacksList";
import FgLotsTable from "./FgLotsTable";
import ShipmentsTable from "./ShipmentsTable";
import HoldsList from "./HoldsList";
import CarryOversList from "./CarryOversList";

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2"><Icon className="w-3.5 h-3.5" /> {title}</h4>
      {children}
    </div>
  );
}

export default function OrderTraceCard({ trace, hit }) {
  const { order, reasons, stages, racks, rawLots, fgLots, shipments, carryOvers, holds } = trace;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="w-4 h-4" /> Order <span className="font-mono">#{order.order_number}</span> · {order.product_name}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{order.quantity_to_produce} lbs planned</span>
            <StatusBadge status={order.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {reasons.map(r => <Badge key={r} variant="secondary" className="text-[10px] h-5">{r}</Badge>)}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <Section icon={Warehouse} title="Raw materials in (backward)"><RawLotsTable rawLots={rawLots} hit={hit} /></Section>
        {stages.length > 0 && <TraceabilityPath stages={stages} />}
        <Section icon={Layers} title="Process steps"><StageList stages={stages} hit={hit} /></Section>
        {racks.length > 0 && <Section icon={Layers} title="Racks"><RacksList racks={racks} hit={hit} /></Section>}
        {carryOvers.length > 0 && <Section icon={Recycle} title="Carry-overs"><CarryOversList carryOvers={carryOvers} orderId={order.id} hit={hit} /></Section>}
        <Section icon={Package} title="Finished goods out (forward)"><FgLotsTable fgLots={fgLots} hit={hit} /></Section>
        <Section icon={Truck} title="Shipments & customers"><ShipmentsTable shipments={shipments} hit={hit} /></Section>
        <Section icon={ShieldAlert} title="Holds"><HoldsList holds={holds} /></Section>
      </CardContent>
    </Card>
  );
}