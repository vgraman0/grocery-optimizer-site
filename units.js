// Port of backend/units.py — size parsing, conversion, and unit pricing.
// Exposes: GroceryUnits.parseSize, GroceryUnits.formatSize, GroceryUnits.unitPrice
(function () {
  const MASS_TO_G = {
    g: 1, gram: 1, grams: 1, kg: 1000, mg: 0.001,
    oz: 28.3495, lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  };
  const VOLUME_TO_ML = {
    ml: 1, l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
    "fl oz": 29.5735, floz: 29.5735,
    gal: 3785.41, gallon: 3785.41, gallons: 3785.41,
    qt: 946.353, quart: 946.353, quarts: 946.353,
    pt: 473.176, pint: 473.176, pints: 473.176,
  };
  const COUNT_UNITS = new Set(["ct", "pack", "pk", "each", "count", "packs"]);
  const LIQUID_RE = /\b(milk|juice|water|soda|oil|cream|drink|beverage|tea|coffee|lemonade|wine|beer|ale|cider|kombucha|broth|stock|vinegar|syrup)\b/i;
  const SIZE_RE = /(\d+(?:\.\d+)?)\s*(fl\s*oz|floz|lbs|lb|kg|mg|ml|oz|gal|qt|pt|l\b|g\b|gallons?|quarts?|pints?|liters?|litres?|pounds?|grams?|each|count|packs?|pk|ct)/i;

  function parseSize(s, context) {
    if (!s) return { kind: "unknown", amountBase: 0 };
    const text = s.trim();
    if (text.toLowerCase().startsWith("per ")) return { kind: "unknown", amountBase: 0 };
    const m = SIZE_RE.exec(text);
    if (!m) return { kind: "unknown", amountBase: 0 };
    const num = parseFloat(m[1]);
    let unit = m[2].replace(/\s+/g, " ").trim().toLowerCase();
    if (unit === "fl oz" || unit === "floz")
      return { kind: "volume", amountBase: num * 29.5735 };
    if (unit === "oz" && context && LIQUID_RE.test(context))
      return { kind: "volume", amountBase: num * 29.5735 };
    if (unit in MASS_TO_G)
      return { kind: "mass", amountBase: num * MASS_TO_G[unit] };
    if (unit in VOLUME_TO_ML)
      return { kind: "volume", amountBase: num * VOLUME_TO_ML[unit] };
    if (COUNT_UNITS.has(unit))
      return { kind: "count", amountBase: num };
    return { kind: "unknown", amountBase: 0 };
  }

  function formatSize(kind, amountBase, system) {
    if (!kind || kind === "unknown" || !(amountBase > 0)) return "";
    if (kind === "mass") {
      if (system === "imperial") {
        const oz = amountBase / 28.3495;
        return oz >= 16 ? (oz / 16).toFixed(2) + " lb" : oz.toFixed(2) + " oz";
      }
      return amountBase >= 1000
        ? (amountBase / 1000).toFixed(2) + " kg"
        : Math.round(amountBase) + " g";
    }
    if (kind === "volume") {
      if (system === "imperial") {
        const floz = amountBase / 29.5735;
        return floz >= 128 ? (floz / 128).toFixed(2) + " gal" : floz.toFixed(1) + " fl oz";
      }
      return amountBase >= 1000
        ? (amountBase / 1000).toFixed(2) + " L"
        : Math.round(amountBase) + " ml";
    }
    if (kind === "count") {
      return (Number.isInteger(amountBase) ? amountBase : amountBase.toFixed(1)) + " ct";
    }
    return "";
  }

  function unitPrice(cents, kind, amountBase, system) {
    if (cents == null || !kind || kind === "unknown" || !(amountBase > 0)) return "";
    if (kind === "mass") {
      if (system === "imperial") return "$" + (cents / (amountBase / 28.3495) / 100).toFixed(2) + "/oz";
      return "$" + (cents / (amountBase / 100) / 100).toFixed(2) + "/100g";
    }
    if (kind === "volume") {
      if (system === "imperial") return "$" + (cents / (amountBase / 29.5735) / 100).toFixed(2) + "/fl oz";
      return "$" + (cents / (amountBase / 100) / 100).toFixed(2) + "/100ml";
    }
    if (kind === "count") return "$" + (cents / amountBase / 100).toFixed(2) + "/each";
    return "";
  }

  window.GroceryUnits = { parseSize, formatSize, unitPrice };
})();
