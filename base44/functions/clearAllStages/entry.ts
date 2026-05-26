import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const stages = await base44.asServiceRole.entities.ProductionStage.list(undefined, 1000);
    let deleted = 0;

    for (const stage of stages) {
      await base44.asServiceRole.entities.ProductionStage.delete(stage.id);
      deleted++;
    }

    return Response.json({ success: true, deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});