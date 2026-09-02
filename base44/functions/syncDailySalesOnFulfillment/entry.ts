import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Entity automation: when a SalesOrder transitions INTO "fulfilled", record one
// DailySalesRecord per line item. Only the transition counts — later edits to an
// already-fulfilled order (notes, route, etc.) must not create duplicate sales rows.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const order = payload.data;
    const previous = payload.old_data;

    if (!order || order.status !== 'fulfilled') {
      return Response.json({ skipped: true, reason: 'Not a fulfilled order' });
    }
    if (previous && previous.status === 'fulfilled') {
      return Response.json({ skipped: true, reason: 'Already fulfilled before this update' });
    }

    const lineItems = order.line_items || [];
    if (lineItems.length === 0) {
      return Response.json({ skipped: true, reason: 'No line items' });
    }

    // Belt-and-braces: never double-record the same sales order.
    const marker = `Sales Order #${order.order_number}`;
    const existing = await base44.asServiceRole.entities.DailySalesRecord.filter({ notes: `Auto-generated from ${marker}` }, undefined, 1);
    if (existing && existing.length > 0) {
      return Response.json({ skipped: true, reason: 'Sales already recorded for this order' });
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
        notes: `Auto-generated from ${marker}`,
      });

      records.push(item.product_name);
    }

    return Response.json({ success: true, records_created: records });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}