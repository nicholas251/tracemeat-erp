import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { product_id, quantity_lbs } = await req.json();

    if (!product_id || !quantity_lbs || quantity_lbs <= 0) {
      return Response.json({ error: 'Invalid product_id or quantity_lbs' }, { status: 400 });
    }

    // Find the finished goods bucket for this product
    const buckets = await base44.entities.FinishedGoodsBucket.filter({
      product_id: product_id
    });

    if (!buckets || buckets.length === 0) {
      return Response.json({ error: 'No finished goods bucket found for this product' }, { status: 404 });
    }

    const bucket = buckets[0];
    const currentQty = bucket.quantity_lbs || 0;

    if (currentQty < quantity_lbs) {
      return Response.json({ error: 'Insufficient inventory. Available: ' + currentQty + ' lbs' }, { status: 400 });
    }

    // Deduct from bucket
    const newQty = currentQty - quantity_lbs;
    const product = await base44.entities.Product.get(product_id);
    const caseWeight = product?.case_weight_lbs || 1;
    const newCases = Math.floor(newQty / caseWeight);

    await base44.entities.FinishedGoodsBucket.update(bucket.id, {
      quantity_lbs: newQty,
      cases_on_hand: newCases
    });

    // Update InventoryItem records to reflect deduction via lot FIFO
    const lotEntries = bucket.lots || [];
    let remainingToDeduct = quantity_lbs;

    for (const lot of lotEntries) {
      if (remainingToDeduct <= 0) break;
      if (lot.status !== "available") continue;

      const deductQty = Math.min(lot.quantity_lbs || 0, remainingToDeduct);
      if (deductQty > 0) {
        const newLotQty = (lot.quantity_lbs || 0) - deductQty;
        
        // Update inventory items linked to this lot
        const inventoryItems = await base44.entities.InventoryItem.filter({
          batch_number: lot.lot_number
        });

        for (const item of inventoryItems) {
          const itemNewQty = Math.max(0, (item.quantity_lbs || 0) - deductQty);
          await base44.entities.InventoryItem.update(item.id, {
            quantity_lbs: itemNewQty,
            status: itemNewQty === 0 ? "shipped" : item.status
          });
        }

        remainingToDeduct -= deductQty;
      }
    }

    return Response.json({
      success: true,
      message: `Deducted ${quantity_lbs} lbs from ${bucket.product_name}`,
      new_quantity: newQty,
      new_cases: newCases
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});