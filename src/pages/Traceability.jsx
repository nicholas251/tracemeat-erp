import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Package, Factory, Warehouse, ShieldAlert, ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";

export default function Traceability() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: () => base44.entities.Batch.list("-created_date"),
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => base44.entities.RawMaterial.list(),
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
  const matchedBatch = batches.find(b =>
    b.batch_number?.toLowerCase().includes(normalizedSearch) ||
    b.product_name?.toLowerCase().includes(normalizedSearch)
  );

  const linkedMaterials = matchedBatch
    ? rawMaterials.filter(m => (matchedBatch.raw_material_lots || []).includes(m.lot_number))
    : [];

  const linkedHolds = matchedBatch
    ? holds.filter(h => h.batch_id === matchedBatch.id)
    : [];

  const linkedProduct = matchedBatch
    ? products.find(p => p.id === matchedBatch.product_id)
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
          placeholder="Search batch number or product name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {!searchTerm ? (
        <Card className="p-12 text-center">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Search for a batch</h3>
          <p className="text-sm text-muted-foreground">Enter a batch number or product name to view its full traceability chain</p>
        </Card>
      ) : !matchedBatch ? (
        <Card className="p-12 text-center">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No results</h3>
          <p className="text-sm text-muted-foreground">No batch found matching "{searchTerm}"</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Traceability Chain Visual */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-chart-5/10 text-chart-5 rounded-full font-medium">
              <Warehouse className="w-3.5 h-3.5" /> Raw Materials ({linkedMaterials.length})
            </div>
            <ArrowRight className="w-4 h-4" />
            <div className="flex items-center gap-1 px-3 py-1.5 bg-chart-1/10 text-chart-1 rounded-full font-medium">
              <Factory className="w-3.5 h-3.5" /> Batch {matchedBatch.batch_number}
            </div>
            <ArrowRight className="w-4 h-4" />
            <div className="flex items-center gap-1 px-3 py-1.5 bg-chart-2/10 text-chart-2 rounded-full font-medium">
              <Package className="w-3.5 h-3.5" /> {matchedBatch.product_name}
            </div>
            {linkedHolds.length > 0 && (
              <>
                <ArrowRight className="w-4 h-4" />
                <div className="flex items-center gap-1 px-3 py-1.5 bg-accent/10 text-accent rounded-full font-medium">
                  <ShieldAlert className="w-3.5 h-3.5" /> {linkedHolds.length} Hold(s)
                </div>
              </>
            )}
          </div>

          {/* Batch Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Factory className="w-4 h-4" /> Batch Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Batch #</p>
                  <p className="font-mono font-medium">{matchedBatch.batch_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <StatusBadge status={matchedBatch.status} />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Quantity</p>
                  <p className="font-medium">{matchedBatch.quantity_kg ? `${matchedBatch.quantity_kg} kg` : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Production Date</p>
                  <p className="font-medium">{matchedBatch.production_date ? format(new Date(matchedBatch.production_date), "MMM d, yyyy") : "—"}</p>
                </div>
              </div>

              {/* Step records */}
              {(matchedBatch.step_records || []).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-3">Processing Steps</h4>
                  <div className="space-y-2">
                    {matchedBatch.step_records.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 text-sm">
                        {step.status === "completed" ? (
                          <CheckCircle className="w-4 h-4 text-chart-2 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                        )}
                        <span className="font-medium">{step.step_name}</span>
                        {step.temp_recorded_c != null && (
                          <span className="text-muted-foreground">{step.temp_recorded_c}°C</span>
                        )}
                        {step.completed_at && (
                          <span className="text-muted-foreground ml-auto text-xs">
                            {format(new Date(step.completed_at), "MMM d, HH:mm")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw Materials */}
          {linkedMaterials.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Warehouse className="w-4 h-4" /> Linked Raw Materials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {linkedMaterials.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">Lot: {m.lot_number} · Supplier: {m.supplier}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={m.status} />
                        {m.received_date && (
                          <p className="text-xs text-muted-foreground mt-1">Received: {format(new Date(m.received_date), "MMM d")}</p>
                        )}
                      </div>
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