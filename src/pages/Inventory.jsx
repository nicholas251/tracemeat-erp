import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Boxes, Search, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import InventoryAdjustDialog from "@/components/inventory/InventoryAdjustDialog";

export default function Inventory() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [adjustItem, setAdjustItem] = useState(null);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => base44.entities.InventoryItem.list("-created_date"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InventoryItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAdjustItem(null);
    },
  });

  const filtered = items.filter(item => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch = !search || 
      item.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.batch_number?.toLowerCase().includes(search.toLowerCase()) ||
      item.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalKg = filtered.filter(i => i.status === "available").reduce((sum, i) => sum + (i.quantity_kg || 0), 0);
  const expiringItems = items.filter(i => {
    if (!i.expiry_date || i.status !== "available") return false;
    const daysLeft = Math.ceil((new Date(i.expiry_date) - new Date()) / 86400000);
    return daysLeft <= 5 && daysLeft >= 0;
  });

  const isExpiringSoon = (expiry_date) => {
    if (!expiry_date) return false;
    const daysLeft = Math.ceil((new Date(expiry_date) - new Date()) / 86400000);
    return daysLeft <= 5 && daysLeft >= 0;
  };

  const isExpired = (expiry_date) => {
    if (!expiry_date) return false;
    return new Date(expiry_date) < new Date();
  };

  return (
    <div>
      <PageHeader
        title="Finished Goods Inventory"
        subtitle="Inventory generated from completed production batches"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Available</p>
          <p className="text-2xl font-bold mt-1">{totalKg.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">SKU Count</p>
          <p className="text-2xl font-bold mt-1">{new Set(items.filter(i=>i.status==="available").map(i=>i.sku)).size}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Lots</p>
          <p className="text-2xl font-bold mt-1">{items.filter(i=>i.status==="available").length}</p>
        </Card>
        <Card className={`p-4 ${expiringItems.length > 0 ? "border-accent" : ""}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Expiring Soon</p>
          <p className={`text-2xl font-bold mt-1 ${expiringItems.length > 0 ? "text-accent" : ""}`}>{expiringItems.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by product, batch, lot, or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="quarantined">Quarantined</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card className="h-64 animate-pulse bg-muted" />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Boxes className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No inventory items</h3>
          <p className="text-sm text-muted-foreground">Inventory is automatically created when batches are completed.</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot / Batch</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Qty (kg)</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Prod. Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className={isExpiringSoon(item.expiry_date) ? "bg-accent/5" : ""}>
                    <TableCell>
                      <p className="font-mono text-xs font-medium">{item.lot_number || item.batch_number}</p>
                      <p className="text-xs text-muted-foreground">{item.batch_number}</p>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.sku || "—"}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{(item.quantity_kg || 0).toLocaleString()}</span>
                      {item.original_quantity_kg && item.quantity_kg !== item.original_quantity_kg && (
                        <span className="text-xs text-muted-foreground ml-1">/ {item.original_quantity_kg.toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.location || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.production_date ? format(new Date(item.production_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {item.expiry_date ? (
                        <span className={`text-sm font-medium ${isExpired(item.expiry_date) ? "text-destructive" : isExpiringSoon(item.expiry_date) ? "text-accent" : "text-muted-foreground"}`}>
                          {format(new Date(item.expiry_date), "MMM d, yyyy")}
                          {isExpiringSoon(item.expiry_date) && !isExpired(item.expiry_date) && (
                            <span className="ml-1 text-xs">(soon)</span>
                          )}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setAdjustItem(item)}>
                        <TrendingDown className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {adjustItem && (
        <InventoryAdjustDialog
          open
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSave={(id, data) => updateMutation.mutate({ id, data })}
        />
      )}
    </div>
  );
}