import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all non-cancelled, non-archived orders that have a route assigned
    const orders = await base44.asServiceRole.entities.SalesOrder.list();

    const routedOrders = orders.filter(o => o.route && o.status !== "cancelled");

    let archivedCount = 0;

    for (const order of routedOrders) {
      // Clear the route assignment so cards reset for the new week
      await base44.asServiceRole.entities.SalesOrder.update(order.id, {
        route: null
      });
      archivedCount++;
    }

    return Response.json({
      success: true,
      message: `Weekly route reset complete. ${archivedCount} order(s) had their route cleared.`,
      count: archivedCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});