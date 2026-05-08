import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate today's lot number
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const lotNumber = `BLEND-${today}`;

    // Get all chopping stages that are available or in_progress
    const choppingStages = await base44.asServiceRole.entities.ProductionStage.filter({
      capability_key: "chopping",
    });

    const stagesToUpdate = choppingStages.filter(s => 
      s.status === "available" || s.status === "in_progress"
    );

    // Update each stage with the lot number
    for (const stage of stagesToUpdate) {
      await base44.asServiceRole.entities.ProductionStage.update(stage.id, {
        input_lot_number: lotNumber,
      });
    }

    return Response.json({
      success: true,
      updated: stagesToUpdate.length,
      lotNumber,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});