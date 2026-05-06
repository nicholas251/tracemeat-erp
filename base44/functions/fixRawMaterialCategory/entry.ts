import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipes = await base44.asServiceRole.entities.Recipe.list();
    const rawMaterials = await base44.asServiceRole.entities.RawMaterial.list();

    // Get all unique ingredient categories from recipes
    const expectedCategories = new Set();
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients || []) {
        expectedCategories.add(ingredient.category);
      }
    }

    // Update raw materials to match expected categories
    const corrections = [];
    for (const material of rawMaterials) {
      // Map poultry and other categories to 'protein'
      let newCategory = material.category;
      if (['poultry', 'beef', 'pork', 'lamb'].includes(material.category)) {
        newCategory = 'protein';
      }

      if (newCategory !== material.category) {
        await base44.asServiceRole.entities.RawMaterial.update(material.id, {
          category: newCategory
        });
        corrections.push({
          id: material.id,
          name: material.name,
          change: `Category updated from '${material.category}' to '${newCategory}'`
        });
      }
    }

    return Response.json({
      message: 'Category corrections applied',
      correctedCount: corrections.length,
      corrections,
      expectedCategories: Array.from(expectedCategories)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});