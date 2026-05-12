import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all holds with released status
    const allHolds = await base44.entities.HoldRelease.list();
    const releasedHolds = allHolds.filter(h => h.status === 'released');

    return Response.json({ 
      total: allHolds.length,
      released: releasedHolds.length,
      holds: releasedHolds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});