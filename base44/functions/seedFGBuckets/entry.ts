import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all products
  const products = await base44.asServiceRole.entities.Product.list();

  // Get existing FG buckets to avoid duplicates
  const existingBuckets = await base44.asServiceRole.entities.FinishedGoodsBucket.list();
  const existingProductIds = new Set(existingBuckets.map(b => b.product_id));

  const toCreate = products.filter(p => !existingProductIds.has(p.id));

  let created = 0;
  for (const p of toCreate) {
    await base44.asServiceRole.entities.FinishedGoodsBucket.create({
      product_id: p.id,
      product_name: p.name?.trim() || 'Unknown',
      sku: p.sku || '',
      product_number: p.product_number || '',
      category: (p.category || '').replace(/_/g, ' '),
      quantity_lbs: 0,
      cases_on_hand: 0,
      case_weight_lbs: p.case_weight_lbs || null,
      lots: [],
      status: 'active',
    });
    created++;
  }

  return Response.json({
    success: true,
    total_products: products.length,
    already_existed: existingProductIds.size,
    created,
  });
});