import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/shared/StatusBadge";
import RecipeFormDialog from "@/components/recipes/RecipeFormDialog";

export default function Recipes() {
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const queryClient = useQueryClient();

  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => base44.entities.Recipe.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Recipe.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Recipe.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setShowForm(false);
      setEditingRecipe(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Recipe.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const handleSave = (data) => {
    if (editingRecipe) {
      updateMutation.mutate({ id: editingRecipe.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipes"
        subtitle="Define ingredient recipes for finished goods production"
        actions={
          <Button onClick={() => { setEditingRecipe(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Recipe
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Recipes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Yield %</TableHead>
                <TableHead>Ingredients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan="6" className="text-center py-8 text-muted-foreground">
                    No recipes yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                recipes.map((recipe) => (
                   <TableRow key={recipe.id}>
                     <TableCell className="font-medium">{recipe.name}</TableCell>
                     <TableCell>{recipe.product_name || "—"}</TableCell>
                     <TableCell>{recipe.yield_percent != null ? `${recipe.yield_percent}%` : "—"}</TableCell>
                     <TableCell className="text-sm text-muted-foreground">
                       {recipe.ingredients?.length || 0} ingredient(s)
                     </TableCell>
                     <TableCell><StatusBadge status={recipe.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingRecipe(recipe); setShowForm(true); }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(recipe.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecipeFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingRecipe(null); }}
        onSave={handleSave}
        recipe={editingRecipe}
        products={products}
      />
    </div>
  );
}