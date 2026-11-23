import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;

// Archives purchase orders that have sat partially received for 24 hours.
// Called hourly by a workflow. Pass { dry_run: true } to only list what would be archived.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { dry_run } = await req.json().catch(() => ({}));
    const POs = base44.asServiceRole.entities.PurchaseOrder;

    const partial = [];
    let cursor;
    do {
      const page = await POs.filter({ status: 'partial_received' }, { limit: 200, cursor });
      partial.push(...page.items);
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);

    const now = Date.now();
    // The clock starts at the last partial receipt; older orders fall back to their last change.
    const due = partial.filter((po) => {
      const since = new Date(po.partial_received_at || po.updated_date).getTime();
      return now - since >= ARCHIVE_AFTER_MS;
    });

    if (dry_run) {
      return Response.json({ partial: partial.length, due: due.map((po) => po.po_number) });
    }

    const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const failed = [];
    for (let i = 0; i < due.length; i += 6) {
      const results = await Promise.allSettled(due.slice(i, i + 6).map((po) => POs.update(po.id, {
        status: 'archived',
        notes: [po.notes, `Partial receipt auto-archived after 24 hours (${stamp})`].filter(Boolean).join('\n'),
      })));
      results.forEach((r, j) => { if (r.status === 'rejected') failed.push(due[i + j].po_number); });
    }

    return Response.json({ partial: partial.length, archived: due.length - failed.length, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}