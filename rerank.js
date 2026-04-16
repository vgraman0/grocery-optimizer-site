// Port of backend/rerank.py — scoring + stable sort for search relevance.
// Exposes: GroceryRerank.rerank
(function () {
  const DERIVED = new Set([
    "sauce", "soup", "ketchup", "paste", "chip", "chips", "flavored",
    "flavor", "seasoning", "base", "mix", "spread", "dressing", "juice",
    "powder", "broth", "bouillon", "dip", "puree", "snack", "crackers",
    "cracker", "cookie", "cookies", "candy", "bar", "bars", "drink",
    "beverage", "syrup", "kit", "meal",
  ]);
  const WORD_RE = /[\w']+/g;

  function words(text) {
    return new Set((text.toLowerCase().match(WORD_RE) || []));
  }

  function score(query, name) {
    const q = query.trim().toLowerCase();
    if (!q || !name) return 0;
    const n = name.toLowerCase();
    const qWords = words(q);
    const nWords = words(n);
    let s = 0;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp("(?<!\\w)" + escaped + "(?!\\w)").test(n)) s += 10;
    else if (n.includes(q)) s += 3;
    if (n.startsWith(q)) s += 3;
    let allPresent = true;
    for (const w of qWords) { if (!nWords.has(w)) { allPresent = false; break; } }
    if (qWords.size > 0 && allPresent) s += 2;
    s -= Math.max(0, name.length - 35) * 0.05;
    for (const w of DERIVED) {
      if (nWords.has(w) && !qWords.has(w)) s -= 5;
    }
    return s;
  }

  function rerank(query, items, limit) {
    const scored = items.map((it, idx) => [score(query, it.name || ""), idx, it]);
    scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return scored.slice(0, limit).map(t => t[2]);
  }

  window.GroceryRerank = { rerank, score };
})();
