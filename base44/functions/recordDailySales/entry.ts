import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { product_id, quantity_lbs, sales_date, customer_allocations } = await req.json();
    if (!product_id || !quantity_lbs || quantity_lbs <= 0) {
      return Response.json({ error: 'Invalid product_id or quantity_lbs' }, { status: 400 });
    }

    const buckets = await base44.entities.FinishedGoodsBucket.filter({ product_id });
    const bucket = buckets?.[0];
    if (!bucket) return Response.json({ error: 'No finished goods stock found for this product' }, { status: 404 });

    const currentQty = bucket.quantity_lbs || 0;
    if (currentQty < quantity_lbs) {
      return Response.json({ error: `Insufficient inventory for ${bucket.product_name}. Available: ${currentQty} lbs` }, { status: 400 });
    }

    const product = await base44.entities.Product.get(product_id);
    const caseWeight = product?.case_weight_lbs || bucket.case_weight_lbs || 1;
    const newQty = currentQty - quantity_lbs;

    // FIFO through bucket lots (oldest production date first), updating lots + matching InventoryItems
    const lots = [...(bucket.lots || [])];
    const order = lots.map((l, i) => i).sort((a, b) => String(lots[a].production_date || '').localeCompare(String(lots[b].production_date || '')));
    let remaining = quantity_lbs;
    for (const i of order) {
      if (remaining <= 0) break;
      const lot = lots[i];
      if (lot.status && lot.status !== 'available') continue;
      const take = Math.min(lot.quantity_lbs || 0, remaining);
      if (take <= 0) continue;
      const lotQty = (lot.quantity_lbs || 0) - take;
      lots[i] = { ...lot, quantity_lbs: lotQty, cases: Math.floor(lotQty / caseWeight), status: lotQty <= 0 ? 'shipped' : lot.status };
      remaining -= take;

      // Deduct the same amount from this lot's inventory items, oldest first
      const items = await base44.entities.InventoryItem.filter({ product_id, lot_number: lot.lot_number, status: 'available' }, 'created_date');
      let itemRemaining = take;
      for (const item of items) {
        if (itemRemaining <= 0) break;
        const t = Math.min(item.quantity_lbs || 0, itemRemaining);
        if (t <= 0) continue;
        const q = (item.quantity_lbs || 0) - t;
        await base44.entities.InventoryItem.update(item.id, { quantity_lbs: q, status: q <= 0 ? 'shipped' : item.status });
        itemRemaining -= t;
      }
    }

    await base44.entities.FinishedGoodsBucket.update(bucket.id, {
      quantity_lbs: newQty,
      cases_on_hand: Math.floor(newQty / caseWeight),
      lots,
    });

    await base44.entities.DailySalesRecord.create({
      product_id,
      product_name: bucket.product_name,
      quantity_lbs,
      customer_allocations: Array.isArray(customer_allocations) ? customer_allocations : [],
      sales_date: sales_date || new Date().toISOString().split('T')[0],
    });

    return Response.json({ success: true, new_quantity: newQty });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}