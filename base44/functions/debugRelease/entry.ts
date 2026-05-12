import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update the released hold to include item_type
    const holdId = "6a03303316f9ce1561cfdd6b";
    const hold = await base44.entities.HoldRelease.filter({ id: holdId });
    
    if (hold[0]) {
      await base44.entities.HoldRelease.update(holdId, { item_type: "raw_material" });
      return Response.json({ message: "Hold updated with item_type", holdId });
    }

    return Response.json({ error: "Hold not found" }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});