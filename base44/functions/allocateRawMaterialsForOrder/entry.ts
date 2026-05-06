import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productionOrderId, productId, quantityToProduce, action } = await req.json();

    if (!productionOrderId || !productId || !quantityToProduce) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the product to find its recipe
    const product = await base44.entities.Product.get(productId);
    if (!product) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get the recipe to find ingredients
    if (!product.recipe_id) {
      return Response.json({ error: 'Product has no recipe assigned' }, { status: 400 });
    }

    const recipe = await base44.entities.Recipe.get(product.recipe_id);
    if (!recipe || !recipe.ingredients) {
      return Response.json({ error: 'Recipe has no ingredients' }, { status: 400 });
    }

    // Calculate consumption for each ingredient
    const yieldRatio = recipe.yield_lbs || 1;
    
    // For each ingredient in the recipe, allocate from raw materials
    const allocations = [];
    
    for (const ingredient of recipe.ingredients) {
      if (!ingredient.bucket_id) continue;

      // Calculate total needed for this production order
      const neededLbs = (quantityToProduce * ingredient.quantity_lbs) / yieldRatio;

      // Get raw materials for this bucket, ordered by FIFO
      const rawMaterials = await base44.asServiceRole.entities.RawMaterial.filter(
        { category: ingredient.category || "", status: "approved" },
        "received_date"
      );

      if (rawMaterials.length === 0) {
        allocations.push({
          ingredient: ingredient.bucket_name,
          needed: neededLbs,
          status: 'WARN_NO_STOCK',
          message: `No approved raw materials found for ${ingredient.bucket_name}`
        });
        continue;
      }

      let remainingNeeded = neededLbs;
      let allocated = 0;

      // Allocate from available raw materials (FIFO)
      for (const material of rawMaterials) {
        if (remainingNeeded <= 0) break;

        const available = material.available_qty_lbs || 0;
        const allocateQty = Math.min(remainingNeeded, available);

        if (allocateQty > 0) {
          // Update raw material allocation
          const currentAllocated = material.allocated_qty_lbs || 0;
          await base44.asServiceRole.entities.RawMaterial.update(material.id, {
            allocated_qty_lbs: currentAllocated + allocateQty
          });

          allocated += allocateQty;
          remainingNeeded -= allocateQty;
        }
      }

      allocations.push({
        ingredient: ingredient.bucket_name,
        needed: neededLbs,
        allocated,
        shortfall: remainingNeeded > 0 ? remainingNeeded : 0,
        status: remainingNeeded > 0 ? 'WARN_SHORTFALL' : 'OK'
      });
    }

    return Response.json({
      success: true,
      productionOrderId,
      allocations
    });
  } catch (error) {
    console.error('Error allocating materials:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});