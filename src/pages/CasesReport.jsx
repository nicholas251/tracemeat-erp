import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Download } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default function CasesReport() {
  const [selectedStageId, setSelectedStageId] = useState(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["activeOrders"],
    queryFn: () => base44.entities.ProductionOrder.filter({ status: { $in: ["pending", "in_progress"] } }, "-created_date"),
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["productionStages"],
    queryFn: () => base44.entities.ProductionStage.list("-created_date", 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  // Filter to only packing stages with cases
  const packingStages = stages.filter(s => {
    const product = products.find(p => p.id === orders.find(o => o.id === s.order_id)?.product_id);
    return s.capability_key === "packaging" && product?.varied_weights && s.cases?.length > 0;
  });

  const selectedStage = packingStages.find(s => s.id === selectedStageId);
  const selectedOrder = selectedStage ? orders.find(o => o.id === selectedStage.order_id) : null;
  const selectedProduct = selectedOrder ? products.find(p => p.id === selectedOrder.product_id) : null;

  const handlePrint = () => {
    if (!selectedStage || !selectedOrder || !selectedProduct) return;
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!selectedStage || !selectedOrder || !selectedProduct) return;

    const csv = [
      ["Cases Report"],
      [""],
      ["PO Number", selectedOrder.order_number],
      ["Product", selectedProduct.name],
      ["SKU", selectedProduct.sku],
      [""],
      ["Case #", "Weight (lbs)", "Lot Number"],
      ...selectedStage.cases.map((c, i) => [i + 1, c.weight_lbs, c.lot_number || ""]),
      [""],
      ["Total Cases", selectedStage.cases.length],
      ["Total Weight", selectedStage.cases.reduce((s, c) => s + (c.weight_lbs || 0), 0)],
    ];

    const csvContent = csv.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedOrder.order_number}-cases.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Cases Report"
        subtitle="View and print individual case weights for varied weight products"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage list */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {packingStages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No packing stages with case data found.</p>
              ) : (
                packingStages.map((stage) => {
                  const order = orders.find(o => o.id === stage.order_id);
                  return (
                    <button
                      key={stage.id}
                      onClick={() => setSelectedStageId(stage.id)}
                      className={`w-full text-left p-2 rounded border transition-all ${
                        selectedStageId === stage.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <p className="font-semibold text-sm">{order?.order_number}</p>
                      <p className="text-xs text-muted-foreground">{stage.cases?.length} cases</p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Report view */}
        <div className="lg:col-span-2">
          {selectedStage && selectedOrder && selectedProduct ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{selectedOrder.order_number}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{selectedProduct.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="gap-2">
                    <Download className="w-4 h-4" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                    <Printer className="w-4 h-4" /> Print
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">SKU</p>
                      <p className="font-semibold">{selectedProduct.sku}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Cases</p>
                      <p className="font-semibold">{selectedStage.cases.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Weight</p>
                      <p className="font-semibold">
                        {selectedStage.cases.reduce((s, c) => s + (c.weight_lbs || 0), 0).toFixed(2)} lbs
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Per Case</p>
                      <p className="font-semibold">
                        {(selectedStage.cases.reduce((s, c) => s + (c.weight_lbs || 0), 0) / selectedStage.cases.length).toFixed(2)} lbs
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Case #</TableHead>
                            <TableHead className="text-right">Weight (lbs)</TableHead>
                            <TableHead>Lot Number</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedStage.cases.map((caseItem, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-semibold">{idx + 1}</TableCell>
                              <TableCell className="text-right font-semibold">{caseItem.weight_lbs?.toFixed(2) || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{caseItem.lot_number || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Select a packing stage to view case details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}