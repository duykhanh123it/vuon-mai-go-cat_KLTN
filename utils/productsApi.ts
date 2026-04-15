// src/utils/productsApi.ts
import type { Product, Booking, AuthUser } from "../types";
import { normalizeAuthUser } from "../types";

export type ProductsType = "All" | "BS" | "T";

export type ProductsApiItem = {
  id?: string;
  maCay?: string;
  giaThue?: number | string | null;
  giaBan?: number | string | null;
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
  total?: number;
};

export type ProductsMeta = {
  imgVersion: string;
  dataVersion: string;
};

export type AdminMeta = {
  products: ProductsMeta;
  bookings: {
    dataVersion: string;
  };
  users: {
    dataVersion: string;
  };
  now: number;
};

export type AdminProductsCache = {
  products: Product[];
  meta: ProductsMeta;
  total?: number;
  fetchedAt: number;
};

export type AdminListCache<T> = {
  data: T[];
  version: string;
  fetchedAt: number;
};

type FetchBundleArg = ProductsType | { type?: ProductsType };

const ADMIN_CACHE_PREFIX = "vmgc_admin_cache_v2";

const _adminProductsCacheByType: Partial<Record<ProductsType, AdminProductsCache>> = {};
let _adminBookingsCache: AdminListCache<Booking> | null = null;
let _adminUsersCache: AdminListCache<AuthUser> | null = null;

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

function buildAdminMetaUrl(): string {
  return `${getApiBase()}?api=adminMeta`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeReadJson<T>(key: string): T | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy mode errors
  }
}

function safeRemove(key: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

function productsCacheKey(type: ProductsType): string {
  return `${ADMIN_CACHE_PREFIX}:products:${type}`;
}

function bookingsCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:bookings`;
}

function usersCacheKey(): string {
  return `${ADMIN_CACHE_PREFIX}:users`;
}

const parseNum = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/[^\d.,-]/g, "");
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const millionToVnd = (v: any): number | null => {
  const n = parseNum(v);
  if (n == null || n <= 0) return null;
  return Math.round(n * 1_000_000);
};

const normalizeProductId = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();

const buildProductDescription = (it: ProductsApiItem) => {
  const parts: string[] = [];
  if (parseNum(it.cao_m) != null) parts.push(`Cao ~ ${parseNum(it.cao_m)}m`);
  if (parseNum(it.ngang_m) != null) parts.push(`Tán ~ ${parseNum(it.ngang_m)}m`);
  if (parseNum(it.hoanh_cm) != null) parts.push(`Hoành ${parseNum(it.hoanh_cm)}cm`);
  if (parseNum(it.chau_m) != null) parts.push(`Chậu ~ ${parseNum(it.chau_m)}m`);

  const specs = parts.length ? parts.join(" · ") : "";
  const note = String(it.note ?? "").trim();

  if (specs && note) return `${specs}. ${note}`;
  if (specs) return `${specs}.`;
  return note;
};

export function mapApiItemToProduct(
  it: ProductsApiItem,
  options?: { imgVersion?: string },
): Product {
  const id = normalizeProductId(it.id ?? it.maCay ?? "");
  const upper = id.toUpperCase();
  const category = upper.startsWith("BS")
    ? "Mai Bonsai"
    : upper.startsWith("T")
      ? "Mai Tàng"
      : "Khác";

  const rawImage = String(it.imageUrl || "").trim();
  const imgVersion = String(options?.imgVersion || "").trim();
  const image = rawImage
    ? `${rawImage}${rawImage.includes("?") ? "&" : "?"}v=${encodeURIComponent(
        imgVersion || "0",
      )}`
    : "/notimg.jpg";

  return {
    id,
    name: id || "Sản phẩm",
    category,
    description: buildProductDescription(it),
    image,
    thumbnails: image ? [image] : [],
    rentPrice: millionToVnd(it.giaThue),
    price: millionToVnd(it.giaBan),
    __filterRentPrice: millionToVnd(it.giaThueFilter),
    __filterSellPrice: millionToVnd(it.giaBanFilter),
    height: parseNum(it.cao_m),
    width: parseNum(it.ngang_m),
    age: null,
    hoanh_cm: parseNum(it.hoanh_cm),
    chau_m: parseNum(it.chau_m),
    isSold: !!it.daBan,
    isRented: !!it.daThue,
  };
}

export function mapBundleItemsToProducts(bundle: ProductsBundle): Product[] {
  const arr = Array.isArray(bundle.items) ? bundle.items : [];
  const seen = new Set<string>();
  const out: Product[] = [];

  for (const it of arr) {
    const p = mapApiItemToProduct(it, { imgVersion: bundle.imgVersion });
    const id = String(p.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }

  return out;
}

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

export async function fetchProductsBundle(
  arg?: FetchBundleArg,
): Promise<ProductsBundle> {
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

export async function fetchProductsBundleMapped(
  arg?: FetchBundleArg,
): Promise<{ products: Product[]; meta: ProductsMeta; total?: number }> {
  const bundle = await fetchProductsBundle(arg);
  return {
    products: mapBundleItemsToProducts(bundle),
    meta: { imgVersion: bundle.imgVersion, dataVersion: bundle.dataVersion },
    total: bundle.total,
  };
}

export async function fetchProductsFromSheet(): Promise<ProductsApiItem[]> {
  const bundle = await fetchProductsBundle("All");
  return bundle.items;
}

export function prefetchProductsFromSheet(type?: ProductsType): void {
  const t = normalizeType(type);
  if (_bundleCacheByType[t] || _inflightByType[t]) return;
  void fetchProductsBundle(t);
}

function readAdminProductsCache(type: ProductsType): AdminProductsCache | null {
  const inMemory = _adminProductsCacheByType[type];
  if (inMemory) return inMemory;

  const fromStorage = safeReadJson<AdminProductsCache>(productsCacheKey(type));
  if (!fromStorage) return null;

  _adminProductsCacheByType[type] = fromStorage;
  return fromStorage;
}

function writeAdminProductsCache(type: ProductsType, value: AdminProductsCache): void {
  _adminProductsCacheByType[type] = value;
  safeWriteJson(productsCacheKey(type), value);
}

export function getCachedAdminProducts(arg?: FetchBundleArg): AdminProductsCache | null {
  const t = normalizeArg(arg);
  return readAdminProductsCache(t);
}

export function setCachedAdminProducts(
  arg: FetchBundleArg | undefined,
  value: {
    products: Product[];
    meta: ProductsMeta;
    total?: number;
    fetchedAt?: number;
  },
): AdminProductsCache {
  const t = normalizeArg(arg);
  const payload: AdminProductsCache = {
    products: Array.isArray(value.products) ? value.products : [],
    meta: {
      imgVersion: String(value.meta?.imgVersion || "0"),
      dataVersion: String(value.meta?.dataVersion || "0"),
    },
    total: value.total,
    fetchedAt: typeof value.fetchedAt === "number" ? value.fetchedAt : Date.now(),
  };

  writeAdminProductsCache(t, payload);
  return payload;
}

function clearAdminProductsPersisted(type?: ProductsType): void {
  if (type) {
    delete _adminProductsCacheByType[type];
    safeRemove(productsCacheKey(type));
    return;
  }

  (["All", "BS", "T"] as ProductsType[]).forEach((key) => {
    delete _adminProductsCacheByType[key];
    safeRemove(productsCacheKey(key));
  });
}

export function clearProductsCache(type?: ProductsType): void {
  if (type) {
    const t = normalizeType(type);
    delete _bundleCacheByType[t];
    delete _inflightByType[t];
    clearAdminProductsPersisted(t);
    return;
  }

  (Object.keys(_bundleCacheByType) as ProductsType[]).forEach(
    (k) => delete _bundleCacheByType[k],
  );
  (Object.keys(_inflightByType) as ProductsType[]).forEach(
    (k) => delete _inflightByType[k],
  );
  clearAdminProductsPersisted();
}

function readAdminBookingsCache(): AdminListCache<Booking> | null {
  if (_adminBookingsCache) return _adminBookingsCache;

  const fromStorage = safeReadJson<AdminListCache<Booking>>(bookingsCacheKey());
  if (!fromStorage) return null;

  _adminBookingsCache = fromStorage;
  return fromStorage;
}

function writeAdminBookingsCache(value: AdminListCache<Booking>): void {
  _adminBookingsCache = value;
  safeWriteJson(bookingsCacheKey(), value);
}

export function getCachedAdminBookings(): AdminListCache<Booking> | null {
  return readAdminBookingsCache();
}

export function setCachedAdminBookings(
  data: Booking[],
  version?: string,
  fetchedAt?: number,
): AdminListCache<Booking> {
  const payload: AdminListCache<Booking> = {
    data: Array.isArray(data) ? data : [],
    version: String(version || Date.now()),
    fetchedAt: typeof fetchedAt === "number" ? fetchedAt : Date.now(),
  };

  writeAdminBookingsCache(payload);
  return payload;
}

export function clearAdminBookingsCache(): void {
  _adminBookingsCache = null;
  safeRemove(bookingsCacheKey());
}

function readAdminUsersCache(): AdminListCache<AuthUser> | null {
  if (_adminUsersCache) return _adminUsersCache;

  const fromStorage = safeReadJson<AdminListCache<AuthUser>>(usersCacheKey());
  if (!fromStorage) return null;

  _adminUsersCache = {
    ...fromStorage,
    data: Array.isArray(fromStorage.data)
      ? fromStorage.data.map((user) => normalizeAuthUser(user))
      : [],
  };
  return _adminUsersCache;
}

function writeAdminUsersCache(value: AdminListCache<AuthUser>): void {
  _adminUsersCache = value;
  safeWriteJson(usersCacheKey(), value);
}

export function getCachedAdminUsers(): AdminListCache<AuthUser> | null {
  return readAdminUsersCache();
}

export function setCachedAdminUsers(
  data: AuthUser[],
  version?: string,
  fetchedAt?: number,
): AdminListCache<AuthUser> {
  const payload: AdminListCache<AuthUser> = {
    data: Array.isArray(data) ? data.map((user) => normalizeAuthUser(user)) : [],
    version: String(version || Date.now()),
    fetchedAt: typeof fetchedAt === "number" ? fetchedAt : Date.now(),
  };

  writeAdminUsersCache(payload);
  return payload;
}

export function clearAdminUsersCache(): void {
  _adminUsersCache = null;
  safeRemove(usersCacheKey());
}

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

export async function fetchAdminMeta(): Promise<AdminMeta> {
  const res = await fetch(buildAdminMetaUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Admin META HTTP ${res.status}`);

  const data = (await res.json()) as {
    ok: boolean;
    versions?: {
      products?: { imgVersion?: string; dataVersion?: string };
      bookings?: { dataVersion?: string };
      users?: { dataVersion?: string };
    };
    now?: number;
    error?: string;
  };

  if (!data.ok) throw new Error(data.error || "Admin meta ok=false");

  return {
    products: {
      imgVersion: String(data.versions?.products?.imgVersion || "0"),
      dataVersion: String(data.versions?.products?.dataVersion || "0"),
    },
    bookings: {
      dataVersion: String(data.versions?.bookings?.dataVersion || "0"),
    },
    users: {
      dataVersion: String(data.versions?.users?.dataVersion || "0"),
    },
    now: typeof data.now === "number" ? data.now : Date.now(),
  };
}

export async function fetchProductsBundleRevalidate(
  arg?: FetchBundleArg,
): Promise<ProductsBundle> {
  const t = normalizeArg(arg);
  const meta = await fetchProductsMeta();
  const cached = _bundleCacheByType[t];
  if (
    cached &&
    cached.dataVersion === meta.dataVersion &&
    cached.imgVersion === meta.imgVersion
  ) {
    return cached;
  }
  clearProductsCache(t);
  return fetchProductsBundle(t);
}

export async function fetchProductsBundleRevalidateMapped(
  arg?: FetchBundleArg,
): Promise<{ products: Product[]; meta: ProductsMeta; total?: number }> {
  const bundle = await fetchProductsBundleRevalidate(arg);
  return {
    products: mapBundleItemsToProducts(bundle),
    meta: { imgVersion: bundle.imgVersion, dataVersion: bundle.dataVersion },
    total: bundle.total,
  };
}

export async function syncAdminProducts(
  arg?: FetchBundleArg,
  options?: {
    force?: boolean;
    knownMeta?: ProductsMeta;
  },
): Promise<AdminProductsCache> {
  const t = normalizeArg(arg);
  const cached = readAdminProductsCache(t);
  const knownMeta = options?.knownMeta;

  if (
    !options?.force &&
    cached &&
    knownMeta &&
    cached.meta.dataVersion === String(knownMeta.dataVersion || "0") &&
    cached.meta.imgVersion === String(knownMeta.imgVersion || "0")
  ) {
    return cached;
  }

  if (!options?.force && cached && !knownMeta) {
    return cached;
  }

  delete _bundleCacheByType[t];
  delete _inflightByType[t];

  const bundle = await fetchProductsBundleRaw(t);
  const payload: AdminProductsCache = {
    products: mapBundleItemsToProducts(bundle),
    meta: {
      imgVersion: bundle.imgVersion,
      dataVersion: bundle.dataVersion,
    },
    total: bundle.total,
    fetchedAt: Date.now(),
  };

  _bundleCacheByType[t] = bundle;
  writeAdminProductsCache(t, payload);
  return payload;
}

async function postAPI<T = any>(body: any): Promise<T> {
  const res = await fetch(getApiBase(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || `Products API HTTP ${res.status}`);
  }

  if (!data?.ok) {
    throw new Error(data?.error || "Products API returned ok=false");
  }

  return data as T;
}

export async function createProduct(data: any): Promise<{
  ok: boolean;
  message?: string;
}> {
  return postAPI({ api: "createProduct", ...data });
}

export async function updateProduct(data: any): Promise<{
  ok: boolean;
  message?: string;
}> {
  return postAPI({ api: "updateProduct", ...data });
}

export async function deleteProduct(
  id: string,
  category: string,
): Promise<{ ok: boolean; message?: string }> {
  return postAPI({ api: "deleteProduct", id, category });
}

// ================= BOOKING API =================
export async function fetchBookings(): Promise<Booking[]> {
  try {
    const res = await fetch(`${getApiBase()}?api=bookings`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error("Không lấy được danh sách lịch");
    }
    return data.data || [];
  } catch (err) {
    console.error("fetchBookings error:", err);
    return [];
  }
}

export async function syncAdminBookings(options?: {
  force?: boolean;
  knownVersion?: string;
}): Promise<AdminListCache<Booking>> {
  const cached = readAdminBookingsCache();
  const knownVersion = String(options?.knownVersion || "").trim();

  if (
    !options?.force &&
    cached &&
    knownVersion &&
    cached.version === knownVersion
  ) {
    return cached;
  }

  if (!options?.force && cached && !knownVersion) {
    return cached;
  }

  const data = await fetchBookings();
  return setCachedAdminBookings(data, knownVersion || String(Date.now()));
}

export async function updateBookingStatus(
  maDatLich: string,
  trangThai: Booking["trangThai"],
  ghiChu?: string,
): Promise<boolean> {
  try {
    const res = await fetch(getApiBase(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        api: "updateBookingStatus",
        maDatLich,
        trangThai,
        lyDoHuy: ghiChu,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("updateBookingStatus error:", err);
    return false;
  }
}

export async function updateBookingNote(
  maDatLich: string,
  ghiChu: string,
): Promise<boolean> {
  try {
    const res = await fetch(getApiBase(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        api: "updateBookingNote",
        maDatLich,
        ghiChu,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("updateBookingNote error:", err);
    return false;
  }
}

// ================= USER API =================
export async function fetchUsers(): Promise<AuthUser[]> {
  try {
    const res = await fetch(getApiBase(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        api: "getUsers",
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error("Không lấy được danh sách user");
    }

    const users = Array.isArray(data.users) ? data.users : [];
    return users.map((user: any) => normalizeAuthUser(user));
  } catch (err) {
    console.error("fetchUsers error:", err);
    return [];
  }
}

export async function syncAdminUsers(options?: {
  force?: boolean;
  knownVersion?: string;
}): Promise<AdminListCache<AuthUser>> {
  const cached = readAdminUsersCache();
  const knownVersion = String(options?.knownVersion || "").trim();

  if (
    !options?.force &&
    cached &&
    knownVersion &&
    cached.version === knownVersion
  ) {
    return cached;
  }

  if (!options?.force && cached && !knownVersion) {
    return cached;
  }

  const data = await fetchUsers();
  return setCachedAdminUsers(data, knownVersion || String(Date.now()));
}

export async function verifyAdminPassword(
  email: string,
  password: string,
): Promise<boolean> {
  try {
    const res = await fetch(getApiBase(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        api: "verifyAdminPassword",
        email,
        password,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error("verifyAdminPassword error:", err);
    return false;
  }
}

export async function updateUserPermissions(params: {
  adminEmail: string;
  adminPassword: string;
  targetEmail: string;
  role: "user" | "admin";
  permissions: string[];
}): Promise<boolean> {
  try {
    const res = await fetch(getApiBase(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        api: "updateUserPermissions",
        ...params,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error("updateUserPermissions error:", err);
    return false;
  }
}
