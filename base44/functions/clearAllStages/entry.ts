import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Helper: delete every record of an entity, looping through all pages.
    const deleteAll = async (entity) => {
      let count = 0;
      while (true) {
        const batch = await entity.list(undefined, 200);
        if (!batch.length) break;
        for (const rec of batch) {
          await entity.delete(rec.id);
          count++;
        }
        if (batch.length < 200) break;
      }
      return count;
    };

    // 1. Delete all production stages
    const deletedStages = await deleteAll(base44.asServiceRole.entities.ProductionStage);

    // 2. Delete all released racks (the smokehouse card is built from these — clearing
    //    only stages left released racks behind, so the smokehouse still showed work).
    const deletedRacks = await deleteAll(base44.asServiceRole.entities.RackUnit);

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