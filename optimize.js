// Port of backend/optimize.py — per-item cheapest + single-store total.
// Exposes: GroceryOptimize.perItemCheapest, GroceryOptimize.singleStoreTotal
(function () {
  function perItemCheapest(items) {
    const picks = [];
    let total = 0;
    for (const it of items) {
      let bestSid = null, bestPrice = Infinity;
      for (const [sid, p] of Object.entries(it.prices)) {
        if (p != null && p < bestPrice) { bestSid = sid; bestPrice = p; }
      }
      if (bestSid == null) {
        picks.push({ key: it.key, qty: it.qty, store_id: null, unit_cents: null, line_cents: null });
      } else {
        const line = bestPrice * it.qty;
        total += line;
        picks.push({ key: it.key, qty: it.qty, store_id: bestSid, unit_cents: bestPrice, line_cents: line });
      }
    }
    return { total_cents: total, picks };
  }

  function singleStoreTotal(items, storeIds) {
    const perStore = {};
    for (const sid of storeIds) {
      let total = 0, ok = true;
      for (const it of items) {
        const p = it.prices[sid];
        if (p == null) { ok = false; break; }
        total += p * it.qty;
      }
      perStore[sid] = ok ? total : null;
    }
    let bestSid = null, bestTotal = null;
    for (const [sid, t] of Object.entries(perStore)) {
      if (t != null && (bestTotal == null || t < bestTotal)) { bestSid = sid; bestTotal = t; }
    }
    const picks = bestSid ? items.map(it => ({
      key: it.key, qty: it.qty, store_id: bestSid,
      unit_cents: it.prices[bestSid], line_cents: it.prices[bestSid] * it.qty,
    })) : [];
    return { store_id: bestSid, total_cents: bestTotal, picks, per_store_totals: perStore };
  }

  window.GroceryOptimize = { perItemCheapest, singleStoreTotal };
})();
