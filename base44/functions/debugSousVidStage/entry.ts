import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { stageId } = await req.json();

    if (!stageId) {
      return Response.json({ error: 'stageId required' }, { status: 400 });
    }

    const stage = await base44.entities.ProductionStage.filter({ id: stageId }).then(r => r?.[0]);

    if (!stage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 });
    }

    return Response.json({
      id: stage.id,
      order_number: stage.order_number,
      product_name: stage.product_name,
      input_qty_lbs: stage.input_qty_lbs,
      status: stage.status,
      sub_batches_count: stage.sub_batches?.length || 0,
      sub_batches: stage.sub_batches || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});