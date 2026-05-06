import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await base44.asServiceRole.entities.ProductionOrder.list();
    const products = await base44.asServiceRole.entities.Product.list();
    const recipes = await base44.asServiceRole.entities.Recipe.list();
    const rawMaterials = await base44.asServiceRole.entities.RawMaterial.list();

    const order = orders[0];
    const product = products.find(p => p.id === order.product_id);
    const recipe = recipes.find(r => r.id === order.recipe_id);

    // Calculate material needs
    const neededMaterials = {};
    if (recipe && recipe.ingredients) {
      for (const ingredient of recipe.ingredients) {
        // Calculate how much of this ingredient is needed
        // Based on recipe yield vs production quantity
        const needed = (order.quantity_to_produce / recipe.yield_lbs) * ingredient.quantity_lbs;
        neededMaterials[ingredient.bucket_name] = {
          quantity_lbs: ingredient.quantity_lbs,
          yield_lbs: recipe.yield_lbs,
          produced: order.quantity_to_produce,
          calculated: needed
        };
      }
    }

    // Get allocated amounts
    const allocated = {};
    for (const material of rawMaterials) {
      if (material.allocated_qty_lbs > 0) {
        allocated[material.name] = material.allocated_qty_lbs;
      }
    }

    return Response.json({
      order: {
        orderNumber: order.order_number,
        quantityToProduce: order.quantity_to_produce,
        productName: product?.name
      },
      recipe: {
        name: recipe?.name,
        yield_lbs: recipe?.yield_lbs,
        ingredients: recipe?.ingredients || []
      },
      calculatedNeeds: neededMaterials,
      allocated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});