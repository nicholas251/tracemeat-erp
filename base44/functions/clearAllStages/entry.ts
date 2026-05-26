import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all production stages
    const allStages = await base44.asServiceRole.entities.ProductionStage.list();

    // Delete each one
    for (const stage of allStages) {
      await base44.asServiceRole.entities.ProductionStage.delete(stage.id);
    }

    return Response.json({ success: true, deleted: allStages.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});