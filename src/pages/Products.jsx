import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Package, Pencil, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import ProductSetupWizard from "@/components/products/ProductSetupWizard";
import RecipeFormDialog from "@/components/recipes/RecipeFormDialog";
import ImportProductsDialog from "@/components/products/ImportProductsDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export default function Products() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });

  const { data: flows = [] } = useQuery({
    queryKey: ["flows"],
    queryFn: () => base44.entities.ProductionFlow.list(),
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => base44.entities.Recipe.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setDeleting(null); },
  });

  const updateRecipeMutation = useMutation({
    mutationFn: (data) => base44.entities.Recipe.update(editingRecipe.id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditingRecipe(null); 
    },
  });

  return (
    <div>
      <PageHeader 
        title="Products" 
        subtitle="Design and manage your product catalog"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-2" /> Import
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Product
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i} className="h-40 animate-pulse bg-muted" />)}
        </div>
      ) : products.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No products yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first product to get started</p>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> New Product</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{product.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>
                  </div>
                  <StatusBadge status={product.status} />
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
                   <p className="capitalize">{(product.category || "").replace(/_/g, " ")}</p>
                   {product.packaging_type && <p className="capitalize">{(product.packaging_type || "").replace(/_/g, " ")}{product.package_size ? ` · ${product.package_size < 1 ? (product.package_size * 16).toFixed(0) + " oz" : product.package_size + " lbs"}/pack` : ""}</p>}
                   {product.shelf_life_days && <p>{product.shelf_life_days} day shelf life</p>}
                   {product.recipe_id && (() => {
                     const recipe = recipes.find(r => r.id === product.recipe_id);
                     return recipe?.yield_percent ? <p className="text-xs text-amber-600 font-medium">Yield: {recipe.yield_percent}%</p> : null;
                   })()}
                   {product.flow_name && <p className="text-xs text-primary font-medium">Flow: {product.flow_name}</p>}
                 </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(product)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  {product.recipe_id && (
                    <Button size="sm" variant="outline" onClick={() => setEditingRecipe(recipes.find(r => r.id === product.recipe_id))}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Recipe
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(product)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <ProductSetupWizard
          open
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            const saved = await createMutation.mutateAsync(data);
            setShowForm(false);
            return saved;
          }}
        />
      )}
      {editing && (
        <ProductFormDialog open product={editing} flows={flows} onClose={() => setEditing(null)} onSave={(data) => updateMutation.mutate({ id: editing.id, data })} />
      )}
      {editingRecipe && (
        <RecipeFormDialog 
          open 
          recipe={editingRecipe} 
          products={products}
          onClose={() => setEditingRecipe(null)} 
          onSave={(data) => updateRecipeMutation.mutate(data)} 
        />
      )}

      <ImportProductsDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this product.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleting.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}