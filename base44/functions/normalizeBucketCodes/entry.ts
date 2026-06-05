import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time admin utility: assigns clean, short, unique, human-readable codes
 * to every InventoryBucket.
 *
 * Format: <PREFIX>-<NNN>  e.g. SPICE-001, PROT-014, PKG-002, CASE-003
 * Prefix is derived from the bucket category.
 *
 * Payload:
 *   dry_run: boolean (default true) — when true, returns the planned changes
 *            without writing anything.
 */
const PREFIX_BY_CATEGORY = {
  protein: 'PROT',
  spice: 'SPICE',
  packaging: 'PKG',
  casing: 'CASE',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true

    const buckets = await base44.asServiceRole.entities.InventoryBucket.list('created_date', 1000);

    // Counter per prefix so codes are sequential and unique
    const counters = {};
    const changes = [];

    for (const b of buckets) {
      const prefix = PREFIX_BY_CATEGORY[b.category] || 'BKT';
      counters[prefix] = (counters[prefix] || 0) + 1;
      const newCode = `${prefix}-${String(counters[prefix]).padStart(3, '0')}`;

      if (b.code !== newCode) {
        changes.push({ id: b.id, name: b.name, category: b.category, old_code: b.code || '', new_code: newCode });
      }
    }

    if (!dryRun) {
      for (const c of changes) {
        await base44.asServiceRole.entities.InventoryBucket.update(c.id, { code: c.new_code });
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      total_buckets: buckets.length,
      changes_count: changes.length,
      changes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});