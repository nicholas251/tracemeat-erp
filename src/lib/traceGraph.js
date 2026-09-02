// Recall traceability graph. Given a search term and every relevant record, resolve the
// set of affected production orders and, for each, the full backward chain (supplier lots)
// and forward chain (finished-goods lots → shipments → customers).

const norm = (v) => (v == null ? "" : String(v)).toLowerCase().trim();

export function buildTrace(term, data) {
  const q = norm(term);
  if (!q) return null;
  const {
    orders = [], stages = [], racks = [], rawInventory = [], inventoryItems = [],
    fgBuckets = [], salesOrders = [], holds = [], unfinishedCases = [],
  } = data;
  const hit = (v) => !!v && norm(v).includes(q);

  // ── 1. Raw lots that match, plus produced spice-mix lots that CONTAIN a matching lot ──
  const rawLotNumbers = new Set();
  const rawIds = new Set();
  for (const r of rawInventory) {
    const direct = hit(r.lot_number) || hit(r.supplier) || hit(r.po_number);
    const viaComponent = (r.component_lots || []).some(c => hit(c.lot_number));
    if (direct || viaComponent) { if (r.lot_number) rawLotNumbers.add(norm(r.lot_number)); rawIds.add(r.id); }
  }
  const rawHit = (lotNumber, rawId) =>
    hit(lotNumber) || (lotNumber && rawLotNumbers.has(norm(lotNumber))) || (rawId && rawIds.has(rawId));

  // ── 2. Direct hits across the chain → affected order ids + why ──
  const reasons = new Map(); // order_id -> Set(reason)
  const add = (orderId, reason) => {
    if (!orderId) return;
    if (!reasons.has(orderId)) reasons.set(orderId, new Set());
    reasons.get(orderId).add(reason);
  };

  for (const o of orders) if (hit(o.order_number) || hit(o.product_name)) add(o.id, "Order match");

  for (const s of stages) {
    if ([s.input_lot_number, s.output_lot_number, s.cook_batch_lot, s.pork_lot_number, s.binder_lot_number,
         s.spice_mix_lot_number, s.cure_lot_number].some(hit)) add(s.order_id, `Lot on ${s.capability_key} stage`);
    if ((s.consumed_lots || []).some(c => rawHit(c.lot_number, c.raw_inventory_id))) add(s.order_id, `Raw lot consumed at ${s.capability_key}`);
    for (const sb of (s.sub_batches || [])) {
      if (hit(sb.lot_number) || (sb.raw_lots || []).some(hit)) add(s.order_id, "Sub-batch lot");
      for (const ing of (sb.ingredients || []))
        if ((ing.lot_allocations || []).some(a => rawHit(a.lot_number, a.raw_inventory_id))) add(s.order_id, `Raw lot in ${s.capability_key} batch`);
    }
    if ((s.gaylords || []).some(g => hit(g.lot_number)) || (s.cases || []).some(c => hit(c.lot_number))) add(s.order_id, "Packed lot");
  }

  for (const r of racks)
    if (hit(r.lot_number) || hit(r.cook_batch_lot) || (r.lot_contributions || []).some(c => hit(c.lot_number))) add(r.order_id, "Rack lot");

  const orderByNumber = new Map(orders.map(o => [o.order_number, o]));
  for (const it of inventoryItems)
    if (hit(it.lot_number) || (it.component_lots || []).some(c => hit(c.lot_number))) add(it.batch_id, "Finished-goods lot");
  for (const b of fgBuckets)
    for (const l of (b.lots || [])) if (hit(l.lot_number)) add(orderByNumber.get(l.order_number)?.id, "Finished-goods lot");

  const itemByLot = new Map(inventoryItems.map(it => [norm(it.lot_number), it]));
  const itemById = new Map(inventoryItems.map(it => [it.id, it]));
  for (const so of salesOrders) {
    const soHit = hit(so.order_number) || hit(so.customer_name);
    for (const li of (so.line_items || []))
      for (const f of (li.fulfilled_lots || [])) {
        const it = itemById.get(f.inventory_item_id) || itemByLot.get(norm(f.lot_number));
        if (soHit || hit(f.lot_number)) add(it?.batch_id, soHit ? "Shipped on matching sales order" : "Shipped lot");
      }
  }

  for (const uc of unfinishedCases)
    if ((uc.lot_contributions || []).some(c => hit(c.lot_number))) { add(uc.source_order_id, "Carry-over lot"); add(uc.consumed_order_id, "Absorbed carry-over lot"); }

  // ── 3. Propagate through carry-overs: an affected order's leftover packed into another run ──
  let grew = true;
  while (grew) {
    grew = false;
    for (const uc of unfinishedCases) {
      if (reasons.has(uc.source_order_id) && uc.consumed_order_id && !reasons.has(uc.consumed_order_id)) {
        add(uc.consumed_order_id, `Received carry-over from #${uc.source_order_number}`); grew = true;
      }
    }
  }

  // ── 4. Build the per-order chain ──
  const rawById = new Map(rawInventory.map(r => [r.id, r]));
  const rawByLot = new Map(rawInventory.map(r => [norm(r.lot_number), r]));
  const affected = [];
  for (const [orderId, why] of reasons) {
    const order = orders.find(o => o.id === orderId);
    if (!order) continue;
    const oStages = stages.filter(s => s.order_id === orderId).sort((a, b) => (a.step_number || 0) - (b.step_number || 0));
    const oRacks = racks.filter(r => r.order_id === orderId).sort((a, b) => (a.rack_number || 0) - (b.rack_number || 0));

    // Raw lots — authoritative consumed_lots first, operator lot_allocations as fallback
    const rawMap = new Map();
    const addRaw = (c, stageKey, materialType) => {
      const inv = rawById.get(c.raw_inventory_id) || rawByLot.get(norm(c.lot_number));
      const key = `${c.bucket_name || inv?.bucket_name || ""}|${c.lot_number}`;
      const row = rawMap.get(key) || {
        material_type: c.material_type || materialType, bucket_name: c.bucket_name || inv?.bucket_name || "",
        lot_number: c.lot_number || "", supplier: c.supplier || inv?.supplier || "", po_number: c.po_number || inv?.po_number || "",
        received_date: c.received_date || inv?.received_date || "", lbs: 0, stages: new Set(),
        component_lots: inv?.component_lots || [], matched: rawHit(c.lot_number, c.raw_inventory_id),
      };
      row.lbs += Number(c.lbs ?? c.actual_lbs) || 0;
      row.stages.add(stageKey);
      rawMap.set(key, row);
    };
    for (const s of oStages) {
      if ((s.consumed_lots || []).length) {
        for (const c of s.consumed_lots) addRaw(c, s.capability_key, c.material_type);
      } else {
        for (const sb of (s.sub_batches || [])) for (const ing of (sb.ingredients || []))
          for (const a of (ing.lot_allocations || [])) addRaw({ ...a, bucket_name: ing.bucket_name, lbs: a.actual_lbs }, s.capability_key, "protein");
      }
    }
    const rawLots = [...rawMap.values()].map(r => ({ ...r, lbs: parseFloat(r.lbs.toFixed(2)), stages: [...r.stages] }));

    // Finished goods lots
    const fgLots = inventoryItems.filter(it => it.batch_id === orderId).map(it => ({
      id: it.id, lot_number: it.lot_number, product_name: it.product_name, sku: it.sku, cook_batch_lot: it.cook_batch_lot,
      component_lots: it.component_lots || [], original_lbs: it.original_quantity_lbs || 0, on_hand_lbs: it.quantity_lbs || 0,
      status: it.status, production_date: it.production_date, expiry_date: it.expiry_date,
      matched: hit(it.lot_number) || (it.component_lots || []).some(c => hit(c.lot_number)),
    }));
    const fgLotNums = new Set(fgLots.map(f => norm(f.lot_number)));
    const fgIds = new Set(fgLots.map(f => f.id));

    // Shipments
    const shipments = [];
    for (const so of salesOrders) for (const li of (so.line_items || [])) for (const f of (li.fulfilled_lots || [])) {
      if (fgIds.has(f.inventory_item_id) || fgLotNums.has(norm(f.lot_number))) {
        shipments.push({
          sales_order_id: so.id, order_number: so.order_number, customer_name: so.customer_name, ship_date: so.ship_date || so.fulfilled_at,
          product_name: li.product_name, lot_number: f.lot_number, lbs: f.qty_lbs_taken || 0, status: so.status, matched: hit(f.lot_number) || hit(so.order_number) || hit(so.customer_name),
        });
      }
    }

    const carryOvers = unfinishedCases.filter(uc => uc.source_order_id === orderId || uc.consumed_order_id === orderId);
    const stageIds = new Set(oStages.map(s => s.id));
    const allLots = new Set([...fgLotNums, ...oStages.flatMap(s => [s.input_lot_number, s.output_lot_number, s.cook_batch_lot]).filter(Boolean).map(norm)]);
    const oHolds = holds.filter(h =>
      h.batch_id === orderId || stageIds.has(h.batch_id) || fgIds.has(h.batch_id) ||
      (h.batch_number && (h.batch_number === order.order_number || allLots.has(norm(h.batch_number)))));

    affected.push({ order, reasons: [...why], stages: oStages, racks: oRacks, rawLots, fgLots, shipments, carryOvers, holds: oHolds });
  }
  affected.sort((a, b) => (b.order.created_date || "").localeCompare(a.order.created_date || ""));

  const summary = {
    orders: affected.length,
    products: [...new Set(affected.flatMap(a => [a.order.product_name, ...a.fgLots.map(f => f.product_name)]).filter(Boolean))],
    fgLots: affected.reduce((n, a) => n + a.fgLots.length, 0),
    onHandLbs: parseFloat(affected.reduce((n, a) => n + a.fgLots.reduce((s, f) => s + (f.on_hand_lbs || 0), 0), 0).toFixed(2)),
    shippedLbs: parseFloat(affected.reduce((n, a) => n + a.shipments.reduce((s, sh) => s + (sh.lbs || 0), 0), 0).toFixed(2)),
    customers: [...new Set(affected.flatMap(a => a.shipments.map(s => s.customer_name)).filter(Boolean))],
    activeHolds: affected.reduce((n, a) => n + a.holds.filter(h => h.status === "on_hold" || h.status === "under_review").length, 0),
  };
  return { affected, summary, hit };
}