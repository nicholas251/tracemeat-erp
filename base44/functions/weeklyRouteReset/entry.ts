import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { notes } = await req.json().catch(() => ({}));

    // Fetch all orders that have a route assigned (excluding cancelled)
    const orders = await base44.asServiceRole.entities.SalesOrder.list();
    const routedOrders = orders.filter(o => o.route && o.status !== "cancelled");

    let archivedCount = 0;
    const timestamp = new Date().toLocaleDateString();

    for (const order of routedOrders) {
      // Clear the route and append notes
      const updatedNotes = notes
        ? `${order.notes ? order.notes + "\n" : ""}[Daily Close-Out ${timestamp}]: ${notes}`
        : order.notes;

      await base44.asServiceRole.entities.SalesOrder.update(order.id, {
        route: null,
        notes: updatedNotes,
      });
      archivedCount++;
    }

    return Response.json({
      success: true,
      message: `Daily route close-out complete. ${archivedCount} order(s) route cleared.`,
      count: archivedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});