import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all production orders that are pending or in_progress
    const activeOrders = await base44.asServiceRole.entities.ProductionOrder.filter({
      status: { $in: ['pending', 'in_progress'] }
    });

    // Get all recipes
    const recipes = await base44.asServiceRole.entities.Recipe.list();

    // Get all raw materials
    const rawMaterials = await base44.asServiceRole.entities.RawMaterial.list();

    // Reset allocations for all materials
    const materialAllocations = {};
    rawMaterials.forEach(m => {
      materialAllocations[m.id] = 0;
    });

    // Calculate total allocation needed per material from active orders
    for (const order of activeOrders) {
      const recipe = recipes.find(r => r.id === order.recipe_id);
      if (!recipe || !recipe.ingredients) continue;

      // Use recipe yield_percent (e.g. 95 = 95%): raw_needed = quantity_to_produce / (yield_percent / 100)
      const yieldFactor = (recipe.yield_percent || 95) / 100;
      const rawNeeded = order.quantity_to_produce / yieldFactor;

      // Each ingredient's quantity_lbs is per-batch input. Scale proportionally to rawNeeded.
      const totalIngredientLbs = recipe.ingredients.reduce((sum, ing) => sum + (ing.quantity_lbs || 0), 0);
      for (const ingredient of recipe.ingredients) {
        // What fraction of total input does this ingredient represent?
        const ingredientFraction = totalIngredientLbs > 0 ? ingredient.quantity_lbs / totalIngredientLbs : 0;
        const ingredientNeeded = ingredientFraction * rawNeeded;

        // Find matching raw material by bucket_id first, then by category
        let material = rawMaterials.find(m => m.id === ingredient.bucket_id);
        if (!material) {
          material = rawMaterials.find(m => m.category === ingredient.category);
        }
        
        if (material) {
          materialAllocations[material.id] = (materialAllocations[material.id] || 0) + ingredientNeeded;
        }
      }
    }

    // Get received quantities for each material
    const rawInventory = await base44.asServiceRole.entities.RawInventory.list();
    const receivedByMaterial = {};
    rawInventory.forEach(inv => {
      const material = rawMaterials.find(m => m.id === inv.raw_material_id);
      if (material) {
        receivedByMaterial[material.id] = (receivedByMaterial[material.id] || 0) + inv.quantity;
      }
    });

    // Update each raw material with correct allocations and available qty
    const updates = [];
    for (const material of rawMaterials) {
      const received = receivedByMaterial[material.id] || 0;
      const allocated = materialAllocations[material.id] || 0;
      const available = Math.max(0, received - allocated);

      await base44.asServiceRole.entities.RawMaterial.update(material.id, {
        quantity_lbs: received,
        allocated_qty_lbs: allocated,
        available_qty_lbs: available
      });

      updates.push({
        materialId: material.id,
        name: material.name,
        received,
        allocated,
        available
      });
    }

    return Response.json({
      message: 'Raw material allocations synced',
      ordersProcessed: activeOrders.length,
      materialsUpdated: updates.length,
      updates
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});