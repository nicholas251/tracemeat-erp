import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipes = await base44.asServiceRole.entities.Recipe.list();
    
    const updates = [];
    for (const recipe of recipes) {
      if (recipe.yield_lbs === 95) {
        await base44.asServiceRole.entities.Recipe.update(recipe.id, {
          yield_lbs: 1000
        });
        updates.push({
          id: recipe.id,
          name: recipe.name,
          oldYield: 95,
          newYield: 1000
        });
      }
    }

    return Response.json({
      message: 'Recipe yields corrected',
      updatedCount: updates.length,
      updates
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});