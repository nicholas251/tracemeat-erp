import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Package, Factory, Warehouse, ShieldAlert, ArrowRight, CheckCircle, AlertTriangle, FileText } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import TraceabilityPath from "@/components/production/TraceabilityPath";
import { format } from "date-fns";

export default function Traceability() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["productionOrders"],
    queryFn: () => base44.entities.ProductionOrder.list("-created_date"),
  });

  const { data: productionStages = [] } = useQuery({
    queryKey: ["allStages"],
    queryFn: () => base44.entities.ProductionStage.list("-created_date"),
  });

  const { data: holds = [] } = useQuery({
    queryKey: ["holds"],
    queryFn: () => base44.entities.HoldRelease.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const normalizedSearch = searchTerm.toLowerCase().trim();
  
  // Search by lot number or order number
  const matchedOrder = productionOrders.find(o =>
    o.order_number?.toLowerCase().includes(normalizedSearch) ||
    o.product_name?.toLowerCase().includes(normalizedSearch)
  );

  const matchedByLot = !matchedOrder
    ? productionStages.find(s =>
        s.input_lot_number?.toLowerCase().includes(normalizedSearch) ||
        s.output_lot_number?.toLowerCase().includes(normalizedSearch) ||
        s.cook_batch_lot?.toLowerCase().includes(normalizedSearch)
      )
    : null;

  const selectedOrder = matchedOrder;
  const relatedStages = selectedOrder
    ? productionStages.filter(s => s.order_id === selectedOrder.id).sort((a, b) => (a.step_number || 0) - (b.step_number || 0))
    : matchedByLot
    ? productionStages.filter(s => s.order_id === matchedByLot.order_id).sort((a, b) => (a.step_number || 0) - (b.step_number || 0))
    : [];

  const linkedHolds = selectedOrder || matchedByLot
    ? holds.filter(h => (selectedOrder?.id || matchedByLot?.order_id) && h.batch_id)
    : [];

  const linkedProduct = selectedOrder
    ? products.find(p => p.id === selectedOrder.product_id)
    : matchedByLot
    ? products.find(p => p.id === (productionOrders.find(o => o.id === matchedByLot.order_id)?.product_id))
    : null;

  return (
    <div>
      <PageHeader
        title="Traceability"
        subtitle="Full chain traceability — search by batch number or product name"
      />

      <div className="relative max-w-xl mb-8">
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
         <Input
           className="pl-10 h-12 text-base"
           placeholder="Search by order number, product name, or lot number..."
           value={searchTerm}
           onChange={e => setSearchTerm(e.target.value)}
         />
       </div>

       {!searchTerm ? (
         <Card className="p-12 text-center">
           <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
           <h3 className="text-lg font-semibold mb-1">Search for production</h3>
           <p className="text-sm text-muted-foreground">Enter an order number, product name, or any lot number to view full traceability</p>
         </Card>
       ) : !selectedOrder && !matchedByLot ? (
         <Card className="p-12 text-center">
           <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
           <h3 className="text-lg font-semibold mb-1">No results</h3>
           <p className="text-sm text-muted-foreground">No production order or lot found matching "{searchTerm}"</p>
         </Card>
       ) : (
         <div className="space-y-6">
           {/* Production Order Summary */}
           {selectedOrder && (
             <Card>
               <CardHeader className="pb-3">
                 <CardTitle className="text-base flex items-center gap-2">
                   <Factory className="w-4 h-4" /> Production Order
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                   <div>
                     <p className="text-muted-foreground text-xs">Order #</p>
                     <p className="font-mono font-medium">{selectedOrder.order_number}</p>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">Product</p>
                     <p className="font-medium">{selectedOrder.product_name}</p>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">Quantity</p>
                     <p className="font-medium">{selectedOrder.quantity_to_produce} lbs</p>
                   </div>
                   <div>
                     <p className="text-muted-foreground text-xs">Status</p>
                     <StatusBadge status={selectedOrder.status} />
                   </div>
                 </div>
               </CardContent>
             </Card>
           )}

           {/* Lot Traceability Path */}
           {relatedStages.length > 0 && <TraceabilityPath stages={relatedStages} />}

           {/* Production Stages Details */}
           {relatedStages.length > 0 && (
             <Card>
               <CardHeader className="pb-3">
                 <CardTitle className="text-base flex items-center gap-2">
                   <FileText className="w-4 h-4" /> Production Stages
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-3">
                   {relatedStages.map(stage => (
                     <div key={stage.id} className="border rounded p-3 space-y-2 text-sm">
                       <div className="flex items-center justify-between">
                         <div className="font-semibold capitalize">{stage.capability_name || stage.capability_key}</div>
                         <StatusBadge status={stage.status} />
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                         <div>
                           <span className="font-semibold text-foreground">Input:</span> {stage.input_qty_lbs} lbs
                         </div>
                         <div>
                           <span className="font-semibold text-foreground">Output:</span> {stage.output_qty_lbs || "—"} lbs
                         </div>
                         {stage.input_lot_number && (
                           <div className="col-span-2">
                             <span className="font-semibold text-foreground">Input Lot:</span> <span className="font-mono">{stage.input_lot_number}</span>
                           </div>
                         )}
                         {stage.output_lot_number && (
                           <div className="col-span-2">
                             <span className="font-semibold text-foreground">Output Lot:</span> <span className="font-mono">{stage.output_lot_number}</span>
                           </div>
                         )}
                         {stage.cook_batch_lot && (
                           <div className="col-span-2">
                             <span className="font-semibold text-foreground">Cook Batch:</span> <span className="font-mono">{stage.cook_batch_lot}</span>
                           </div>
                         )}
                       </div>
                       {stage.completed_at && (
                         <p className="text-xs text-muted-foreground">
                           Completed: {format(new Date(stage.completed_at), "MMM d, HH:mm")}
                         </p>
                       )}
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           )}

          {/* Holds */}
          {linkedHolds.length > 0 && (
            <Card className="border-accent/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-accent" /> Hold History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {linkedHolds.map(h => (
                    <div key={h.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium capitalize">{(h.hold_reason || "").replace(/_/g, " ")}</span>
                        <StatusBadge status={h.status} />
                      </div>
                      {h.hold_description && <p className="text-muted-foreground text-xs">{h.hold_description}</p>}
                      {h.resolution_notes && <p className="text-xs mt-1"><strong>Resolution:</strong> {h.resolution_notes}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Info */}
          {linkedProduct && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" /> Product Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="font-medium">{linkedProduct.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">SKU</p>
                    <p className="font-mono">{linkedProduct.sku}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Category</p>
                    <p className="capitalize">{(linkedProduct.category || "").replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Shelf Life</p>
                    <p>{linkedProduct.shelf_life_days ? `${linkedProduct.shelf_life_days} days` : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}