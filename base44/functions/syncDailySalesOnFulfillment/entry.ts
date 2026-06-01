import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const order = payload.data;

    if (!order || order.status !== 'fulfilled') {
      return Response.json({ skipped: true, reason: 'Not a fulfilled order' });
    }

    const lineItems = order.line_items || [];
    if (lineItems.length === 0) {
      return Response.json({ skipped: true, reason: 'No line items' });
    }

    const salesDate = order.fulfilled_at
      ? order.fulfilled_at.split('T')[0]
      : (order.ship_date || new Date().toISOString().split('T')[0]);

    const records = [];
    for (const item of lineItems) {
      if (!item.product_id || !item.total_lbs) continue;

      await base44.asServiceRole.entities.DailySalesRecord.create({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_lbs: item.total_lbs,
        sales_date: salesDate,
        notes: `Auto-generated from Sales Order #${order.order_number}`,
      });

      records.push(item.product_name);
    }

    return Response.json({ success: true, records_created: records });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});