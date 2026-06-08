import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 1. Delete all production stages
    const stages = await base44.asServiceRole.entities.ProductionStage.list(undefined, 1000);
    let deletedStages = 0;
    for (const stage of stages) {
      await base44.asServiceRole.entities.ProductionStage.delete(stage.id);
      deletedStages++;
    }

    // 2. Delete all released racks (the smokehouse card is built from these — clearing
    //    only stages left released racks behind, so the smokehouse still showed work).
    const racks = await base44.asServiceRole.entities.RackUnit.list(undefined, 1000);
    let deletedRacks = 0;
    for (const rack of racks) {
      await base44.asServiceRole.entities.RackUnit.delete(rack.id);
      deletedRacks++;
    }

    // 3. Clear any carried-over open partial rack left on production orders.
    const orders = await base44.asServiceRole.entities.ProductionOrder.list(undefined, 1000);
    let clearedPartials = 0;
    for (const order of orders) {
      if (order.open_partial_rack) {
        await base44.asServiceRole.entities.ProductionOrder.update(order.id, { open_partial_rack: null });
        clearedPartials++;
      }
    }

    return Response.json({
      success: true,
      deleted: deletedStages,
      deletedRacks,
      clearedPartials,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});