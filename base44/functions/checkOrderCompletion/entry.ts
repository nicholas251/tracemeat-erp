import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Entity automation handler: runs when a ProductionStage is created/updated.
// Marks the parent ProductionOrder completed (and archives it) only when:
//   1. every stage on the order is completed, AND
//   2. at least one completed stage is the flow's FINAL step.
// Rule 2 closes a race: the wizard marks e.g. chilling "completed" a moment BEFORE it
// creates the packaging stage. Without it, this handler could observe "all stages done"
// in that gap and close the order while product was still waiting to be packed.
export default async function(req) {
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

        // The final step of the flow must be among the completed stages.
        if (order.flow_id) {
            const flow = await base44.asServiceRole.entities.ProductFlow.filter({ id: order.flow_id }).then(r => r?.[0]);
            const flowSteps = flow?.steps || [];
            if (flowSteps.length > 0) {
                const lastStepNumber = Math.max(...flowSteps.map(s => Number(s.step_number) || 0));
                const finalStepDone = stages.some(s => Number(s.step_number) === lastStepNumber && s.status === "completed");
                if (!finalStepDone) {
                    return Response.json({ updated: false, reason: `final flow step ${lastStepNumber} not completed yet` });
                }
            }
        }

        await base44.asServiceRole.entities.ProductionOrder.update(orderId, { status: "completed", archived: true });
        return Response.json({ updated: true, order_id: orderId, archived: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}