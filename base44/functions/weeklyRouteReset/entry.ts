import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { notes } = await req.json().catch(() => ({}));

    // Fetch all orders that have a route assigned (excluding cancelled)
    const orders = await base44.asServiceRole.entities.SalesOrder.list();
    const routedOrders = orders.filter(o => o.route && o.status !== "cancelled");

    // Fetch finished goods buckets for inventory deduction
    const buckets = await base44.asServiceRole.entities.FinishedGoodsBucket.list();

    let archivedCount = 0;
    const timestamp = new Date().toLocaleDateString();

    for (const order of routedOrders) {
      // Deduct cases from FinishedGoodsBucket for each line item
      for (const lineItem of order.line_items || []) {
        const bucket = buckets.find(b => b.product_id === lineItem.product_id);
        if (bucket) {
          const newCases = Math.max(0, (bucket.cases_on_hand || 0) - (lineItem.cases_qty || 0));
          const casesToDeduct = (bucket.cases_on_hand || 0) - newCases;
          const lbsToDeduct = casesToDeduct * (bucket.case_weight_lbs || 0);
          const newLbs = Math.max(0, (bucket.quantity_lbs || 0) - lbsToDeduct);

          // Mark oldest lot as shipped (FIFO)
          const updatedLots = (bucket.lots || []).map(lot => {
            if (lot.status === "available" && lbsToDeduct > 0) {
              const deductFromLot = Math.min(lot.quantity_lbs || 0, lbsToDeduct);
              return {
                ...lot,
                quantity_lbs: (lot.quantity_lbs || 0) - deductFromLot,
                status: (lot.quantity_lbs || 0) - deductFromLot <= 0 ? "shipped" : "available",
              };
            }
            return lot;
          });

          await base44.asServiceRole.entities.FinishedGoodsBucket.update(bucket.id, {
            quantity_lbs: newLbs,
            cases_on_hand: newCases,
            lots: updatedLots,
          });
        }
      }

      // Archive the order: clear route and append notes
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
      message: `Daily route close-out complete. ${archivedCount} order(s) archived, inventory consumed.`,
      count: archivedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});