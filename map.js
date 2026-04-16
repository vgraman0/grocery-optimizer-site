// Leaflet map + store selection. Exposes window.GroceryMap.
(function () {
  const state = { stores: [], selected: new Set(), map: null, markers: {} };
  const listeners = [];

  function notify() {
    for (const fn of listeners) fn(Array.from(state.selected));
  }

  function makeIcon(selected) {
    return L.divIcon({
      className: "gm-marker",
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:${selected ? "#2e7d32" : "#999"};
        border:3px solid white;
        box-shadow:0 0 0 1px #333;"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  function toggleStore(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    const m = state.markers[id];
    if (m) m.setIcon(makeIcon(state.selected.has(id)));
    renderLegend();
    notify();
  }

  function renderLegend() {
    const el = document.getElementById("store-legend");
    el.innerHTML = "";
    for (const s of state.stores) {
      const chip = document.createElement("span");
      chip.className = "chip" + (state.selected.has(s.id) ? " on" : "");
      chip.textContent = s.name;
      chip.onclick = () => toggleStore(s.id);
      el.appendChild(chip);
    }
  }

  function init(stores) {
    state.stores = stores;
    state.map = L.map("map").setView([40.8075, -73.9626], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(state.map);

    for (const s of state.stores) {
      state.selected.add(s.id);
      const m = L.marker([s.lat, s.lon], { icon: makeIcon(true) })
        .addTo(state.map)
        .bindTooltip(s.name, { permanent: false });
      m.on("click", () => toggleStore(s.id));
      state.markers[s.id] = m;
    }
    renderLegend();
    notify();
  }

  window.GroceryMap = {
    init,
    selected: () => Array.from(state.selected),
    storesById: () => {
      const m = {};
      for (const s of state.stores) m[s.id] = s;
      return m;
    },
    onChange: (fn) => listeners.push(fn),
  };
})();
