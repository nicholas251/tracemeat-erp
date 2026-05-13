import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, Search, TrendingDown, Package } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import InventoryAdjustDialog from "@/components/inventory/InventoryAdjustDialog";
import RawInventoryAdjustDialog from "@/components/inventory/RawInventoryAdjustDialog";
import MaterialParDashboard from "@/components/inventory/MaterialParDashboard";
import FGBucketsView from "@/components/inventory/FGBucketsView";

export default function Inventory() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const [rawStatusFilter, setRawStatusFilter] = useState("all");
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustRawItem, setAdjustRawItem] = useState(null);
  const queryClient = useQueryClient();

  // Refetch raw materials when page mounts to sync with updates from other pages
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["raw_materials"] });
  }, [queryClient]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => base44.entities.InventoryItem.list("-created_date"),
  });

  const { data: rawItems = [], isLoading: rawLoading } = useQuery({
    queryKey: ["raw_inventory"],
    queryFn: () => base44.entities.RawInventory.list("-created_date"),
  });

  const { data: buckets = [] } = useQuery({
    queryKey: ["inventory_buckets"],
    queryFn: () => base44.entities.InventoryBucket.filter({ status: "active" }),
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw_materials"],
    queryFn: () => base44.entities.RawMaterial.list("-created_date"),
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production_orders"],
    queryFn: () => base44.entities.ProductionOrder.list(),
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => base44.entities.Recipe.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InventoryItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAdjustItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InventoryItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAdjustItem(null);
    },
  });

  const updateRawMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RawInventory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_inventory"] });
      setAdjustRawItem(null);
    },
  });

  const deleteRawMutation = useMutation({
    mutationFn: (id) => base44.entities.RawInventory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_inventory"] });
      setAdjustRawItem(null);
    },
  });

  // Finished goods filters
  const filtered = items.filter(item => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch = !search ||
      item.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.batch_number?.toLowerCase().includes(search.toLowerCase()) ||
      item.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Raw inventory filters
  const filteredRaw = rawItems.filter(item => {
    const matchesStatus = rawStatusFilter === "all" || item.status === rawStatusFilter;
    const matchesSearch = !rawSearch ||
      item.bucket_name?.toLowerCase().includes(rawSearch.toLowerCase()) ||
      item.lot_number?.toLowerCase().includes(rawSearch.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(rawSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(rawSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalLbs = items.filter(i => i.status === "available").reduce((sum, i) => sum + (i.quantity_lbs || 0), 0);
  const expiringItems = items.filter(i => {
    if (!i.expiry_date || i.status !== "available") return false;
    const daysLeft = Math.ceil((new Date(i.expiry_date) - new Date()) / 86400000);
    return daysLeft <= 5 && daysLeft >= 0;
  });

  const totalRawQty = rawItems.filter(i => i.status === "available").reduce((sum, i) => sum + (i.available_qty || 0), 0);

  // Calculate material needs based on active production orders
  const getMaterialNeeds = () => {
    const activeOrders = productionOrders.filter(o => o.status === "pending" || o.status === "in_progress");
    const needs = {};

    activeOrders.forEach(order => {
      const recipe = recipes.find(r => r.id === order.recipe_id);
      if (recipe && recipe.ingredients) {
        const yieldFactor = (recipe.yield_percent || 95) / 100;
        const rawNeeded = order.quantity_to_produce / yieldFactor;
        const totalIngredientLbs = recipe.ingredients.reduce((sum, ing) => sum + (ing.quantity_lbs || 0), 0);

        recipe.ingredients.forEach(ingredient => {
          const key = ingredient.bucket_id || ingredient.category;
          const fraction = totalIngredientLbs > 0 ? ingredient.quantity_lbs / totalIngredientLbs : 0;
          needs[key] = (needs[key] || 0) + fraction * rawNeeded;
        });
      }
    });
    return needs;
  };

  const materialNeeds = getMaterialNeeds();
  const expiringRaw = rawItems.filter(i => {
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
        title="Inventory"
        subtitle="View raw materials and finished goods inventory"
      />

      <Tabs defaultValue="par">
        <TabsList className="mb-6">
          <TabsTrigger value="par" className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" /> Par Levels
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Raw Materials
          </TabsTrigger>
          <TabsTrigger value="finished" className="flex items-center gap-2">
            <Boxes className="w-4 h-4" /> FG Buckets
          </TabsTrigger>
          <TabsTrigger value="fg_lots" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> FG Lots
          </TabsTrigger>
        </TabsList>

        {/* PAR LEVELS TAB */}
        <TabsContent value="par">
          <PageHeader
            title="Par Level Status"
            subtitle="Track consumption and stock levels against par minimums"
          />
          <MaterialParDashboard materials={rawMaterials} />
        </TabsContent>

        {/* RAW MATERIALS TAB */}
        <TabsContent value="raw">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Available</p>
              <p className="text-2xl font-bold mt-1">{totalRawQty.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Lots</p>
              <p className="text-2xl font-bold mt-1">{rawItems.filter(i => i.status === "available").length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Buckets in Use</p>
              <p className="text-2xl font-bold mt-1">{new Set(rawItems.filter(i => i.status === "available").map(i => i.bucket_id)).size}</p>
            </Card>
            <Card className={`p-4 ${expiringRaw.length > 0 ? "border-accent" : ""}`}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Expiring Soon</p>
              <p className={`text-2xl font-bold mt-1 ${expiringRaw.length > 0 ? "text-accent" : ""}`}>{expiringRaw.length}</p>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by bucket, lot, supplier..."
                value={rawSearch}
                onChange={e => setRawSearch(e.target.value)}
              />
            </div>
            <Select value={rawStatusFilter} onValueChange={setRawStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
                <SelectItem value="quarantined">Quarantined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rawLoading ? (
            <Card className="h-64 animate-pulse bg-muted" />
          ) : filteredRaw.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No raw material inventory</h3>
              <p className="text-sm text-muted-foreground">Raw materials are added through the Receiving page.</p>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                        <TableHead>Bucket</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Allocated</TableHead>
                        <TableHead>Needed</TableHead>
                        <TableHead>Shortfall</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRaw.map(item => {
                      const allocated = item.allocated_qty_lbs || 0;
                      const needed = materialNeeds[item.id] || 0;
                      const shortfall = Math.max(0, needed - allocated);
                      return (
                        <TableRow key={item.id} className={isExpiringSoon(item.expiry_date) ? "bg-accent/5" : ""}>
                          <TableCell className="font-mono text-xs font-medium">{item.lot_number || "—"}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{item.bucket_name}</p>
                            <Badge variant="outline" className="text-xs capitalize mt-0.5">{item.bucket_category}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.description || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.supplier || "—"}</TableCell>
                          <TableCell>
                            <span className="font-semibold">{(item.available_qty || 0).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-accent">{allocated.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{needed.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </TableCell>
                          <TableCell>
                            <span className={shortfall > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>{shortfall > 0 ? shortfall.toLocaleString() : "—"}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.received_date ? format(new Date(item.received_date), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell><StatusBadge status={item.status} /></TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => setAdjustRawItem(item)}>
                              <TrendingDown className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                        </TableBody>
                        </Table>
                        </CardContent>
                        </Card>
                        )}
                        </TabsContent>

                        {/* FG BUCKETS TAB */}
        <TabsContent value="finished">
          <FGBucketsView />
        </TabsContent>

        {/* FG LOTS TAB (legacy lot-level view) */}
        <TabsContent value="fg_lots">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Available</p>
              <p className="text-2xl font-bold mt-1">{totalLbs.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">SKU Count</p>
              <p className="text-2xl font-bold mt-1">{new Set(items.filter(i => i.status === "available").map(i => i.sku)).size}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Lots</p>
              <p className="text-2xl font-bold mt-1">{items.filter(i => i.status === "available").length}</p>
            </Card>
            <Card className={`p-4 ${expiringItems.length > 0 ? "border-accent" : ""}`}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Expiring Soon</p>
              <p className={`text-2xl font-bold mt-1 ${expiringItems.length > 0 ? "text-accent" : ""}`}>{expiringItems.length}</p>
            </Card>
          </div>

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
                      <TableHead>Qty (lbs)</TableHead>
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
                         <span className="font-semibold">{(item.quantity_lbs || 0).toLocaleString()}</span>
                         {item.original_quantity_lbs && item.quantity_lbs !== item.original_quantity_lbs && (
                           <span className="text-xs text-muted-foreground ml-1">/ {(item.original_quantity_lbs || 0).toLocaleString()}</span>
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
        </TabsContent>
      </Tabs>

      {adjustItem && (
        <InventoryAdjustDialog
          open
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSave={(id, data) => updateMutation.mutate({ id, data })}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}

      {adjustRawItem && (
        <RawInventoryAdjustDialog
          open
          item={adjustRawItem}
          onClose={() => setAdjustRawItem(null)}
          onSave={(id, data) => updateRawMutation.mutate({ id, data })}
          onDelete={(id) => deleteRawMutation.mutate(id)}
          buckets={buckets}
        />
      )}
    </div>
  );
}