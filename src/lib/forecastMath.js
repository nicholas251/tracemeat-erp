// Forecast engine: demand (weighted sales + open orders), supply (usable FG + WIP),
// target (2 weeks cover capped by shelf life + safety stock), and suggested production.
const DAY = 86400000;
const TARGET_DAYS = 14;
const dayStr = (d) => d.toISOString().slice(0, 10);

export function buildForecast({ products, sales, lots, openOrders, wipOrders, wipProduced }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = dayStr(today);
  const horizonStr = dayStr(new Date(today.getTime() + TARGET_DAYS * DAY));
  const recentCut = dayStr(new Date(today.getTime() - 14 * DAY));

  return products.map((p) => {
    const ps = sales.filter((s) => s.product_id === p.id);
    const recent = ps.filter((s) => s.sales_date >= recentCut).reduce((a, s) => a + (s.quantity_lbs || 0), 0);
    const older = ps.filter((s) => s.sales_date < recentCut).reduce((a, s) => a + (s.quantity_lbs || 0), 0);
    const recentDaily = recent / 14;
    const olderDaily = older / 28;
    // Recent 2 weeks weigh as much as the 4 weeks before them
    const avgDaily = ps.length ? 0.5 * recentDaily + 0.5 * olderDaily : 0;
    const trendPct = olderDaily > 0 ? Math.round(((recentDaily - olderDaily) / olderDaily) * 100) : null;

    // Weekly variability -> safety stock (~95% service level)
    const weeks = Array(6).fill(0);
    ps.forEach((s) => {
      const w = Math.floor((today - new Date(s.sales_date + "T00:00:00")) / (7 * DAY));
      if (w >= 0 && w < 6) weeks[w] += s.quantity_lbs || 0;
    });
    const mean = weeks.reduce((a, b) => a + b, 0) / 6;
    const sd = Math.sqrt(weeks.reduce((a, b) => a + (b - mean) ** 2, 0) / 6);
    const safety = ps.length ? 1.65 * sd : 0;

    // Cover days capped by shelf life so we don't overstock short-life items
    const shelf = p.shelf_life_days || 0;
    const coverDays = shelf ? Math.min(TARGET_DAYS, Math.max(3, Math.floor(shelf * 0.6))) : TARGET_DAYS;

    // Open sales orders shipping in the next 2 weeks
    let orderLbs = 0;
    openOrders.forEach((o) => {
      const d = o.route_date || o.ship_date || o.order_date || todayStr;
      if (d > horizonStr) return;
      (o.line_items || []).forEach((l) => {
        if (l.product_id === p.id) orderLbs += l.total_lbs || (l.cases_qty || 0) * (l.case_weight_lbs || p.case_weight_lbs || 0);
      });
    });

    const caseW = p.case_weight_lbs || 0;
    const parLbs = (p.par_cases || 0) * caseW;
    const target = Math.max(avgDaily * coverDays + safety, orderLbs + safety, parLbs);

    // Supply: usable lots (not expired, not held), held lots, expiry risk (FIFO)
    const pl = lots.filter((l) => l.product_id === p.id);
    const usableLots = pl
      .filter((l) => l.status === "available" && (!l.expiry_date || l.expiry_date >= todayStr))
      .sort((a, b) => (a.expiry_date || "9999").localeCompare(b.expiry_date || "9999"));
    const usable = usableLots.reduce((a, l) => a + (l.quantity_lbs || 0), 0);
    const held = pl.filter((l) => l.status === "quarantined").reduce((a, l) => a + (l.quantity_lbs || 0), 0);
    let sold = 0, atRisk = 0;
    usableLots.forEach((l) => {
      const q = l.quantity_lbs || 0;
      if (!l.expiry_date || avgDaily <= 0) { sold += q; return; }
      const days = (new Date(l.expiry_date + "T00:00:00") - today) / DAY;
      const canSell = Math.max(0, avgDaily * days - sold);
      const sellable = Math.min(q, canSell);
      atRisk += q - sellable;
      sold += sellable;
    });

    // Work in progress: expected finished lbs from open production orders
    const yieldPct = p.yield_percent || 100;
    const wip = wipOrders
      .filter((o) => o.product_id === p.id)
      .reduce((a, o) => a + Math.max(0, (o.quantity_to_produce || 0) * (yieldPct / 100) - (wipProduced[o.order_number] || 0)), 0);

    const projected = usable + wip;
    const shortfall = Math.max(0, target - projected);
    const batchLbs = p.tumble_batch_lbs || p.blend_batch_lbs || 0;
    const rawNeeded = shortfall / (yieldPct / 100);
    const batches = batchLbs && shortfall > 0 ? Math.ceil(rawNeeded / batchLbs) : 0;
    const suggestedLbs = batches ? batches * batchLbs : Math.ceil(rawNeeded);

    const pct = target > 0 ? Math.round((projected / target) * 100) : projected > 0 ? 100 : 0;
    const status = target === 0 && projected === 0 ? "none" : pct >= 75 ? "green" : pct >= 50 ? "yellow" : "red";
    const r = (n) => Math.round(n);

    return {
      id: p.id, name: p.name, sku: p.sku,
      avgDaily: Math.round(avgDaily * 10) / 10, trendPct, coverDays,
      daysOfCover: avgDaily > 0 ? Math.round((usable / avgDaily) * 10) / 10 : null,
      target: r(target), safety: r(safety), orderLbs: r(orderLbs),
      usable: r(usable), held: r(held), atRisk: r(atRisk), wip: r(wip), projected: r(projected),
      shortfall: r(shortfall), batches, batchLbs, suggestedLbs: r(suggestedLbs),
      targetCases: caseW ? Math.ceil(target / caseW) : null,
      shortCases: caseW ? Math.ceil(shortfall / caseW) : null,
      pct, status, salesDays: new Set(ps.map((s) => s.sales_date)).size,
    };
  });
}