// src/pages/ProductList.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Product } from "../types";
import {
  fetchProductsBundle,
  fetchProductsBundleRevalidateMapped,
  fetchProductsMeta,
  fetchProductsBundleRevalidate,
} from "../utils/productsApi";
import type { ProductsType } from "../utils/productsApi";

/**
 * Cache key tách theo type để không đè nhau:
 * - vmgc_products_cache_v1_All
 * - vmgc_products_cache_v1_BS
 * - vmgc_products_cache_v1_T
 */
const PRODUCTS_CACHE_KEY = (type: ProductsType) =>
  `vmgc_products_cache_v1_${type}`;

/**
 * =========================
 * Helpers
 * =========================
 */
// parse tiền an toàn (đầu vào có thể là number/string/null)
// - Hỗ trợ "32,4" "32.4" "350" "1.200.000"...
const parseMoney = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  // giữ số, dấu . , -
  const cleaned = s.replace(/[^\d.,-]/g, "");
  // case:
  // - "1.200.000" => remove dots thousand => "1200000"
  // - "32,4" => "32,4" => replace "," => "."
  // - "32.4" => keep
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".") // "1.234,5" => "1234.5"
      : cleaned.replace(/\./g, "").replace(",", "."); // "32,4" => "32.4" ; "350" => "350"
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

// parse chiều cao "2.5m" / "2,5m" / "1m8" / "2m30"
const parseHeightMeters = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  const mMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*m$/i);
  if (mMatch) {
    const n = Number(mMatch[1].replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const compactMatch = s.match(/^(\d+)\s*m\s*(\d+)?$/i);
  if (compactMatch) {
    const whole = Number(compactMatch[1]);
    const tail = compactMatch[2];
    if (!Number.isFinite(whole)) return null;
    if (!tail) return whole;
    if (tail.length === 1) return whole + Number(tail) / 10;
    if (tail.length === 2) return whole + Number(tail) / 100;
    return whole + Number(tail) / 100;
  }
  const any = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!any) return null;
  const n = Number(any[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Sheet đang nhập theo "triệu" (vd 32,4 và 350)
const millionToVnd = (million: any): number | null => {
  const n = parseMoney(million);
  if (n == null) return null;
  if (n <= 0) return null;
  return Math.round(n * 1_000_000);
};

const formatVnd = (vnd: number | null) => {
  if (vnd == null) return "";
  const m = vnd / 1_000_000;
  const s = Number.isInteger(m) ? String(m) : String(m).replace(".", ",");
  return `${s} triệu`;
};

const formatVndParts = (vnd: number | null) => {
  if (vnd == null) return { amount: "", unit: "triệu" };
  const m = vnd / 1_000_000;
  const amount = Number.isInteger(m) ? String(m) : String(m).replace(".", ",");
  return { amount, unit: "triệu" };
};

type PriceKey =
  | "All"
  | "contact"
  | "le20"
  | "20to50"
  | "50to100"
  | "100to180"
  | "180to300"
  | "300to500"
  | "over500";

type HeightKey = "All" | "under1_5" | "1_5to2" | "2to2_5" | "over2_5";

const PRICE_OPTIONS: Array<{ key: PriceKey; label: string }> = [
  { key: "All", label: "Tất cả" },
  { key: "le20", label: "≤ 20 triệu" },
  { key: "20to50", label: "20 – 50 triệu" },
  { key: "50to100", label: "50 – 100 triệu" },
  { key: "100to180", label: "100 – 180 triệu" },
  { key: "180to300", label: "180 – 300 triệu" },
  { key: "300to500", label: "300 – 500 triệu" },
  { key: "over500", label: "Trên 500 triệu" },
];

const matchesPrice = (priceVnd: number | null, key: PriceKey) => {
  if (key === "All") return true;
  if (key === "contact") return priceVnd == null;
  if (priceVnd == null) return false;
  const m = priceVnd / 1_000_000;
  switch (key) {
    case "le20":
      return m <= 20;
    case "20to50":
      return m > 20 && m <= 50;
    case "50to100":
      return m > 50 && m <= 100;
    case "100to180":
      return m > 100 && m <= 180;
    case "180to300":
      return m > 180 && m <= 300;
    case "300to500":
      return m > 300 && m <= 500;
    case "over500":
      return m > 500;
    default:
      return true;
  }
};

const matchesHeight = (heightMeters: number | null, key: HeightKey) => {
  if (key === "All") return true;
  if (heightMeters == null) return false;
  switch (key) {
    case "under1_5":
      return heightMeters < 1.5;
    case "1_5to2":
      return heightMeters >= 1.5 && heightMeters < 2;
    case "2to2_5":
      return heightMeters >= 2 && heightMeters < 2.5;
    case "over2_5":
      return heightMeters >= 2.5;
    default:
      return true;
  }
};

const FALLBACK_IMG = "/notimg.jpg";

const onImgError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  const img = e.currentTarget;
  if (img.src.endsWith(FALLBACK_IMG)) return;
  img.src = FALLBACK_IMG;
};

const getImageSrc = (p: any) => {
  const raw = String(p?.image ?? "").trim();
  return raw || FALLBACK_IMG;
};

const splitSpecsFromDescription = (desc?: string) => {
  const s = String(desc || "").trim();
  if (!s) return { specs: null as string | null, desc: null as string | null };
  // chỉ tách tại ". " để không cắt nhầm số thập phân
  const sep = ". ";
  const idx = s.indexOf(sep);
  const first = idx >= 0 ? s.slice(0, idx).trim() : s;
  const looksLikeSpecs =
    first.includes("·") || /Cao\s*~|Tán\s*~|Hoành\s*\d+/i.test(first);
  if (!looksLikeSpecs) return { specs: null, desc: s };
  const rest = idx >= 0 ? s.slice(idx + sep.length).trim() : "";
  return { specs: first || null, desc: rest || null };
};

// ✅ Quyết định nút trên card dựa theo GIÁ HIỂN THỊ (GiaThue/GiaBan)
// - Nếu cả 2 trống => nút "Liên hệ"
// - Nếu có 1 trong 2 => nút "Chi tiết"
const hasPublicPrice = (p: any) => {
  const rent = parseMoney(p?.rentPrice);
  const sell = parseMoney(p?.price);
  return (rent != null && rent > 0) || (sell != null && sell > 0);
};

// ✅ Status tag (Thuê/Bán/Thuê+Bán) dựa theo GIÁ NỘI BỘ (để lọc)
const getInternalStatus = (p: any) => {
  const rent = parseMoney(p?.__filterRentPrice);
  const sell = parseMoney(p?.__filterSellPrice);
  const hasRent = rent != null && rent > 0;
  const hasSell = sell != null && sell > 0;
  if (hasRent && hasSell)
    return { label: "Thuê + Bán", cls: "bg-emerald-600 text-white" };
  if (hasRent) return { label: "Thuê Tết", cls: "bg-amber-400 text-amber-950" };
  if (hasSell) return { label: "Bán", cls: "bg-blue-600 text-white" };
  return { label: "Liên hệ", cls: "bg-slate-400 text-white" };
};

/**
 * Hành vi liên hệ:
 * - Desktop: mở Zalo
 * - Mobile/Tablet: mở sheet chọn Call/Zalo
 */
const PHONE = "0922727277";
const ZALO_LINK = `https://zalo.me/${PHONE}`;

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(hover: none) && (pointer: coarse)").matches;

type ProductCardProps = {
  p: any;
  onOpenDetail: (p: any) => void;
  onContact: () => void;
};

const ProductCard: React.FC<ProductCardProps> = ({
  p,
  onOpenDetail,
  onContact,
}) => {
  const isSold = !!p?.isSold;
  const isRented = !!p?.isRented;
  const soldOrRentedLabel = isSold ? "ĐÃ BÁN" : isRented ? "ĐÃ CHO THUÊ" : "";
  const dimmed = isSold || isRented;
  const internalStatus = getInternalStatus(p);

  const handleOpenDetail = () => onOpenDetail(p);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpenDetail();
    }
  };

  const publicRent = parseMoney(p?.rentPrice);
  const publicSell = parseMoney(p?.price);
  const rentParts = formatVndParts(publicRent);
  const sellParts = formatVndParts(publicSell);
  const hasPriceToShow =
    (publicRent != null && publicRent > 0) ||
    (publicSell != null && publicSell > 0);

  const specs = [
    { label: "Cao", value: (p as any)?.height || "—" },
    { label: "Tán", value: (p as any)?.width || "—" },
    { label: "Hoành", value: (p as any)?.hoanh || "—" },
    { label: "Chậu", value: (p as any)?.chau || "—" },
  ];

  const showDetailButton = hasPublicPrice(p);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenDetail}
      onKeyDown={onKeyDown}
      aria-label={`Xem chi tiết ${p?.name ?? "sản phẩm"}`}
      className={`
        group flex h-full cursor-pointer flex-col overflow-hidden rounded-[24px]
        border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]
        transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300
        ${dimmed ? "opacity-60" : ""}
      `}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={getImageSrc(p)}
          onError={onImgError}
          alt={p.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          draggable={false}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {internalStatus.label !== "Liên hệ" && (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold shadow-sm ${internalStatus.cls}`}
            >
              {internalStatus.label}
            </span>
          )}
        </div>

        <div className="absolute right-4 top-4">
          <span className="rounded-full bg-[#3B5A2A]/95 px-3 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm">
            {p.category || "Khác"}
          </span>
        </div>

        {soldOrRentedLabel && (
          <div className="absolute inset-x-4 bottom-4">
            <span className="inline-flex rounded-full bg-black/75 px-3 py-1 text-xs font-extrabold tracking-wide text-white backdrop-blur-sm">
              {soldOrRentedLabel}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Mã cây
          </p>
          <h3 className="line-clamp-1 text-[24px] font-extrabold leading-none tracking-tight text-slate-800">
            {p.name}
          </h3>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {specs.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2"
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="text-xs font-semibold text-slate-700 break-words leading-4">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3">
          {hasPriceToShow ? (
            <div className="grid grid-cols-2 gap-2.5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="min-w-0 min-h-[88px] rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-slate-200 flex flex-col justify-between">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Thuê Tết
                </p>

                {publicRent != null && publicRent > 0 ? (
                  <>
                    <p className="text-[15px] font-extrabold leading-5 text-slate-800 md:hidden">
                      {rentParts.amount}
                      <span className="block">triệu</span>
                    </p>
                    <p className="hidden text-base font-extrabold leading-5 text-slate-800 md:block">
                      {formatVnd(publicRent)}
                    </p>
                  </>
                ) : (
                  <p className="text-[15px] font-extrabold leading-5 text-slate-800">
                    Liên hệ
                  </p>
                )}
              </div>

              <div className="min-w-0 min-h-[88px] rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-slate-200 flex flex-col justify-between">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Bán
                </p>

                {publicSell != null && publicSell > 0 ? (
                  <>
                    <p className="text-[15px] font-extrabold leading-5 text-slate-800 md:hidden">
                      {sellParts.amount}
                      <span className="block">triệu</span>
                    </p>
                    <p className="hidden text-base font-extrabold leading-5 text-slate-800 md:block">
                      {formatVnd(publicSell)}
                    </p>
                  </>
                ) : (
                  <p className="text-[15px] font-extrabold leading-5 text-slate-800">
                    Liên hệ
                  </p>
                )}
              </div>

              {showDetailButton ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(p);
                  }}
                  className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 transition-all hover:bg-amber-500 2xl:col-span-1 2xl:self-end"
                >
                  <span>Xem chi tiết</span>
                  <span aria-hidden>→</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onContact();
                  }}
                  className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-700 2xl:col-span-1 2xl:self-end"
                >
                  <span>Liên hệ</span>
                  <span aria-hidden>→</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 2xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 min-h-[88px] rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-slate-200 flex flex-col justify-between">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Giá tham khảo
                </p>
                <p className="text-[15px] font-extrabold leading-5 text-red-600">
                  Liên hệ báo giá
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onContact();
                }}
                className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-700 2xl:self-end"
              >
                <span>Liên hệ</span>
                <span aria-hidden>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProductCardSkeleton = () => (
  <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
    <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
      <div className="absolute inset-0 animate-pulse bg-slate-200" />
      <div className="absolute left-4 top-4 h-7 w-24 rounded-full bg-white/60 animate-pulse" />
      <div className="absolute right-4 top-4 h-7 w-24 rounded-full bg-white/50 animate-pulse" />
    </div>

    <div className="p-5">
      <div className="mb-4">
        <div className="h-3 w-16 rounded bg-slate-200 animate-pulse mb-2" />
        <div className="h-8 w-28 rounded bg-slate-200 animate-pulse" />
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2"
          >
            <div className="mb-1 h-2.5 w-8 rounded bg-slate-200 animate-pulse" />
            <div className="h-4 w-10 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-h-[88px] rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-slate-200">
            <div className="mb-2 h-2.5 w-12 rounded bg-slate-200 animate-pulse" />
            <div className="h-5 w-16 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="min-h-[88px] rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-slate-200">
            <div className="mb-2 h-2.5 w-8 rounded bg-slate-200 animate-pulse" />
            <div className="h-5 w-16 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="col-span-2 h-12 rounded-xl bg-amber-200/70 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

const ProductListSkeleton = () => (
  <div className="animate-in fade-in duration-300">
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-4 w-36 rounded bg-slate-200 animate-pulse mb-2" />
          <div className="h-3 w-56 rounded bg-slate-200 animate-pulse" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-sm text-amber-900 border border-amber-200 w-fit">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Đang tải sản phẩm...
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
      <aside className="hidden lg:block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 h-5 w-24 rounded bg-slate-200 animate-pulse" />
        <div className="space-y-6">
          <div>
            <div className="mb-3 h-4 w-20 rounded bg-slate-200 animate-pulse" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 h-4 w-20 rounded bg-slate-200 animate-pulse" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 h-4 w-20 rounded bg-slate-200 animate-pulse" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-10 rounded-xl bg-slate-100 animate-pulse ${i === 4 ? "col-span-2" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="h-12 flex-1 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const FilterIcon = ({ className = "" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 4h18" />
    <path d="M6 9h12" />
    <path d="M10 14h4" />
    <path d="M11 18h2" />
  </svg>
);

type CacheShape = {
  items: Product[];
  savedAt: number;
  imgVersion?: string;
  dataVersion?: string;
};

const safeReadCache = (type: ProductsType): CacheShape | null => {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY(type));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items)
      ? (parsed.items as Product[])
      : null;
    if (!items) return null;
    return {
      items,
      savedAt: Number(parsed?.savedAt || Date.now()),
      imgVersion: String(parsed?.imgVersion || ""),
      dataVersion: String(parsed?.dataVersion || ""),
    };
  } catch {
    return null;
  }
};

const saveCache = (
  type: ProductsType,
  mapped: Product[],
  imgVersion: string,
  dataVersion: string,
) => {
  try {
    localStorage.setItem(
      PRODUCTS_CACHE_KEY(type),
      JSON.stringify({
        items: mapped,
        savedAt: Date.now(),
        imgVersion,
        dataVersion,
      }),
    );
  } catch {
    // ignore quota
  }
};

interface ProductListProps {
  productsPage: number;
  setProductsPage: (n: number) => void;
  onOpenProduct: (product: Product, page: number) => void;
  // báo danh sách Product[] (đã map) lên App để App resolve detail khi F5/link trực tiếp
  onProductsUpdated?: (items: Product[]) => void;
}

const ProductList: React.FC<ProductListProps> = ({
  productsPage,
  setProductsPage,
  onOpenProduct,
  onProductsUpdated,
}) => {
  const [contactOpen, setContactOpen] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);

  const openContact = () => {
    if (isTouchDevice()) {
      setContactOpen(true);
      return;
    }
    window.open(ZALO_LINK, "_blank", "noopener,noreferrer");
  };

  // PER_PAGE theo màn hình
  const getPerPage = () => {
    const w = window.innerWidth;
    if (w < 640) return 6;
    if (w < 1024) return 8;
    return 9;
  };

  const [perPage, setPerPage] = useState<number>(getPerPage());
  useEffect(() => {
    const onResize = () => setPerPage(getPerPage());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * filterType UI:
   * - All / Mai Bonsai / Mai Tàng
   * => apiType (tận dụng 2 sheet):
   * - All / BS / T
   */
  const [filterType, setFilterType] = useState<string>("All");
  const apiType: ProductsType =
    filterType === "Mai Bonsai"
      ? "BS"
      : filterType === "Mai Tàng"
        ? "T"
        : "All";

  type PriceMode = "rent" | "sell"; // Thuê | Bán (mua)
  const [priceMode, setPriceMode] = useState<PriceMode>("rent");
  const [filterPrice, setFilterPrice] = useState<PriceKey>("All");
  const [filterHeight, setFilterHeight] = useState<HeightKey>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // tổng theo sheet để hiển thị mẫu số đúng (BS + T)
  const [totalsByType, setTotalsByType] = useState<{ BS: number; T: number }>({
    BS: 0,
    T: 0,
  });
  const totalAll = (totalsByType.BS || 0) + (totalsByType.T || 0);

  // init từ cache All để vào là có data ngay
  const [products, setProducts] = useState<Product[]>(
    () => safeReadCache("All")?.items ?? [],
  );

  const [loadingProducts, setLoadingProducts] = useState<boolean>(
    () => !(safeReadCache("All")?.items?.length > 0),
  );
  const [productsError, setProductsError] = useState("");
  const productsRef = useRef<Product[]>(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const [cacheVersions, setCacheVersions] = useState<{
    imgVersion: string;
    dataVersion: string;
  }>(() => {
    const c = safeReadCache("All");
    return {
      imgVersion: String(c?.imgVersion || ""),
      dataVersion: String(c?.dataVersion || ""),
    };
  });
  const cacheVersionsRef = useRef(cacheVersions);
  useEffect(() => {
    cacheVersionsRef.current = cacheVersions;
  }, [cacheVersions]);

  /**
   * Reload từ server theo type (tận dụng 2 sheet)
   * - All: fetch BS + T rồi merge
   * - BS/T: fetch main + fetch other để lấy total mẫu số
   */
  const reloadFromServer = async (
    aliveRef: () => boolean,
    type: ProductsType,
  ) => {
    const setTotals = (bsTotal: number, tTotal: number) =>
      setTotalsByType({ BS: bsTotal, T: tTotal });

    if (type === "All") {
      const [bs, t] = await Promise.all([
        fetchProductsBundleRevalidate({ type: "BS" }),
        fetchProductsBundleRevalidate({ type: "T" }),
      ]);
      if (!aliveRef()) return;

      const bsTotal = (bs as any).total ?? bs.items.length;
      const tTotal = (t as any).total ?? t.items.length;
      setTotals(bsTotal, tTotal);

      const imgVersion = String(bs.imgVersion || t.imgVersion || "");
      const dataVersion = String(bs.dataVersion || t.dataVersion || "");

      // === THAY ĐỔI THEO YÊU CẦU ===
      const resBS = await fetchProductsBundleRevalidateMapped({ type: "BS" });
      const resT = await fetchProductsBundleRevalidateMapped({ type: "T" });

      const mapped = [...(resBS.products || []), ...(resT.products || [])];

      setProducts(mapped);
      setCacheVersions({ imgVersion, dataVersion });
      onProductsUpdated?.(mapped);
      setProductsError("");
      saveCache("All", mapped, imgVersion, dataVersion);
      return;
    }

    // ===== BS hoặc T =====
    const main = await fetchProductsBundleRevalidate({ type });
    if (!aliveRef()) return;

    const otherType: ProductsType = type === "BS" ? "T" : "BS";
    const other = await fetchProductsBundle({ type: otherType }); // giữ để lấy total
    if (!aliveRef()) return;

    const mainTotal = (main as any).total ?? main.items.length;
    const otherTotal = (other as any).total ?? other.items.length;
    if (type === "BS") setTotals(mainTotal, otherTotal);
    else setTotals(otherTotal, mainTotal);

    const imgVersion = String(main.imgVersion || "");
    const dataVersion = String(main.dataVersion || "");

    // === THAY ĐỔI THEO YÊU CẦU ===
    const res = await fetchProductsBundleRevalidateMapped({ type });
    const mapped = res.products || [];

    setProducts(mapped);
    setCacheVersions({ imgVersion, dataVersion });
    onProductsUpdated?.(mapped);
    setProductsError("");
    saveCache(type, mapped, imgVersion, dataVersion);
  };

  /**
   * Khi đổi "Sản phẩm" => ưu tiên cache type đó render ngay, sau đó fetch server
   */
  useEffect(() => {
    let alive = true;
    const aliveRef = () => alive;

    (async () => {
      setLoadingProducts(true);
      try {
        const c = safeReadCache(apiType);
        if (c?.items?.length) {
          setProducts(c.items);
          setCacheVersions({
            imgVersion: String(c.imgVersion || ""),
            dataVersion: String(c.dataVersion || ""),
          });
          onProductsUpdated?.(c.items);
        }
        await reloadFromServer(aliveRef, apiType);
      } catch (err: any) {
        if (!alive) return;
        setProductsError(err?.message || "Không tải được sản phẩm");
      } finally {
        if (!alive) return;
        setLoadingProducts(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiType]);

  /**
   * Poll meta:
   * - nếu version đổi => reload theo apiType hiện tại
   */
  useEffect(() => {
    let alive = true;
    let timer: number | null = null;
    let busy = false;
    const getInterval = () =>
      document.visibilityState === "visible" ? 2000 : 20000;

    const scheduleNext = (ms?: number) => {
      if (!alive) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(run, ms ?? getInterval());
    };

    const run = async () => {
      if (!alive) return;
      if (busy) return scheduleNext();
      busy = true;
      try {
        const meta = await fetchProductsMeta();
        if (!alive) return;

        const next = {
          imgVersion: String(meta.imgVersion || ""),
          dataVersion: String(meta.dataVersion || ""),
        };
        const cur = cacheVersionsRef.current;
        const changed =
          next.imgVersion !== cur.imgVersion ||
          next.dataVersion !== cur.dataVersion;

        if (changed) {
          setLoadingProducts(true);
          try {
            // ✅ ÉP clear cache trước khi reload để tránh dính RAM cache
            import("../utils/productsApi").then(({ clearProductsCache }) => {
              clearProductsCache(apiType);
            });
            await reloadFromServer(() => alive, apiType);
          } finally {
            if (!alive) return;
            setLoadingProducts(false);
          }
        }
      } catch (err: any) {
        if (productsRef.current.length === 0) {
          setProductsError(err?.message || "Không tải được sản phẩm");
        }
      } finally {
        busy = false;
        scheduleNext();
      }
    };

    scheduleNext(500);
    const onVis = () => scheduleNext(200);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiType]);

  // Options (theo data của bạn: BS/T)
  const categoryOptions = ["All", "Mai Bonsai", "Mai Tàng"] as const;

  /**
   * FILTER:
   * - 1 khung giá (PriceKey)
   * - 2 nút chọn mode: Thuê / Bán
   * - Lọc dựa trên GIÁ NỘI BỘ: __filterRentPrice/__filterSellPrice
   */
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (products as Product[]).filter((p) => {
      const typeOk = filterType === "All" || String(p.category) === filterType;
      const searchOk =
        q === "" ||
        String(p.name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(p.id ?? "")
          .toLowerCase()
          .includes(q);

      const rentInternal = parseMoney((p as any).__filterRentPrice);
      const sellInternal = parseMoney((p as any).__filterSellPrice);
      const selected = priceMode === "rent" ? rentInternal : sellInternal;
      const priceOk = matchesPrice(selected, filterPrice);

      const h = parseHeightMeters((p as any).height);
      const heightOk = matchesHeight(h, filterHeight);

      return typeOk && searchOk && priceOk && heightOk;
    });
  }, [products, filterType, searchTerm, priceMode, filterPrice, filterHeight]);

  // ==================== PAGINATION - ĐÃ REPLACE ====================
  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const safePage = Math.min(
    Math.max(1, Math.trunc(productsPage || 1)),
    totalPages,
  );
  const [pageDraft, setPageDraft] = useState<string>(String(safePage));

  // Khi đổi filter/search → quay về trang 1
  useEffect(() => {
    setProductsPage(1);
    setPageDraft("1");
  }, [filterType, priceMode, filterPrice, filterHeight, searchTerm]);

  useEffect(() => {
    setPageDraft(String(safePage));
  }, [safePage]);

  useEffect(() => {
    if (!topRef.current) return;

    const HEADER_OFFSET = 96;

    const y =
      topRef.current.getBoundingClientRect().top +
      window.scrollY -
      HEADER_OFFSET;

    window.scrollTo({
      top: Math.max(0, y),
      behavior: "smooth",
    });
  }, [safePage]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      if ((e.key === "ArrowLeft" || e.key === "PageUp") && safePage > 1) {
        setProductsPage(safePage - 1);
      }

      if (
        (e.key === "ArrowRight" || e.key === "PageDown") &&
        safePage < totalPages
      ) {
        setProductsPage(safePage + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [safePage, totalPages]);

  const start = (safePage - 1) * perPage;
  const end = start + perPage;
  const pagedProducts = filteredProducts.slice(start, end);

  const resetFilters = () => {
    setFilterType("All");
    setPriceMode("rent");
    setFilterPrice("All");
    setFilterHeight("All");
    setSearchTerm("");
    setPageDraft("1");
    setProductsPage(1);
    setIsFilterOpen(false);
  };

  // mẫu số hiển thị: ưu tiên tổng BS+T
  const denominator = totalAll > 0 ? totalAll : products.length;

  return (
    <div className="bg-slate-50 min-h-screen pb-2">
      {/* Banner */}
      <section
        className="text-white py-16 relative overflow-hidden"
        style={{ background: "linear-gradient(to right, #2F5D3A, #D4A017)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)"/></svg>\')',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">
            Sản Phẩm Mai Tết
          </h1>
          <p className="text-white/90">
            Khám phá bộ sưu tập mai đa dạng, chất lượng cao
          </p>
        </div>
      </section>

      <div ref={topRef} className="container mx-auto px-4 mt-10">
        {/* Loading lần đầu: chỉ hiện skeleton */}
        {loadingProducts && products.length === 0 ? (
          <ProductListSkeleton />
        ) : (
          <>
            {productsError && (
              <div className="mb-6 text-center text-red-600 text-sm">
                Lỗi tải sản phẩm: {productsError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
              {/* Sidebar filters */}
              <aside className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 w-full">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((v) => !v)}
                  className="w-full lg:hidden flex items-center justify-between gap-3 font-bold py-2"
                >
                  <span className="flex items-center gap-2">
                    <FilterIcon className="text-amber-500" />
                    Bộ Lọc
                  </span>
                  <svg
                    className={`h-5 w-5 text-slate-600 transition-transform duration-200 ${
                      isFilterOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <h3 className="hidden lg:flex font-bold items-center gap-2 mb-5">
                  <FilterIcon className="text-amber-500" />
                  Bộ Lọc
                </h3>
                <div
                  className={`${isFilterOpen ? "block" : "hidden"} lg:block`}
                >
                  <div className="space-y-6">
                    {/* Sản phẩm */}
                    <div>
                      <label className="text-sm text-slate-500 block mb-3">
                        Sản Phẩm
                      </label>
                      <div className="flex flex-col gap-2">
                        {categoryOptions.map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              setFilterType(type);
                              setPriceMode("rent");
                              setFilterPrice("All");
                              setFilterHeight("All");
                              setSearchTerm("");
                              setIsFilterOpen(false);
                            }}
                            className={`text-left px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                              filterType === type
                                ? "bg-amber-400 text-amber-950"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                            }`}
                            type="button"
                          >
                            {type === "All" ? "Tất cả" : type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Khung Giá */}
                    <div>
                      <label className="text-sm text-slate-500 block mb-3">
                        Khung giá
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setPriceMode("rent")}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            priceMode === "rent"
                              ? "bg-amber-400 text-amber-950"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          Thuê
                        </button>
                        <button
                          type="button"
                          onClick={() => setPriceMode("sell")}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            priceMode === "sell"
                              ? "bg-amber-400 text-amber-950"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          Bán
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {PRICE_OPTIONS.map((item) => (
                          <button
                            key={item.key}
                            onClick={() => {
                              setFilterPrice(item.key);
                              setIsFilterOpen(false);
                            }}
                            className={`text-left px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                              filterPrice === item.key
                                ? "bg-amber-400 text-amber-950"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                            }`}
                            type="button"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Chiều cao */}
                    <div>
                      <label className="text-sm text-slate-500 block mb-3">
                        Chiều cao
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["All", "Tất cả"],
                            ["under1_5", "Dưới 1.5m"],
                            ["1_5to2", "1.5m - 2m"],
                            ["2to2_5", "2m - 2.5m"],
                            ["over2_5", "Trên 2.5m"],
                          ] as Array<[HeightKey, string]>
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => setFilterHeight(key)}
                            className={`
                              px-4 py-2 rounded-xl text-sm font-bold transition-all
                              ${key === "over2_5" ? "col-span-2" : ""}
                              ${
                                filterHeight === key
                                  ? "bg-amber-400 text-amber-950"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                              }
                            `}
                            type="button"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all select-none"
                      >
                        Reset bộ lọc
                      </button>
                    </div>
                  </div>
                </div>
              </aside>

              {/* Main content */}
              <div className="min-w-0">
                {/* Search + count */}
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="relative flex-1">
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm mã/tên sản phẩm..."
                      className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-amber-200 transition"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm whitespace-nowrap">
                    {filteredProducts.length}/{denominator} sản phẩm
                  </p>
                </div>

                {/* Grid Sản Phẩm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
                  {pagedProducts.map((p: any) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      onOpenDetail={(product) => {
                        onOpenProduct(product, safePage);
                        window.scrollTo(0, 0);
                      }}
                      onContact={openContact}
                    />
                  ))}
                </div>

                {/* Gợi ý tư vấn */}
                <div className="mt-12 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-slate-700 text-center md:text-left">
                    <p className="font-bold text-lg">
                      Bạn chưa tìm được cây phù hợp?
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      🌼 Nhà vườn còn nhiều cây chưa đăng đủ thông tin.
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      👉 Gọi ngay để được dẫn xem cây đúng ngân sách & không
                      gian của bạn.
                    </p>
                  </div>
                  <a
                    href={`tel:${PHONE}`}
                    className="
                      group relative overflow-hidden inline-flex items-center gap-2
                      bg-red-600 hover:bg-red-700 text-white
                      px-6 py-3 rounded-xl font-bold shadow-md
                      transition-transform duration-200 ease-out
                      hover:scale-[1.03] active:scale-[0.97]
                    "
                  >
                    <span className="inline-flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-110">
                      📞
                    </span>
                    <span>Gọi Ngay</span>
                    <span
                      aria-hidden
                      className="
                        pointer-events-none absolute inset-0
                        bg-gradient-to-r from-transparent via-white/35 to-transparent
                        translate-x-[-140%] group-hover:translate-x-[140%]
                        transition-transform duration-500 ease-out blur-[2px]
                      "
                    />
                  </a>
                </div>

                {/* Pagination - ĐÃ REPLACE */}
                {totalPages > 1 && (
                  <div className="mt-8 sm:mt-9 mb-6 flex items-center justify-center">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-white text-slate-800 rounded-full shadow-md px-3 py-1.5 sm:px-4 sm:py-2 border border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          setProductsPage(Math.max(1, safePage - 1))
                        }
                        disabled={safePage <= 1}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full grid place-items-center transition text-sm ${
                          safePage <= 1
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-slate-100"
                        }`}
                        aria-label="Trang trước"
                      >
                        ←
                      </button>

                      <div className="flex items-center gap-1.5 sm:gap-2 mx-2 sm:mx-3 whitespace-nowrap">
                        <span className="text-xs text-slate-600 hidden sm:inline">
                          Trang
                        </span>

                        <input
                          value={pageDraft}
                          onChange={(e) => {
                            setPageDraft(e.target.value.replace(/[^\d]/g, ""));
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;

                            if (pageDraft === "") {
                              setPageDraft(String(safePage));
                              return;
                            }

                            const n = Number(pageDraft);
                            if (!Number.isFinite(n)) {
                              setPageDraft(String(safePage));
                              return;
                            }

                            const nextPage = Math.min(
                              Math.max(1, Math.trunc(n)),
                              totalPages,
                            );

                            setProductsPage(nextPage);
                          }}
                          onBlur={() => {
                            if (pageDraft === "") {
                              setPageDraft(String(safePage));
                              return;
                            }

                            const n = Number(pageDraft);
                            if (!Number.isFinite(n)) {
                              setPageDraft(String(safePage));
                              return;
                            }

                            const nextPage = Math.min(
                              Math.max(1, Math.trunc(n)),
                              totalPages,
                            );

                            setProductsPage(nextPage);
                          }}
                          className="w-12 sm:w-14 text-center bg-slate-100 border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-amber-300 text-xs text-slate-800"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          type="text"
                        />

                        <span className="text-xs text-slate-600">
                          / {totalPages}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setProductsPage(Math.min(totalPages, safePage + 1))
                        }
                        disabled={safePage >= totalPages}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full grid place-items-center transition text-sm ${
                          safePage >= totalPages
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-slate-100"
                        }`}
                        aria-label="Trang sau"
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contact Action Sheet (mobile/tablet) */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-end md:hidden"
          onClick={() => setContactOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
            <div className="text-center font-bold text-slate-800 mb-3">
              Liên hệ ngay
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`tel:${PHONE}`}
                className="bg-red-600 hover:bg-red-700 text-white py-3 rounded-2xl font-bold text-center"
                onClick={() => setContactOpen(false)}
              >
                📞 Gọi
              </a>
              <a
                href={ZALO_LINK}
                target="_blank"
                rel="noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-2xl font-bold text-center"
                onClick={() => setContactOpen(false)}
              >
                💬 Zalo
              </a>
            </div>
            <button
              type="button"
              className="mt-3 w-full py-3 rounded-2xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              onClick={() => setContactOpen(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
