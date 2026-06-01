import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { notes } = await req.json().catch(() => ({}));

    // Fetch all orders that have a route assigned (excluding cancelled)
    const orders = await base44.asServiceRole.entities.SalesOrder.list();
    const routedOrders = orders.filter(o => o.route && o.status !== "cancelled");

    let archivedCount = 0;

    for (const order of routedOrders) {
      // Archive the order: clear route so route cards reset for next week
      // Append week-end notes to existing order notes if provided
      const updatedNotes = notes
        ? `${order.notes ? order.notes + "\n" : ""}[Week Close-Out ${new Date().toLocaleDateString()}]: ${notes}`
        : order.notes;

      await base44.asServiceRole.entities.SalesOrder.update(order.id, {
        route: null,
        notes: updatedNotes,
      });
      archivedCount++;
    }

    return Response.json({
      success: true,
      message: `Weekly route archive complete. ${archivedCount} order(s) cleared from routes.`,
      count: archivedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});