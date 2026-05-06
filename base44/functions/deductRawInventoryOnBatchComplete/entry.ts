import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batch_id, quantity_lbs, recipe_id } = await req.json();

    if (!batch_id || !quantity_lbs || !recipe_id) {
      return Response.json({ error: 'Missing batch_id, quantity_lbs, or recipe_id' }, { status: 400 });
    }

    // Fetch recipe with ingredient bucket links
    const recipe = await base44.entities.Recipe.read(recipe_id);
    if (!recipe) {
      return Response.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Calculate consumption ratio (batch qty vs recipe yield)
    const ratio = quantity_lbs / recipe.yield_lbs;

    // Deduct from each ingredient bucket using FIFO
    for (const ingredient of recipe.ingredients) {
      const consumedQty = ingredient.quantity_lbs * ratio;

      // Find oldest available RawInventory lot in this bucket (FIFO)
      const lots = await base44.entities.RawInventory.filter({
        bucket_id: ingredient.bucket_id,
        status: 'available'
      }, 'received_date', 100);

      let remainingToDeduct = consumedQty;

      for (const lot of lots) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(lot.available_qty, remainingToDeduct);
        remainingToDeduct -= deductAmount;

        // Update lot availability
        const newAvailableQty = lot.available_qty - deductAmount;
        await base44.entities.RawInventory.update(lot.id, {
          available_qty: Math.max(0, newAvailableQty),
          status: newAvailableQty <= 0 ? 'depleted' : 'in_use'
        });
      }

      if (remainingToDeduct > 0) {
        console.warn(`Insufficient inventory for bucket ${ingredient.bucket_id}: needed ${remainingToDeduct} lbs more`);
      }
    }

    return Response.json({ success: true, message: 'Raw inventory deducted successfully' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});