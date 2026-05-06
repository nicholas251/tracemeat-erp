import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all production orders and related data via service role
    const orders = await base44.asServiceRole.entities.ProductionOrder.list();
    const products = await base44.asServiceRole.entities.Product.list();
    const recipes = await base44.asServiceRole.entities.Recipe.list();
    const rawMaterials = await base44.asServiceRole.entities.RawMaterial.list();

    const results = [];

    for (const order of orders) {
      if (order.status === 'pending' || order.status === 'in_progress') {
        const product = products.find(p => p.id === order.product_id);
        const recipe = product ? recipes.find(r => r.id === product.recipe_id) : null;
        
        if (!product || !recipe) {
          results.push({ orderId: order.id, orderNumber: order.order_number, status: 'skipped', reason: 'Product or recipe not found' });
          continue;
        }

        try {
          // Reallocate materials for this order
          const yieldRatio = recipe.yield_lbs || 1;
          const allocations = [];

          // For each ingredient, allocate from raw materials
          for (const ingredient of recipe.ingredients || []) {
            if (!ingredient.bucket_id) continue;

            const neededLbs = (order.quantity_to_produce * ingredient.quantity_lbs) / yieldRatio;
            
            // Get raw materials for this category
            const categoryMaterials = rawMaterials.filter(m => m.category === ingredient.category && m.status === 'approved');
            
            let remainingNeeded = neededLbs;
            let allocated = 0;

            // FIFO allocation
            for (const material of categoryMaterials) {
              if (remainingNeeded <= 0) break;
              
              const available = material.available_qty_lbs || 0;
              const allocateQty = Math.min(remainingNeeded, available);

              if (allocateQty > 0) {
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
              shortfall: remainingNeeded > 0 ? remainingNeeded : 0
            });
          }

          results.push({ orderId: order.id, orderNumber: order.order_number, status: 'reallocated', allocations });
        } catch (e) {
          results.push({ orderId: order.id, orderNumber: order.order_number, status: 'error', error: e.message });
        }
      }
    }

    return Response.json({ 
      message: 'Reallocation complete',
      totalOrders: orders.length,
      processedOrders: results.length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});