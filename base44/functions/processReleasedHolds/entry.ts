import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all holds and filter for released ones
    const allHolds = await base44.entities.HoldRelease.list();
    const holds = allHolds.filter(h => h.status === 'released');
    const processed = [];

    for (const hold of holds) {
      if (!hold.batch_id || hold.quantity_affected_kg === undefined || hold.quantity_affected_kg === null) {
        continue;
      }

      const releaseQty = Number(hold.quantity_affected_kg) || 0;
      if (releaseQty === 0) continue;

      // Try to determine item type from batch if not set
      let itemType = hold.item_type;
      if (!itemType) {
        const batch = await base44.entities.Batch.filter({ id: hold.batch_id });
        const rawMat = await base44.entities.RawMaterial.filter({ id: hold.batch_id });
        const invItem = await base44.entities.InventoryItem.filter({ id: hold.batch_id });
        
        if (batch[0]) itemType = 'batch';
        else if (rawMat[0]) itemType = 'raw_material';
        else if (invItem[0]) itemType = 'finished_goods';
      }

      // Process each item type
      if (itemType === 'raw_material') {
        const freshItems = await base44.entities.RawMaterial.filter({ id: hold.batch_id });
        if (freshItems[0]) {
          const currentQty = freshItems[0].available_qty_lbs || 0;
          await base44.entities.RawMaterial.update(hold.batch_id, { 
            available_qty_lbs: currentQty + releaseQty,
            status: 'approved'
          });
          
          const freshLots = await base44.entities.RawInventory.filter({ raw_material_id: hold.batch_id });
          if (freshLots[0]) {
            const updatedQty = (freshLots[0].available_qty || 0) + releaseQty;
            await base44.entities.RawInventory.update(freshLots[0].id, { 
              available_qty: updatedQty, 
              status: 'available' 
            });
          }
          processed.push({ id: hold.id, type: 'raw_material', restored: releaseQty });
        }
      } else if (itemType === 'finished_goods') {
        const freshItems = await base44.entities.InventoryItem.filter({ id: hold.batch_id });
        if (freshItems[0]) {
          const currentQty = freshItems[0].quantity_lbs || 0;
          await base44.entities.InventoryItem.update(hold.batch_id, { 
            quantity_lbs: currentQty + releaseQty, 
            status: 'available' 
          });
          processed.push({ id: hold.id, type: 'finished_goods', restored: releaseQty });
        }
      } else if (itemType === 'batch') {
        await base44.entities.Batch.update(hold.batch_id, { status: 'completed' });
        processed.push({ id: hold.id, type: 'batch', restored: releaseQty });
      }
    }

    return Response.json({ 
      message: `Processed ${processed.length} released hold(s)`,
      processed 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});