import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await base44.asServiceRole.entities.ProductionOrder.filter({
      status: ['pending', 'in_progress']
    });

    const products = await base44.asServiceRole.entities.Product.list();
    const recipes = await base44.asServiceRole.entities.Recipe.list();
    const rawMaterials = await base44.asServiceRole.entities.RawMaterial.filter({
      status: 'approved'
    });

    const results = [];
    const errors = [];

    for (const order of orders) {
      try {
        const product = products.find(p => p.id === order.product_id);
        const recipe = recipes.find(r => r.id === order.recipe_id);

        if (!product || !recipe || !recipe.ingredients) {
          errors.push({ orderId: order.id, error: 'Product or recipe not found' });
          continue;
        }

        const allocations = [];
        const yieldPercentage = recipe.yield_lbs / 100; // Convert percentage to decimal

        // Process each ingredient in the recipe
        for (const ingredient of recipe.ingredients) {
          // Calculate raw material needed: finished_qty ÷ yield%
          const rawNeeded = order.quantity_to_produce / yieldPercentage;

          // Find matching material by category
          const material = rawMaterials.find(m => m.category === ingredient.category);

          if (!material) {
            allocations.push({
              ingredient: ingredient.bucket_name,
              needed: rawNeeded,
              allocated: 0,
              shortfall: rawNeeded
            });
            continue;
          }

          // FIFO allocation
          const availableQty = material.available_qty_lbs || 0;
          const allocatedQty = Math.min(availableQty, rawNeeded);
          const shortfall = Math.max(0, rawNeeded - allocatedQty);

          // Update material
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

        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'reallocated',
          allocations
        });
      } catch (e) {
        errors.push({ orderId: order.id, error: e.message });
      }
    }

    return Response.json({
      message: 'Reallocation complete',
      totalOrders: orders.length,
      processedOrders: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});