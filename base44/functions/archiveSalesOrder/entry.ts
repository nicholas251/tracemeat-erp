import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { order_id } = await req.json();
  const order = await base44.asServiceRole.entities.SalesOrder.get(order_id);
  if (!order || !['fulfilled', 'invoiced'].includes(order.status) || order.archived) {
    return Response.json({ skipped: true });
  }
  await base44.asServiceRole.entities.SalesOrder.update(order_id, {
    archived: true,
    archived_at: new Date().toISOString(),
  });
  return Response.json({ archived: true });
});