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

    const order = orders[0];
    const product = products.find(p => p.id === order.product_id);
    const recipe = product ? recipes.find(r => r.id === product.recipe_id) : null;

    return Response.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        productId: order.product_id,
        recipeId: order.recipe_id
      },
      product: {
        id: product?.id,
        name: product?.name,
        recipeId: product?.recipe_id
      },
      recipe: {
        id: recipe?.id,
        name: recipe?.name,
        ingredients: recipe?.ingredients || []
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});