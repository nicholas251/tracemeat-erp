import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const hold = {
      batch_id: "6a032ddecb85528521e167be",
      quantity_affected_kg: 100
    };

    // Try to find the batch
    const batch = await base44.entities.Batch.filter({ id: hold.batch_id });
    console.log("Batch found:", batch);

    // Try to find finished goods
    const inventory = await base44.entities.InventoryItem.filter({ id: hold.batch_id });
    console.log("Inventory found:", inventory);

    // Try raw material
    const rawMaterial = await base44.entities.RawMaterial.filter({ id: hold.batch_id });
    console.log("Raw material found:", rawMaterial);

    return Response.json({ 
      batch: batch[0] || null,
      inventory: inventory[0] || null,
      rawMaterial: rawMaterial[0] || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});