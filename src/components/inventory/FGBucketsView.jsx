import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingDown, ChevronDown, ChevronRight, Boxes } from "lucide-react";
import FGBucketAdjustDialog from "./FGBucketAdjustDialog";

export default function FGBucketsView() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});
  const [adjustBucket, setAdjustBucket] = useState(null);
  const queryClient = useQueryClient();

  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ["fg_buckets"],
    queryFn: () => base44.entities.FinishedGoodsBucket.filter({ status: "active" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FinishedGoodsBucket.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fg_buckets"] }),
  });

  const filtered = buckets.filter(b =>
    !search ||
    b.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.sku?.toLowerCase().includes(search.toLowerCase()) ||
    b.product_number?.toLowerCase().includes(search.toLowerCase())
  );

  const totalLbs = buckets.reduce((s, b) => s + (b.quantity_lbs || 0), 0);
  const totalCases = buckets.reduce((s, b) => s + (b.cases_on_hand || 0), 0);
  const nonEmptyBuckets = buckets.filter(b => (b.quantity_lbs || 0) > 0).length;

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total On Hand</p>
          <p className="text-2xl font-bold mt-1">{totalLbs.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Cases On Hand</p>
          <p className="text-2xl font-bold mt-1">{totalCases.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">SKUs In Stock</p>
          <p className="text-2xl font-bold mt-1">{nonEmptyBuckets} <span className="text-sm font-normal text-muted-foreground">/ {buckets.length}</span></p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by product name, SKU, or product number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Card className="h-64 animate-pulse bg-muted" />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Boxes className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No FG buckets found</h3>
          <p className="text-sm text-muted-foreground">Buckets are created automatically for each product.</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU / #</TableHead>
                  <TableHead>Qty on Hand (lbs)</TableHead>
                  <TableHead>Cases on Hand</TableHead>
                  <TableHead>Lots</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(bucket => {
                  const activeLots = (bucket.lots || []).filter(l => l.status === "available");
                  const isExpanded = expanded[bucket.id];
                  const isEmpty = (bucket.quantity_lbs || 0) === 0;
                  return (
                    <React.Fragment key={bucket.id}>
                      <TableRow className={isEmpty ? "opacity-50" : ""}>
                        <TableCell>
                          {activeLots.length > 0 && (
                            <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => toggleExpand(bucket.id)}>
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{bucket.product_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{(bucket.category || "").replace(/_/g, " ")}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{bucket.sku || "—"}</p>
                          <p className="font-mono text-xs text-muted-foreground">{bucket.product_number || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold text-lg ${isEmpty ? "text-muted-foreground" : ""}`}>
                            {(bucket.quantity_lbs || 0).toLocaleString()}
                          </span>
                          {bucket.case_weight_lbs && (
                            <span className="text-xs text-muted-foreground ml-1">(@ {bucket.case_weight_lbs} lbs/case)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold text-lg ${isEmpty ? "text-muted-foreground" : ""}`}>
                            {(bucket.cases_on_hand || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{activeLots.length} lot{activeLots.length !== 1 ? "s" : ""}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setAdjustBucket(bucket)}>
                            <TrendingDown className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded lot rows */}
                      {isExpanded && activeLots.map((lot, i) => (
                        <TableRow key={i} className="bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={2} className="pl-8">
                            <p className="font-mono text-xs font-medium text-primary">{lot.lot_number}</p>
                            <p className="text-xs text-muted-foreground">Order: {lot.order_number}</p>
                          </TableCell>
                          <TableCell className="text-sm">{(lot.quantity_lbs || 0).toLocaleString()} lbs</TableCell>
                          <TableCell className="text-sm">{lot.cases || 0} cases</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {lot.production_date || "—"}
                            {lot.expiry_date && <span className="ml-1">→ {lot.expiry_date}</span>}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {adjustBucket && (
        <FGBucketAdjustDialog
          open
          bucket={adjustBucket}
          onClose={() => setAdjustBucket(null)}
          onSave={(id, data) => updateMutation.mutateAsync({ id, data })}
        />
      )}
    </div>
  );
}