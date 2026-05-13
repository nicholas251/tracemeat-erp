import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Save, X, AlertCircle, Check } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";

export default function DailySales() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [salesQty, setSalesQty] = useState("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.filter({ status: "active" })
  });

  const { data: fgBuckets = [] } = useQuery({
    queryKey: ["fg_buckets"],
    queryFn: () => base44.entities.FinishedGoodsBucket.list()
  });

  const recordSalesMutation = useMutation({
    mutationFn: async ({ productId, quantityLbs }) => {
      const response = await base44.functions.invoke("recordDailySales", {
        product_id: productId,
        quantity_lbs: quantityLbs
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fg_buckets"] });
      setSelectedProduct(null);
      setSalesQty("");
      toast.success(`Logged ${data.quantity} lbs sold`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to log sale");
    }
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogSales = () => {
    if (!selectedProduct || !salesQty || parseFloat(salesQty) <= 0) return;
    recordSalesMutation.mutate({
      productId: selectedProduct.id,
      quantityLbs: parseFloat(salesQty)
    });
  };

  const getProductInventory = (productId) => {
    const bucket = fgBuckets.find(b => b.product_id === productId);
    return {
      quantityLbs: bucket?.quantity_lbs || 0,
      cases: bucket?.cases_on_hand || 0
    };
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Daily Sales" 
        subtitle="Log daily product sales and deduct from finished goods inventory"
      />

      <div className="relative">
        <Input
          placeholder="Search products by name or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-4"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-1">No products found</h3>
          <p className="text-sm text-muted-foreground">Create active products to log sales.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const inventory = getProductInventory(product.id);
            const isLow = inventory.quantityLbs < 100;
            return (
              <Card key={product.id} className={isLow ? "border-accent" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{product.sku}</p>
                    </div>
                    {isLow && <Badge variant="destructive" className="text-xs">Low Stock</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                       <span className="text-muted-foreground">On Hand:</span>
                       <span className="font-semibold">{inventory.quantityLbs.toLocaleString()} lbs</span>
                     </div>
                     <div className="flex justify-between text-sm">
                       <span className="text-muted-foreground">Cases:</span>
                       <span className="font-semibold">{inventory.cases}</span>
                     </div>
                   </div>
                   <div className="flex gap-2">
                     <Button 
                       onClick={() => setSelectedProduct(product)}
                       className="flex-1"
                       size="sm"
                     >
                       <Plus className="w-4 h-4 mr-1" /> Log Sales
                     </Button>
                   </div>
                 </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={open => !open && setSelectedProduct(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Log Sales for {selectedProduct?.name}</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             {selectedProduct && (
               <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm">
                 <p className="text-blue-900 font-semibold">Available: {getProductInventory(selectedProduct.id).quantityLbs.toLocaleString()} lbs</p>
               </div>
             )}
             <div className="space-y-2">
               <label className="text-sm font-medium">Quantity Sold (lbs)</label>
               <Input
                 type="number"
                 placeholder="Enter quantity..."
                 value={salesQty}
                 onChange={e => setSalesQty(e.target.value)}
                 onKeyDown={e => e.key === "Enter" && handleLogSales()}
                 min="0"
                 step="0.1"
                 autoFocus
               />
             </div>
             {selectedProduct && (
               <div className="space-y-2">
                 <p className="text-xs font-medium text-muted-foreground">Quick Add:</p>
                 <div className="grid grid-cols-4 gap-2">
                   {[50, 100, 250, 500].map(qty => (
                     <Button
                       key={qty}
                       variant="outline"
                       size="sm"
                       onClick={() => setSalesQty(qty.toString())}
                       className="text-xs"
                     >
                       {qty}
                     </Button>
                   ))}
                 </div>
               </div>
             )}
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setSelectedProduct(null)}>
               Cancel
             </Button>
             <Button 
               onClick={handleLogSales}
               disabled={!salesQty || parseFloat(salesQty) <= 0 || recordSalesMutation.isPending}
             >
               {recordSalesMutation.isPending ? "Saving..." : "Log Sale"} 
               {!recordSalesMutation.isPending && <Check className="w-4 h-4 ml-2" />}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}