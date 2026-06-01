import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Search, Beef, FlaskConical, Package, Unlink, Plus, Pencil, PackagePlus } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import BucketFormDialog from "@/components/inventory/BucketFormDialog";
import TestAmountDialog from "@/components/inventory/TestAmountDialog";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const CATEGORY_LABELS = {
  protein: { label: "Protein", icon: Beef, color: "text-chart-4" },
  spice: { label: "Spice", icon: FlaskConical, color: "text-chart-3" },
  spice_mix: { label: "Spice Mix", icon: FlaskConical, color: "text-chart-2" },
  packaging: { label: "Packaging", icon: Package, color: "text-chart-1" },
  casing: { label: "Casing", icon: Unlink, color: "text-chart-5" },
};

function BucketCard({ bucket, lots, isAdmin, onEdit, onAddTest }) {
  const usableLot = (l) => !["depleted", "quarantined", "expired"].includes(l.status) && (l.available_qty || 0) > 0;
  const totalQty = lots.filter(usableLot).reduce((s, l) => s + (l.available_qty || 0), 0);
  const isLow = totalQty < 50;

  return (
    <Card className={`${isLow && totalQty > 0 ? "border-accent/50" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-muted-foreground">{bucket.code}</p>
            <CardTitle className="text-base leading-tight mt-0.5">{bucket.name}</CardTitle>
          </div>
          <div className="flex items-start gap-2 ml-2">
            {isAdmin && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onAddTest(bucket)} title="Initial stock entry">
                  <PackagePlus className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onEdit(bucket)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <div className="text-right">
              <p className="text-2xl font-bold">{totalQty.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{bucket.unit || "lbs"} on hand</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {bucket.description && (
          <p className="text-xs text-muted-foreground mb-2">{bucket.description}</p>
        )}
        <div className="space-y-1">
          {lots.filter(usableLot).slice(0, 3).map(lot => (
            <div key={lot.id} className="flex justify-between items-center text-xs bg-muted/40 rounded px-2 py-1">
              <span className="font-mono text-muted-foreground truncate max-w-[60%]">{lot.lot_number || lot.description}</span>
              <span className="font-semibold ml-2">{(lot.available_qty || 0).toLocaleString()} {lot.unit}</span>
            </div>
          ))}
          {lots.filter(usableLot).length > 3 && (
            <p className="text-xs text-muted-foreground text-center">+{lots.filter(usableLot).length - 3} more lots</p>
          )}
          {lots.filter(usableLot).length === 0 && (
            <p className="text-xs text-muted-foreground italic">No stock on hand</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryTab({ category, buckets, allLots, search, isAdmin, onEditBucket, onAddTest }) {
  const info = CATEGORY_LABELS[category];
  const Icon = info.icon;

  const filtered = buckets
    .filter(b => {
      if (category === "spice_mix") return b.category === "spice" && b.is_mix === true && b.status === "active";
      if (category === "spice") return b.category === "spice" && !b.is_mix && b.status === "active";
      return b.category === category && b.status === "active";
    })
    .filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${info.color}`} />
        <h2 className="text-lg font-semibold">{info.label} Buckets</h2>
        <Badge variant="outline">{filtered.length}</Badge>
      </div>
      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No {info.label.toLowerCase()} buckets configured.</p>
          <p className="text-sm text-muted-foreground mt-1">Go to Bucket Settings to add buckets.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(b => (
            <BucketCard
              key={b.id}
              bucket={b}
              lots={allLots.filter(l => l.bucket_id === b.id)}
              isAdmin={isAdmin}
              onEdit={onEditBucket}
              onAddTest={onAddTest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LotLedger({ allLots, buckets }) {
  const [search, setSearch] = useState("");
  const filtered = allLots.filter(l =>
    !search ||
    l.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.bucket_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.supplier?.toLowerCase().includes(search.toLowerCase()) ||
    l.description?.toLowerCase().includes(search.toLowerCase())
  );

  const isExpiringSoon = (date) => {
    if (!date) return false;
    const days = Math.ceil((new Date(date) - new Date()) / 86400000);
    return days <= 7 && days >= 0;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search lots..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot #</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO #</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No lots found</TableCell></TableRow>
              ) : filtered.map(lot => (
                <TableRow key={lot.id}>
                  <TableCell className="font-mono text-xs font-medium">{lot.lot_number || "—"}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{lot.bucket_name}</p>
                      <Badge variant="outline" className="text-[10px] capitalize mt-0.5">{lot.bucket_category}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{lot.description || "—"}</TableCell>
                  <TableCell className="text-sm">{lot.supplier || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{lot.po_number || "—"}</TableCell>
                  <TableCell className="text-sm font-semibold">{lot.quantity?.toLocaleString()} {lot.unit}</TableCell>
                  <TableCell className="text-sm font-semibold text-chart-2">{lot.available_qty?.toLocaleString()} {lot.unit}</TableCell>
                  <TableCell>
                    {lot.expiry_date ? (
                      <span className={`text-xs font-medium ${isExpiringSoon(lot.expiry_date) ? "text-accent" : "text-muted-foreground"}`}>
                        {format(new Date(lot.expiry_date), "MMM d, yyyy")}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={lot.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RawInventoryPage() {
  const [search, setSearch] = useState("");
  const [showBucketForm, setShowBucketForm] = useState(false);
  const [editBucket, setEditBucket] = useState(null);
  const [testBucket, setTestBucket] = useState(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const isAdmin = currentUser?.role === "admin";

  const { data: buckets = [] } = useQuery({
    queryKey: ["inventory_buckets"],
    queryFn: () => base44.entities.InventoryBucket.list(),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["raw_inventory"],
    queryFn: () => base44.entities.RawInventory.list("-received_date"),
  });

  const createBucket = useMutation({
    mutationFn: (data) => base44.entities.InventoryBucket.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["inventory_buckets"] }); setShowBucketForm(false); },
  });

  const updateBucket = useMutation({
    mutationFn: ({ id, data }) => base44.entities.InventoryBucket.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["inventory_buckets"] }); setEditBucket(null); },
  });

  const addTestAmount = useMutation({
    mutationFn: (data) => base44.entities.RawInventory.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["raw_inventory"] }); setTestBucket(null); },
  });

  const usableLot = (l) => !["depleted", "quarantined", "expired"].includes(l.status) && (l.available_qty || 0) > 0;
  const totalProtein = lots.filter(l => l.bucket_category === "protein" && usableLot(l)).reduce((s, l) => s + (l.available_qty || 0), 0);
  const totalSpice = lots.filter(l => l.bucket_category === "spice" && usableLot(l)).reduce((s, l) => s + (l.available_qty || 0), 0);
  const totalPackaging = lots.filter(l => l.bucket_category === "packaging" && usableLot(l)).reduce((s, l) => s + (l.available_qty || 0), 0);
  const totalCasing = lots.filter(l => l.bucket_category === "casing" && usableLot(l)).reduce((s, l) => s + (l.available_qty || 0), 0);

  return (
    <div>
      <PageHeader
        title="Raw Material Inventory"
        subtitle="On-hand stock organized by inventory buckets"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Beef className="w-4 h-4 text-chart-4" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Protein On Hand</p>
          </div>
          <p className="text-2xl font-bold">{totalProtein.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-chart-3" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Spice On Hand</p>
          </div>
          <p className="text-2xl font-bold">{totalSpice.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-chart-1" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Packaging On Hand</p>
          </div>
          <p className="text-2xl font-bold">{totalPackaging.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">units</span></p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Unlink className="w-4 h-4 text-chart-5" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Casing On Hand</p>
          </div>
          <p className="text-2xl font-bold">{totalCasing.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">lbs</span></p>
        </Card>
      </div>

      <Tabs defaultValue="protein">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 w-52" placeholder="Search buckets..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {isAdmin && (
              <Button onClick={() => setShowBucketForm(true)} variant="outline">
                <Settings className="w-4 h-4 mr-2" /> Manage Buckets
              </Button>
            )}
          </div>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="protein">Protein</TabsTrigger>
            <TabsTrigger value="spice">Spice</TabsTrigger>
            <TabsTrigger value="spice_mix">Spice Mix</TabsTrigger>
            <TabsTrigger value="packaging">Packaging</TabsTrigger>
            <TabsTrigger value="casing">Casing</TabsTrigger>
            <TabsTrigger value="ledger">All Lots</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="protein">
          <CategoryTab category="protein" buckets={buckets} allLots={lots} search={search} isAdmin={isAdmin} onEditBucket={(b) => setEditBucket(b)} onAddTest={(b) => setTestBucket(b)} />
        </TabsContent>
        <TabsContent value="spice">
          <CategoryTab category="spice" buckets={buckets} allLots={lots} search={search} isAdmin={isAdmin} onEditBucket={(b) => setEditBucket(b)} onAddTest={(b) => setTestBucket(b)} />
        </TabsContent>
        <TabsContent value="spice_mix">
          <CategoryTab category="spice_mix" buckets={buckets} allLots={lots} search={search} isAdmin={isAdmin} onEditBucket={(b) => setEditBucket(b)} onAddTest={(b) => setTestBucket(b)} />
        </TabsContent>
        <TabsContent value="packaging">
          <CategoryTab category="packaging" buckets={buckets} allLots={lots} search={search} isAdmin={isAdmin} onEditBucket={(b) => setEditBucket(b)} onAddTest={(b) => setTestBucket(b)} />
        </TabsContent>
        <TabsContent value="casing">
          <CategoryTab category="casing" buckets={buckets} allLots={lots} search={search} isAdmin={isAdmin} onEditBucket={(b) => setEditBucket(b)} onAddTest={(b) => setTestBucket(b)} />
        </TabsContent>
        <TabsContent value="ledger">
          <LotLedger allLots={lots} buckets={buckets} />
        </TabsContent>
      </Tabs>

      {(showBucketForm || editBucket) && (
        <BucketFormDialog
          open
          bucket={editBucket}
          onClose={() => { setShowBucketForm(false); setEditBucket(null); }}
          onSave={(data) => editBucket ? updateBucket.mutate({ id: editBucket.id, data }) : createBucket.mutate(data)}
          allBuckets={buckets}
          onEdit={(b) => setEditBucket(b)}
        />
      )}

      <TestAmountDialog
        open={!!testBucket}
        bucket={testBucket}
        onClose={() => setTestBucket(null)}
        onAdd={(data) => addTestAmount.mutate(data)}
      />
    </div>
  );
}