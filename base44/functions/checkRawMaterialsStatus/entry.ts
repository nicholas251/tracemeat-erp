import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all raw materials
    const rawMaterials = await base44.asServiceRole.entities.RawMaterial.list();

    const summary = {
      total: rawMaterials.length,
      byStatus: {},
      byCategory: {},
      materials: []
    };

    for (const material of rawMaterials) {
      summary.materials.push({
        id: material.id,
        name: material.name,
        lot: material.lot_number,
        category: material.category,
        status: material.status,
        available: material.available_qty_lbs || 0,
        allocated: material.allocated_qty_lbs || 0,
        quantity: material.quantity_lbs || 0
      });

      summary.byStatus[material.status] = (summary.byStatus[material.status] || 0) + 1;
      summary.byCategory[material.category] = (summary.byCategory[material.category] || 0) + 1;
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});