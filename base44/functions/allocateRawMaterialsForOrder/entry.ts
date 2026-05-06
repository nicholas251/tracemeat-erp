import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productionOrderId, productId, quantityToProduce } = body;

    if (!productionOrderId || !productId || quantityToProduce === undefined) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get product and recipe
    const product = await base44.asServiceRole.entities.Product.get(productId);
    if (!product || !product.recipe_id) {
      return Response.json({ error: 'Product or recipe not found' }, { status: 404 });
    }

    const recipe = await base44.asServiceRole.entities.Recipe.get(product.recipe_id);
    if (!recipe || !recipe.ingredients) {
      return Response.json({ error: 'Recipe or ingredients not found' }, { status: 404 });
    }

    // Get approved raw materials
    const rawMaterials = await base44.asServiceRole.entities.RawMaterial.filter({
      status: 'approved'
    });

    const allocations = [];
    const yieldPercentage = recipe.yield_lbs / 100; // Convert percentage to decimal

    for (const ingredient of recipe.ingredients) {
      // Calculate raw material needed: finished_qty ÷ yield%
      const rawNeeded = quantityToProduce / yieldPercentage;

      // Find matching material by category
      const material = rawMaterials.find(m => m.category === ingredient.category);
      
      if (!material) {
        allocations.push({
          ingredient: ingredient.bucket_name,
          needed: rawNeeded,
          allocated: 0,
          shortfall: rawNeeded,
          error: 'No approved material found for category'
        });
        continue;
      }

      // Allocate available quantity (FIFO)
      const availableQty = material.available_qty_lbs || 0;
      const allocatedQty = Math.min(availableQty, rawNeeded);
      const shortfall = Math.max(0, rawNeeded - allocatedQty);

      // Update material allocation
      if (allocatedQty > 0) {
        await base44.asServiceRole.entities.RawMaterial.update(material.id, {
          allocated_qty_lbs: (material.allocated_qty_lbs || 0) + allocatedQty,
          available_qty_lbs: availableQty - allocatedQty
        });
      }

      allocations.push({
        ingredient: ingredient.bucket_name,
        needed: rawNeeded,
        allocated: allocatedQty,
        shortfall
      });
    }

    return Response.json({
      message: 'Allocation complete',
      productionOrderId,
      allocations
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});