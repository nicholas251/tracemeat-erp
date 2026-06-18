import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Entity automation handler: runs when a ProductionStage is created/updated/deleted.
// If every stage for the parent order is completed (and at least one exists),
// the parent ProductionOrder is marked completed. No-op otherwise.
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const body = await req.json().catch(() => ({}));
        const orderId = body?.event?.entity_name === "ProductionStage"
            ? (body?.data?.order_id || body?.old_data?.order_id)
            : null;

        if (!orderId) {
            return Response.json({ skipped: true, reason: "no order_id in payload" });
        }

        const stages = await base44.asServiceRole.entities.ProductionStage.filter({ order_id: orderId });
        if (!stages || stages.length === 0) {
            return Response.json({ skipped: true, reason: "no stages" });
        }

        const allComplete = stages.every(s => s.status === "completed");
        if (!allComplete) {
            return Response.json({ updated: false, reason: "stages still open" });
        }

        const order = await base44.asServiceRole.entities.ProductionOrder.get(orderId);
        if (!order) {
            return Response.json({ skipped: true, reason: "order not found" });
        }
        if (order.status === "completed") {
            return Response.json({ updated: false, reason: "already completed" });
        }

        await base44.asServiceRole.entities.ProductionOrder.update(orderId, { status: "completed" });
        return Response.json({ updated: true, order_id: orderId });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});