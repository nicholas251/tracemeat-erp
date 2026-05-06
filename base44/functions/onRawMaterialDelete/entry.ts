import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { entity_id } = body.event;

    // Delete any RawInventory records linked to the deleted raw material
    const linked = await base44.asServiceRole.entities.RawInventory.filter({ raw_material_id: entity_id });

    for (const item of linked) {
      await base44.asServiceRole.entities.RawInventory.delete(item.id);
    }

    return Response.json({ deleted: linked.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});