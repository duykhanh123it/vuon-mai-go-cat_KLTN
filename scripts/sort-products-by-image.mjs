import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const RAW_PATH = path.join(ROOT, "products_raw.json");
const IMAGE_MAP_JSON = path.join(ROOT, "imageMap.json"); // nếu có
const PRODUCTS_DIR = path.join(ROOT, "public", "products"); // fallback nếu không có imageMap.json

// --- Helpers ---
const normalizeCode = (raw) =>
  String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ""); // "BS 01" -> "BS01"

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const hasValue = (v) => v !== null && v !== undefined && v !== "";

// --- Build hasImage lookup ---
function loadHasImageLookup() {
  // 1) Prefer imageMap.json (code -> true)
  if (fs.existsSync(IMAGE_MAP_JSON)) {
    const map = JSON.parse(fs.readFileSync(IMAGE_MAP_JSON, "utf-8"));
    return (code) => map[code] === true;
  }

  // 2) Fallback: scan public/products filenames
  if (fs.existsSync(PRODUCTS_DIR)) {
    const exts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    const files = fs.readdirSync(PRODUCTS_DIR);
    const set = new Set();

    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (!exts.has(ext)) continue;
      const base = path.basename(f, ext);
      set.add(normalizeCode(base));
    }

    return (code) => set.has(code);
  }

  // 3) Nothing found -> assume no images
  return () => false;
}

const hasImageByCode = loadHasImageLookup();

// --- Load raw products ---
if (!fs.existsSync(RAW_PATH)) {
  console.error(`❌ Not found: ${RAW_PATH}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf-8"));
if (!Array.isArray(raw)) {
  console.error("❌ products_raw.json must be an array");
  process.exit(1);
}

// --- Sort keys per product ---
function buildKey(row) {
  const code = normalizeCode(row["Mã Cây"]);

  const rent = toNum(row["Giá Thuê (triệu)"]);
  const sale = toNum(row["Giá Bán (triệu)"]);

  const cao = toNum(row["Cao_m"]);
  const ngang = toNum(row["Ngang_m"]);
  const hoanh = toNum(row["Hoành_cm"]);
  const chau = toNum(row["Chậu_m"]);

  const hasImg = hasImageByCode(code);

  const hasRent = rent !== null;
  const hasSale = sale !== null;

  const hasBothPrices = hasRent && hasSale;
  const hasAnyPrice = hasRent || hasSale;

  const hasAllSpecs =
    cao !== null && ngang !== null && hoanh !== null && chau !== null;

  return {
    code,
    hasImg,
    hasBothPrices,
    hasAnyPrice,
    hasAllSpecs,
    saleValue: sale ?? 0,
    hoanhValue: hoanh ?? 0,
  };
}

// Stable sort with original index as final tie-break
const enriched = raw.map((row, idx) => {
  const k = buildKey(row);
  return { row, idx, k };
});

enriched.sort((A, B) => {
  // 1) has image (true first)
  if (A.k.hasImg !== B.k.hasImg) return Number(B.k.hasImg) - Number(A.k.hasImg);

  // 2) has both prices
  if (A.k.hasBothPrices !== B.k.hasBothPrices)
    return Number(B.k.hasBothPrices) - Number(A.k.hasBothPrices);

  // 3) has any price
  if (A.k.hasAnyPrice !== B.k.hasAnyPrice)
    return Number(B.k.hasAnyPrice) - Number(A.k.hasAnyPrice);

  // 4) has all specs
  if (A.k.hasAllSpecs !== B.k.hasAllSpecs)
    return Number(B.k.hasAllSpecs) - Number(A.k.hasAllSpecs);

  // 5) sale price desc
  if (A.k.saleValue !== B.k.saleValue) return B.k.saleValue - A.k.saleValue;

  // 6) hoanh desc
  if (A.k.hoanhValue !== B.k.hoanhValue)
    return B.k.hoanhValue - A.k.hoanhValue;

  // 7) stable: keep original order
  return A.idx - B.idx;
});

const sorted = enriched.map((x) => x.row);

// --- Write back ---
fs.writeFileSync(RAW_PATH, JSON.stringify(sorted, null, 2), "utf-8");

// --- Print summary ---
const withImg = enriched.filter((x) => x.k.hasImg).length;
const bothPrices = enriched.filter((x) => x.k.hasBothPrices).length;
const anyPrice = enriched.filter((x) => x.k.hasAnyPrice).length;
const allSpecs = enriched.filter((x) => x.k.hasAllSpecs).length;

console.log(
  `✅ Sorted products_raw.json
- total: ${sorted.length}
- with image: ${withImg}
- has both prices: ${bothPrices}
- has any price: ${anyPrice}
- has all specs: ${allSpecs}
`
);
