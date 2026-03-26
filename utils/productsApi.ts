// src/utils/productsApi.ts
// utils/productsApi.ts (FRONTEND)

import type { Product } from "../types";

export type ProductsType = "All" | "BS" | "T";

export type ProductsApiItem = {
  id?: string;
  maCay?: string;

  giaThue?: number | string | null;
  giaBan?: number | string | null;

  // ✅ giá nội bộ để lọc
  giaThueFilter?: number | string | null;
  giaBanFilter?: number | string | null;

  cao_m?: number | string | null;
  ngang_m?: number | string | null;
  hoanh_cm?: number | string | null;
  chau_m?: number | string | null;

  note?: string | null;

  imageId?: string | null;
  imageUrl?: string | null;

  daThue?: boolean;
  daBan?: boolean;
};

type ProductsApiResponse = {
  ok: boolean;
  total?: number;
  items?: ProductsApiItem[];

  imgVersion?: string;
  dataVersion?: string;

  error?: string;
};

export type ProductsBundle = {
  items: ProductsApiItem[];
  imgVersion: string;
  dataVersion: string;
  total?: number; // ✅ NEW: để UI hiển thị mẫu số đúng
};

export type ProductsMeta = {
  imgVersion: string;
  dataVersion: string;
};

type FetchBundleArg = ProductsType | { type?: ProductsType };

function getApiBase(): string {
  const base = import.meta.env.VITE_PRODUCTS_API_BASE;
  if (!base) throw new Error("Missing VITE_PRODUCTS_API_BASE in .env");
  return String(base).replace(/\/+$/, "");
}

function normalizeType(type?: ProductsType): ProductsType {
  if (type === "BS" || type === "T") return type;
  return "All";
}

function normalizeArg(arg?: FetchBundleArg): ProductsType {
  if (typeof arg === "string") return normalizeType(arg);
  return normalizeType(arg?.type);
}

function buildProductsUrl(type?: ProductsType): string {
  const t = normalizeType(type);
  const qs = new URLSearchParams({ api: "products", type: t });
  return `${getApiBase()}?${qs.toString()}`;
}

function buildMetaUrl(): string {
  return `${getApiBase()}?api=meta`;
}

/** =========================
 * Helpers: normalize number / money
 * ========================= */
const parseNum = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const s = String(v).trim();
  if (!s) return null;

  // hỗ trợ "1,55" / "1.55" / " 1.55m "...
  const cleaned = s.replace(",", ".").match(/-?[\d.]+/);
  if (!cleaned?.[0]) return null;

  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? n : null;
};

const parseMoney = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const s = String(v).trim();
  if (!s) return null;

  // nhận "5.4", "5,4", "5.400.000", "5400000đ"...
  const normalized = s
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "") // bỏ dấu ngăn cách hàng nghìn kiểu VN
    .replace(",", "."); // 5,4 -> 5.4

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

/** =========================
 * Mapper chuẩn: API item -> Product (UI)
 * Mục tiêu: ProductList/ProductDetail/App dùng CHUNG, tránh lệch shape.
 * ========================= */
export function mapApiItemToProduct(it: ProductsApiItem): Product {
  const id = String(it.id ?? it.maCay ?? "").trim();

  const rentPrice = parseMoney(it.giaThue);
  const price = parseMoney(it.giaBan);

  // Filter ưu tiên giá nội bộ, nếu không có thì fallback giá công khai
  const rentPriceFilter = parseMoney(it.giaThueFilter) ?? rentPrice;
  const priceFilter = parseMoney(it.giaBanFilter) ?? price;

  const height = parseNum(it.cao_m);
  const width = parseNum(it.ngang_m);
  const hoanh_cm = parseNum(it.hoanh_cm);
  const chau_m = parseNum(it.chau_m);

  const isSold = !!it.daBan;
  const isRented = !!it.daThue;

  // category: dựa theo prefix id (BS/T) nếu có
  const upper = id.toUpperCase();
  const category =
    upper.startsWith("BS") ? "Mai Bonsai" : upper.startsWith("T") ? "Mai Tàng" : "Mai";

  // name: ưu tiên id (mã cây) để đồng nhất điều hướng
  const name = id || "Sản phẩm";

  // description/note
  const description = String(it.note ?? "").trim();

  // image
  const image = it.imageUrl ? String(it.imageUrl) : "";

  // @ts-expect-error: types.ts có thể chưa khai báo đủ các field filter/specs chi tiết
  const p: Product = {
    id,
    name,
    category,
    description,
    image: image || "/notimg.jpg",
    thumbnails: [],

    rentPrice: rentPrice ?? null,
    price: price ?? null,

    // thêm các field phụ để UI/filter dùng nếu đã support
    rentPriceFilter: rentPriceFilter ?? null,
    priceFilter: priceFilter ?? null,

    height: height ?? null,
    width: width ?? null,

    // giữ thêm specs gốc nếu bạn cần
    hoanh_cm: hoanh_cm ?? null,
    chau_m: chau_m ?? null,

    isSold,
    isRented,
  };

  return p;
}

export function mapBundleItemsToProducts(bundle: ProductsBundle): Product[] {
  const arr = Array.isArray(bundle.items) ? bundle.items : [];
  // unique theo id để tránh trùng khi merge/fallback
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const it of arr) {
    const p = mapApiItemToProduct(it);
    const id = String(p.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

/** =========================
 * RAM cache theo type (mất khi F5)
 * ========================= */
const _bundleCacheByType: Partial<Record<ProductsType, ProductsBundle>> = {};
const _inflightByType: Partial<Record<ProductsType, Promise<ProductsBundle>>> = {};

async function fetchProductsBundleRaw(type?: ProductsType): Promise<ProductsBundle> {
  const t = normalizeType(type);
  const res = await fetch(buildProductsUrl(t), { cache: "no-store" });
  if (!res.ok) throw new Error(`Products API HTTP ${res.status}`);

  const data = (await res.json()) as ProductsApiResponse;
  if (!data.ok) throw new Error(data.error || "Products API returned ok=false");

  const items = Array.isArray(data.items) ? data.items : [];
  const total = typeof data.total === "number" ? data.total : items.length;

  return {
    items,
    total,
    imgVersion: String(data.imgVersion || "0"),
    dataVersion: String(data.dataVersion || "0"),
  };
}

/**
 * Dùng cho UI: có cache RAM theo type
 * ✅ hỗ trợ cả 2 kiểu call:
 * - fetchProductsBundle("BS")
 * - fetchProductsBundle({ type: "BS" })
 */
export async function fetchProductsBundle(arg?: FetchBundleArg): Promise<ProductsBundle> {
  const t = normalizeArg(arg);

  if (_bundleCacheByType[t]) return _bundleCacheByType[t]!;
  if (_inflightByType[t]) return _inflightByType[t]!;

  _inflightByType[t] = fetchProductsBundleRaw(t)
    .then((bundle) => {
      _bundleCacheByType[t] = bundle;
      return bundle;
    })
    .finally(() => {
      delete _inflightByType[t];
    });

  return _inflightByType[t]!;
}

/** ✅ NEW: fetch bundle nhưng trả Product[] đã map chuẩn */
export async function fetchProductsBundleMapped(
  arg?: FetchBundleArg
): Promise<{ products: Product[]; meta: ProductsMeta; total?: number }> {
  const bundle = await fetchProductsBundle(arg);
  return {
    products: mapBundleItemsToProducts(bundle),
    meta: { imgVersion: bundle.imgVersion, dataVersion: bundle.dataVersion },
    total: bundle.total,
  };
}

/** Giữ API cũ (nếu code đang gọi) => mặc định All */
export async function fetchProductsFromSheet(): Promise<ProductsApiItem[]> {
  const bundle = await fetchProductsBundle("All");
  return bundle.items;
}

/** Prefetch theo type */
export function prefetchProductsFromSheet(type?: ProductsType): void {
  const t = normalizeType(type);
  if (_bundleCacheByType[t] || _inflightByType[t]) return;
  void fetchProductsBundle(t);
}

export function clearProductsCache(type?: ProductsType): void {
  if (type) {
    const t = normalizeType(type);
    delete _bundleCacheByType[t];
    delete _inflightByType[t];
    return;
  }

  (Object.keys(_bundleCacheByType) as ProductsType[]).forEach((k) => delete _bundleCacheByType[k]);
  (Object.keys(_inflightByType) as ProductsType[]).forEach((k) => delete _inflightByType[k]);
}

/** Meta nhẹ: chỉ lấy version (global) */
export async function fetchProductsMeta(): Promise<ProductsMeta> {
  const res = await fetch(buildMetaUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Products META HTTP ${res.status}`);

  const data = (await res.json()) as {
    ok: boolean;
    imgVersion?: string;
    dataVersion?: string;
    error?: string;
  };

  if (!data.ok) throw new Error(data.error || "Products meta ok=false");

  return {
    imgVersion: String(data.imgVersion || "0"),
    dataVersion: String(data.dataVersion || "0"),
  };
}

/**
 * Revalidate theo meta:
 * - nếu dataVersion không đổi => trả cache RAM
 * - nếu đổi => refetch bundle
 */
export async function fetchProductsBundleRevalidate(arg?: FetchBundleArg): Promise<ProductsBundle> {
  const t = normalizeArg(arg);
  const meta = await fetchProductsMeta();

  const cached = _bundleCacheByType[t];
  if (cached && cached.dataVersion === meta.dataVersion) return cached;

  clearProductsCache(t);
  return await fetchProductsBundle(t);
}

/** ✅ NEW: Revalidate nhưng trả Product[] đã map */
export async function fetchProductsBundleRevalidateMapped(
  arg?: FetchBundleArg
): Promise<{ products: Product[]; meta: ProductsMeta; total?: number }> {
  const bundle = await fetchProductsBundleRevalidate(arg);
  return {
    products: mapBundleItemsToProducts(bundle),
    meta: { imgVersion: bundle.imgVersion, dataVersion: bundle.dataVersion },
    total: bundle.total,
  };
}
