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
    const corrections = [];

    for (const material of rawMaterials) {
      // If status is not "approved", update it
      if (material.status !== 'approved') {
        await base44.asServiceRole.entities.RawMaterial.update(material.id, {
          status: 'approved'
        });
        corrections.push({
          id: material.id,
          name: material.name,
          change: `Status updated from '${material.status}' to 'approved'`
        });
      }

      // If quantity is 0 or missing, set a default
      if (!material.quantity_lbs || material.quantity_lbs === 0) {
        const defaultQty = 1000; // 1000 lbs default
        await base44.asServiceRole.entities.RawMaterial.update(material.id, {
          quantity_lbs: defaultQty,
          available_qty_lbs: defaultQty
        });
        corrections.push({
          id: material.id,
          name: material.name,
          change: `Quantity updated to ${defaultQty} lbs`
        });
      }
    }

    return Response.json({
      message: 'Corrections applied',
      correctedCount: corrections.length,
      corrections
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});