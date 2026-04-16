// Static frontend — reads data/prices.json, uses localStorage for picks,
// runs optimize/rerank/units locally in the browser.
(function () {
  const STORE_ORDER = ["westside", "morton", "hmart"];
  const FORM_PREFILL_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfsDPsCk8SRuMr3bDCRIhsX2Ji0s0IpDgAzqkCXyJxGGHl9kQ/viewform?usp=pp_url&entry.522783924=ITEM_PLACEHOLDER";
  const list = [];
  let mode = "per_item";
  let unitSystem = "imperial";
  let catalog = null; // loaded from data/prices.json

  function $(id) { return document.getElementById(id); }
  function fmt(cents) { return cents == null ? "—" : "$" + (cents / 100).toFixed(2); }

  // --- localStorage picks ---
  function getSavedPicks(key) {
    try { return JSON.parse(localStorage.getItem("picks:" + key.toLowerCase()) || "{}"); }
    catch { return {}; }
  }
  function savePicks(key, entries) {
    const obj = {};
    for (const e of entries) obj[e.store_id] = e;
    localStorage.setItem("picks:" + key.toLowerCase(), JSON.stringify(obj));
  }

  // --- freshness ---
  function renderFreshness() {
    const el = $("freshness");
    if (!el || !catalog) return;
    const gen = new Date(catalog.generated_at);
    const hoursAgo = Math.round((Date.now() - gen.getTime()) / 3600000);
    el.textContent = hoursAgo <= 0
      ? "prices updated just now"
      : `prices updated ${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
  }

  // --- autocomplete ---
  function populateAutocomplete() {
    const dl = $("item-suggestions");
    if (!dl || !catalog) return;
    dl.innerHTML = "";
    for (const key of Object.keys(catalog.items).sort()) {
      const opt = document.createElement("option");
      opt.value = key;
      dl.appendChild(opt);
    }
  }

  // --- search (reads from catalog, no network) ---
  function setStatus(msg) { $("search-status").textContent = msg || ""; }

  function doSearch() {
    const q = $("search-input").value.trim().toLowerCase();
    if (!q) return;
    const qty = Math.max(1, parseInt($("qty-input").value || "1", 10));
    const selected = window.GroceryMap.selected();
    if (selected.length === 0) { setStatus("Select at least one store on the map first."); return; }
    if (!catalog || !catalog.items[q]) {
      setStatus("");
      $("search-results").innerHTML = `
        <div class="store-results" style="border-color:#e65100;">
          <h4>"${q}" is not in the catalog yet</h4>
          <p style="font-size:13px;color:#666;margin:4px 0 10px;">
            Click below to request it. It'll be available after the next scrape (within 6 hours).
          </p>
          <a href="${FORM_PREFILL_URL.replace("ITEM_PLACEHOLDER", encodeURIComponent(q))}"
             target="_blank" rel="noopener"
             style="display:inline-block;padding:8px 14px;background:#e65100;color:white;border-radius:6px;text-decoration:none;font-size:14px;">
            Request "${q}"
          </a>
        </div>`;
      return;
    }
    setStatus("");
    const resultsByStore = {};
    for (const sid of selected) resultsByStore[sid] = catalog.items[q][sid] || [];
    const savedPicks = getSavedPicks(q);
    renderSearchResults(q, qty, resultsByStore, savedPicks);
  }

  function renderSearchResults(query, qty, resultsByStore, savedPicks) {
    const host = $("search-results");
    host.innerHTML = "";
    const storeInfo = window.GroceryMap.storesById();
    const pendingEntry = { key: query, qty, prices: {}, picks: {} };
    const stores = Object.keys(resultsByStore);

    // Previously picked card
    const savedEntries = savedPicks ? Object.entries(savedPicks) : [];
    if (savedEntries.length > 0) {
      const card = document.createElement("div");
      card.className = "store-results";
      card.style.borderColor = "#2e7d32";
      card.innerHTML = `<h4 style="color:#2e7d32">Previously picked for "${query}"</h4>`;
      for (const [sid, p] of savedEntries) {
        const sizeDisp = GroceryUnits.formatSize(p.kind, p.amount_base, unitSystem) || p.size || "";
        const perDisp = GroceryUnits.unitPrice(p.price_cents, p.kind, p.amount_base, unitSystem);
        const row = document.createElement("div");
        row.className = "product-row";
        row.innerHTML = `
          <span class="pname">${storeInfo[sid]?.name || sid} · ${p.name}</span>
          <span class="psize">${sizeDisp}</span>
          <span class="pper">${perDisp}</span>
          <span class="pprice">${fmt(p.price_cents)}</span>`;
        card.appendChild(row);
      }
      const reuseBtn = document.createElement("button");
      reuseBtn.textContent = "Reuse these picks";
      reuseBtn.style.cssText = "margin-top:8px;padding:6px 12px;background:#2e7d32;color:white;border:none;border-radius:6px;cursor:pointer;";
      reuseBtn.onclick = () => {
        const entry = { key: query, qty, prices: { westside: null, morton: null, hmart: null }, picks: {} };
        for (const [sid, p] of savedEntries) {
          entry.prices[sid] = p.price_cents;
          entry.picks[sid] = { name: p.name, size: p.size, kind: p.kind, amount_base: p.amount_base };
        }
        list.push(entry);
        renderList();
        $("search-input").value = "";
        host.innerHTML = "";
        $("search-input").focus();
      };
      card.appendChild(reuseBtn);
      host.appendChild(card);
    }

    // Per-store result cards
    for (const sid of stores) {
      const card = document.createElement("div");
      card.className = "store-results";
      card.innerHTML = `<h4>${storeInfo[sid]?.name || sid}</h4>`;
      const items = resultsByStore[sid];
      if (!items || items.length === 0) {
        const p = document.createElement("div");
        p.className = "empty";
        p.textContent = "No results.";
        card.appendChild(p);
      } else {
        for (const it of items.slice(0, 6)) {
          const sizeDisp = GroceryUnits.formatSize(it.kind, it.amount_base, unitSystem) || it.size || "";
          const perDisp = GroceryUnits.unitPrice(it.price_cents, it.kind, it.amount_base, unitSystem);
          const row = document.createElement("div");
          row.className = "product-row";
          row.innerHTML = `
            <span class="pname">${it.name}</span>
            <span class="psize">${sizeDisp}</span>
            <span class="pper">${perDisp}</span>
            <span class="pprice">${fmt(it.price_cents)}</span>`;
          const btn = document.createElement("button");
          btn.textContent = "Pick";
          btn.onclick = () => {
            pendingEntry.prices[sid] = it.price_cents;
            pendingEntry.picks[sid] = {
              id: it.id, name: it.name, size: it.size,
              kind: it.kind, amount_base: it.amount_base,
            };
            for (const b of card.querySelectorAll("button")) { b.textContent = "Pick"; b.style.background = "white"; }
            btn.textContent = "✓ Picked";
            btn.style.background = "#c8e6c9";
          };
          row.appendChild(btn);
          card.appendChild(row);
        }
      }
      host.appendChild(card);
    }

    // Add to list button
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add to shopping list";
    addBtn.style.cssText = "margin-top:10px;padding:8px 14px;background:#1976d2;color:white;border:none;border-radius:6px;cursor:pointer;";
    addBtn.onclick = () => {
      if (Object.keys(pendingEntry.prices).length === 0) { setStatus("Pick a product in at least one store first."); return; }
      for (const sid of STORE_ORDER) { if (!(sid in pendingEntry.prices)) pendingEntry.prices[sid] = null; }
      list.push(pendingEntry);
      renderList();
      // Save picks to localStorage
      const entries = [];
      for (const [sid, picked] of Object.entries(pendingEntry.picks)) {
        entries.push({
          store_id: sid, product_id: picked.id || null, name: picked.name,
          size: picked.size || "", price_cents: pendingEntry.prices[sid],
          kind: picked.kind, amount_base: picked.amount_base,
        });
      }
      if (entries.length > 0) savePicks(pendingEntry.key, entries);
      $("search-input").value = "";
      host.innerHTML = "";
      $("search-input").focus();
    };
    host.appendChild(addBtn);
  }

  // --- list + optimize ---
  function renderList() {
    const tbody = $("list-table").querySelector("tbody");
    tbody.innerHTML = "";
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const priceCell = (sid) => {
        const c = it.prices[sid];
        if (c == null) return `<td class="missing">—</td>`;
        const pick = it.picks && it.picks[sid];
        const per = pick ? GroceryUnits.unitPrice(c, pick.kind, pick.amount_base, unitSystem) : "";
        return `<td class="price">${fmt(c)}${per ? `<div class="per-unit">${per}</div>` : ""}</td>`;
      };
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${it.key}</td><td>${it.qty}</td>
        ${priceCell("westside")}${priceCell("morton")}${priceCell("hmart")}
        <td class="remove"><button title="remove">✕</button></td>`;
      tr.querySelector("button").onclick = () => { list.splice(i, 1); renderList(); renderResults(); };
      tbody.appendChild(tr);
    }
    renderResults();
  }

  function renderResults() {
    const host = $("results");
    if (list.length === 0) { host.innerHTML = `<div class="empty">Add items to your list to see a plan.</div>`; return; }
    const selected = window.GroceryMap.selected();
    const items = list.map(it => ({ key: it.key, qty: it.qty, prices: it.prices }));
    const per = GroceryOptimize.perItemCheapest(items);
    const single = GroceryOptimize.singleStoreTotal(items, selected);
    drawPlans({ per_item: per, single_store: single });
  }

  function drawPlans(data) {
    const host = $("results");
    const storeInfo = window.GroceryMap.storesById();
    const storeName = (sid) => sid ? (storeInfo[sid]?.name || sid) : "—";
    const per = data.per_item, single = data.single_store;

    host.innerHTML = `
      <div class="plan" style="${mode === "per_item" ? "border-color:#1976d2;border-width:2px;" : ""}">
        <div class="total">Per-item cheapest: ${fmt(per.total_cents)}</div>
        <table>${per.picks.map(p => `
          <tr><td>${p.key} × ${p.qty}</td><td class="store">${storeName(p.store_id)}</td>
              <td style="text-align:right">${fmt(p.line_cents)}</td></tr>`).join("")}
        </table>
      </div>
      <div class="plan" style="${mode === "single" ? "border-color:#1976d2;border-width:2px;" : ""}">
        <div class="total">Single-store best: ${single.store_id ? storeName(single.store_id) + " — " + fmt(single.total_cents) : "no single store has everything"}</div>
        <table>${Object.entries(single.per_store_totals).map(([sid, t]) => `
          <tr><td>${storeName(sid)}</td><td style="text-align:right">${t == null ? "missing items" : fmt(t)}</td></tr>`).join("")}
        </table>
      </div>`;
  }

  // --- mode + unit toggles ---
  function setMode(m) {
    mode = m;
    $("mode-per-item").classList.toggle("active", m === "per_item");
    $("mode-single").classList.toggle("active", m === "single");
    renderResults();
  }

  function setUnitSystem(sys) {
    unitSystem = sys;
    $("unit-imperial").classList.toggle("active", sys === "imperial");
    $("unit-metric").classList.toggle("active", sys === "metric");
    renderList();
  }

  // --- bootstrap ---
  async function main() {
    try {
      catalog = await fetch("data/prices.json").then(r => r.json());
    } catch (e) {
      setStatus("Failed to load prices.json — run the scraper first.");
      return;
    }
    window.GroceryMap.init(catalog.stores);
    window.GroceryMap.onChange(() => renderResults());
    populateAutocomplete();
    renderFreshness();
    $("search-btn").onclick = doSearch;
    $("search-input").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
    $("mode-per-item").onclick = () => setMode("per_item");
    $("mode-single").onclick = () => setMode("single");
    $("unit-imperial").onclick = () => setUnitSystem("imperial");
    $("unit-metric").onclick = () => setUnitSystem("metric");
    renderList();
  }
  main();
})();
