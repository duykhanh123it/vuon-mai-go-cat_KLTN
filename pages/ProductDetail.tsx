// src/pages/ProductDetail.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Product, Page } from "../types";

interface ProductDetailProps {
  product: Product;
  products: Product[]; // ✅ danh sách đã revalidate từ App
  setCurrentPage: (page: Page) => void;
  setSelectedProduct: (p: Product) => void;
}

const FALLBACK_IMG = "/notimg.jpg";

// ===== Read products từ localStorage cache (đồng bộ với ProductList.tsx) =====
type ProductsType = "All" | "BS" | "T";
const PRODUCTS_CACHE_KEY = (type: ProductsType) => `vmgc_products_cache_v1_${type}`;

const readCachedProducts = (type: ProductsType): Product[] => {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY(type));
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // ✅ hỗ trợ cả {items:[...]} và legacy [...]
    const items = Array.isArray(parsed?.items)
      ? (parsed.items as Product[])
      : Array.isArray(parsed)
        ? (parsed as Product[])
        : [];

    return items;
  } catch {
    return [];
  }
};

const readAllCachedProducts = (): Product[] => {
  // Ưu tiên cache All (đã merge), nếu chưa có thì merge BS + T
  const all = readCachedProducts("All");
  if (all.length) return all;

  const bs = readCachedProducts("BS");
  const t = readCachedProducts("T");
  const merged = [...bs, ...t];

  // unique theo id
  const seen = new Set<string>();
  const uniq: Product[] = [];
  for (const p of merged) {
    const id = String(p?.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(p);
  }
  return uniq;
};

// VND -> triệu (để tính diff giá đúng, tránh diff VND làm điểm bị nát)
const vndToMillion = (v: any): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 1_000_000;
};

const formatVND = (v: number | null) => {
  if (v === null) return "Liên hệ";
  return `${v.toLocaleString("vi-VN")}đ`;
};

const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  products,
  setCurrentPage,
  setSelectedProduct,
}) => {
  const [activeTab, setActiveTab] = useState<"specs" | "care">("specs");
  const [mainImage, setMainImage] = useState<string>(product.image || FALLBACK_IMG);

  const PHONE = "0922727277";
  const ZALO_LINK = "https://zalo.me/84922727277";

  // ✅ Bottom-sheet chọn Gọi / Zalo (mobile & tablet)
  const [contactOpen, setContactOpen] = useState(false);

  // ✅ Mobile / Tablet cảm ứng
  const isTouch =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  // ✅ trạng thái (đã có trong Product type)
  const isSold = !!product.isSold;
  const isRented = !!product.isRented;

  // ưu tiên SOLD nếu data bẩn (có cả 2)
  const locked = isSold || isRented;
  const statusText = isSold ? "ĐÃ BÁN" : isRented ? "ĐÃ CHO THUÊ" : "";

  // ===== Lightbox (xem ảnh full) =====
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const prevOverflowRef = useRef<string>("");

  // Swipe-to-close (mobile)
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const touchLastRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);
  const swipeIgnoreRef = useRef(false);

  // Zoom state cho viewer
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOrigin, setViewerOrigin] = useState({ x: 50, y: 50 }); // %
  const viewerImgRef = useRef<HTMLImageElement | null>(null);

  const [viewerTranslate, setViewerTranslate] = useState({ x: 0, y: 0 });

  const dragRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const touchPanRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const openViewer = (src: string) => {
    setViewerSrc(src || FALLBACK_IMG);
    setViewerScale(1);
    setViewerOrigin({ x: 50, y: 50 });
    setViewerTranslate({ x: 0, y: 0 });
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerSrc(null);
    setViewerScale(1);
    setViewerOrigin({ x: 50, y: 50 });
    setViewerTranslate({ x: 0, y: 0 });
  };

  // ESC để đóng + khóa scroll nền khi mở viewer
  useEffect(() => {
    if (!viewerOpen) return;

    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflowRef.current || "";
    };
  }, [viewerOpen]);

  // khóa scroll nền khi mở bottom-sheet contact
  useEffect(() => {
    if (!contactOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [contactOpen]);

  // ===== Helpers (related + specs) =====
  const toNum = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;

    const s = String(v).replace(",", "."); // 1,55 -> 1.55
    const m = s.match(/[\d.]+/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  };

  const normId = (v: any) =>
    String(v ?? "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9]/g, "");

  // cố lấy mã kiểu BSxxx hoặc Txxx trong chuỗi, để tránh "Mai BS 811" / "BS 811"
  const extractCode = (v: any) => {
    const s = String(v ?? "").toUpperCase();
    const m = s.match(/\b(BS|T)\s*[-_ ]*\s*\d+\b/);
    return m ? normId(m[0]) : normId(s);
  };

  const isRealImage = (img: any) => {
    const s = String(img ?? "").trim();
    if (!s) return false;
    const low = s.toLowerCase();
    if (low.includes("notimg")) return false;
    if (low.endsWith("/notimg.jpg")) return false;
    if (s === FALLBACK_IMG) return false;
    return true;
  };

  const getHoanhCm = (p: any) => {
    const raw = p?.hoanh_cm ?? p?.hoanhCm ?? null;
    const n = toNum(raw);
    if (n != null) return n;

    const d = String(p?.description ?? "");
    const m = d.match(/hoành\s*~?\s*([\d.,]+)/i);
    return m ? toNum(m[1]) : null;
  };

  const getChauM = (p: any) => {
    const raw = p?.chau_m ?? p?.chauM ?? null;
    const n = toNum(raw);
    if (n != null) return n;

    const d = String(p?.description ?? "");
    const m = d.match(/chậu\s*~?\s*([\d.,]+)/i);
    return m ? toNum(m[1]) : null;
  };

  const has4Specs = (p: any) =>
    toNum(p?.height) != null &&
    toNum(p?.width) != null &&
    getHoanhCm(p) != null &&
    getChauM(p) != null;

  // deterministic seed utils
  const hashString = (str: string) => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  };

  const mulberry32 = (a: number) => () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ===== Related products (Bạn cũng có thể thích) =====
  const RELATED_HISTORY_KEY = (pid: any) => `vmgc_related_history_v1:${extractCode(pid)}`;

  const relatedProducts = useMemo(() => {
    const currentId = String(product.id || "").trim();
    const currentNorm = normId(currentId);

    // ✅ Ưu tiên danh sách từ App (đã revalidate). Nếu rỗng thì fallback cache
    const all = Array.isArray(products) && products.length ? products : readAllCachedProducts();

    const targetRentM = vndToMillion(product.rentPrice);
    const targetSellM = vndToMillion(product.price);

    // lịch sử đã gợi ý cho riêng sản phẩm này
    let seen = new Set<string>();
    try {
      const raw = localStorage.getItem(RELATED_HISTORY_KEY(product.id));
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      seen = new Set((arr || []).map((x) => String(x)));
    } catch { }

    const candidates = all.filter((p: any) => {
      const id = String(p?.id ?? "").trim();
      if (!id) return false;

      // ✅ bỏ cây hiện tại (so sánh theo chuẩn hoá để tránh "BS 505" vs "BS505")
      if (normId(id) === currentNorm) return false;

      // ✅ loại cây đã bán/đã thuê
      if (p?.isSold) return false;
      if (p?.isRented) return false;

      return true;
    });

    const scoreOf = (p: any) => {
      let score = 0;

      // --- gần giá là chính (tính theo TRIỆU) ---
      const prM = vndToMillion(p.rentPrice);
      const psM = vndToMillion(p.price);

      if (targetRentM != null && prM != null) {
        const diff = Math.abs(prM - targetRentM); // triệu
        score += Math.max(0, 120 - diff * 8);
      } else if (targetSellM != null && psM != null) {
        const diff = Math.abs(psM - targetSellM); // triệu
        score += Math.max(0, 90 - diff * 4);
      } else {
        score -= 40;
      }

      // --- ưu tiên ảnh thật ---
      if (isRealImage(p.image)) score += 60;
      else score -= 60;

      // --- ưu tiên đủ 4 thông số ---
      if (has4Specs(p)) score += 45;
      else score -= 20;

      // --- hạn chế lặp ---
      const id = String(p?.id ?? "").trim();
      if (id && seen.has(id)) score -= 80;

      return score;
    };

    const ranked = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a));

    // pool top để vừa chất lượng vừa có vẻ "random"
    const pool = ranked.slice(0, 40);

    // seed đổi theo "lịch sử đã xem" để mỗi lần vào lại bớt trùng
    const rotation = seen.size;
    const seed = (hashString(String(product.id))() + rotation * 99991) >>> 0;
    const rnd = mulberry32(seed);

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const picked = pool.slice(0, 4);

    // lưu history
    try {
      const nextSeen = [...seen];
      for (const p of picked) {
        const id = String(p?.id ?? "").trim();
        if (id && !seen.has(id)) nextSeen.push(id);
      }
      const trimmed = nextSeen.slice(-80);
      localStorage.setItem(RELATED_HISTORY_KEY(product.id), JSON.stringify(trimmed));
    } catch { }

    return picked;
  }, [products, product.id, product.rentPrice, product.price]);

  // Khi đổi product (bấm Related Products) → reset ảnh chính
  useEffect(() => {
    setMainImage(product.image || FALLBACK_IMG);
    setActiveTab("specs");
  }, [product.id, product.image]);

  const allImages = useMemo(() => {
    const arr = [product.image, ...(product.thumbnails || [])]
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);

    // unique giữ thứ tự
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (const x of arr) {
      if (!seen.has(x)) {
        seen.add(x);
        uniq.push(x);
      }
    }
    return uniq.length > 0 ? uniq : [FALLBACK_IMG];
  }, [product.image, product.thumbnails]);

  const onImgError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.src.endsWith(FALLBACK_IMG)) return;
    img.src = FALLBACK_IMG;
  };

  // ✅ Điều hướng sang cây khác từ "Bạn cũng có thể thích" (chống lệch id + chống race hash)
  const goToProduct = (raw: any) => {
    const pid = normId(raw?.id);

    const all = Array.isArray(products) && products.length ? products : readAllCachedProducts();
    const found = all.find((x: any) => normId(x?.id) === pid);
    const next = (found ?? raw) as Product;

    const params = new URLSearchParams((window.location.hash.split("?")[1] || "").trim());
    const p = Math.max(1, Math.trunc(Number(params.get("p") || "1") || 1));

    // ✅ 1) set selected trước
    setSelectedProduct(next);

    // ✅ 2) set hash ngay (URL là nguồn chân lý của App)
    window.location.hash = `#/san-pham/${encodeURIComponent(normId(next.id))}?p=${p}`;

    // ✅ 3) đảm bảo đang ở detail
    setCurrentPage("product-detail");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="bg-slate-50 pb-20">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-2 text-sm text-slate-400 select-none">
          <button
            onClick={() => setCurrentPage("home")}
            className="cursor-pointer hover:text-amber-500 transition-colors"
          >
            Trang chủ
          </button>

          <span className="cursor-default">/</span>

          <button
            onClick={() => setCurrentPage("products")}
            className="cursor-pointer hover:text-amber-500 transition-colors"
          >
            Sản phẩm
          </button>

          <span className="cursor-default">/</span>

          <span className="text-slate-900 font-medium truncate cursor-default">{product.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-white rounded-3xl p-6 md:p-12 shadow-sm">
          {/* LEFT: Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md bg-slate-100">
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-cover cursor-zoom-in select-none"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMG;
                  setMainImage(FALLBACK_IMG);
                }}
                onClick={(e) => openViewer(e.currentTarget.currentSrc)}
                draggable={false}
              />

              {/* ✅ Overlay trạng thái */}
              {locked && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-extrabold tracking-wide">
                      {statusText}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnails (chỉ hiện khi có >= 2 ảnh khác nhau) */}
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {allImages.slice(0, 8).map((src, idx) => {
                  const imgSrc = src || FALLBACK_IMG;
                  const isActive = imgSrc === mainImage;

                  return (
                    <button
                      key={`${imgSrc}-${idx}`}
                      type="button"
                      onClick={() => setMainImage(imgSrc)}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${isActive
                        ? "border-amber-500 shadow-md"
                        : "border-transparent hover:border-slate-300"
                        }`}
                    >
                      <img
                        src={imgSrc}
                        onError={onImgError}
                        className="w-full h-full object-cover"
                        alt={`thumb-${idx}`}
                        draggable={false}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="mb-8">
              <p className="text-xs text-slate-400 mb-2 uppercase tracking-widest">
                Mã sản phẩm: {product.id}
              </p>

              <h1 className="text-4xl font-bold font-serif text-slate-900 mb-4">{product.name}</h1>

              <div className="inline-block bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase mb-6">
                {product.category}
              </div>

              <p className="text-slate-600 leading-relaxed mb-8">{product.description}</p>

              <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Giá cho thuê (5 - 10 ngày)</p>
                    <p className="text-3xl font-bold text-amber-500">{formatVND(product.rentPrice)}</p>
                    {locked && product.rentPrice != null && (
                      <p className="text-[10px] text-slate-500 mt-1 italic">
                        (Giá tham khảo – {statusText.toLowerCase()})
                      </p>
                    )}
                    {product.rentPrice === null && (
                      <p className="text-[10px] text-amber-600 mt-1 italic">
                        ✨ Liên hệ để nhận báo giá chi tiết và ưu đãi đặc biệt
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-slate-400 mb-1">Giá bán sở hữu</p>
                  <p className="text-xl font-bold text-slate-700">{formatVND(product.price)}</p>
                  {locked && product.price != null && (
                    <p className="text-[10px] text-slate-500 mt-1 italic">
                      (Giá tham khảo – {statusText.toLowerCase()})
                    </p>
                  )}
                  {product.price === null && (
                    <p className="text-[10px] text-amber-600 mt-1 italic">
                      ✨ Liên hệ để nhận báo giá chi tiết và ưu đãi đặc biệt
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              <button
                onClick={() => setCurrentPage("contact")}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-[0.98]
    ${locked
                    ? "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-200"
                    : "bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-amber-100"
                  }`}
                type="button"
              >
                {locked ? `${statusText} – Liên hệ tư vấn cây khác` : "Liên Hệ Xem Cây"}
              </button>

              {locked && (
                <p className="text-xs text-slate-500 -mt-2">
                  Cây này hiện không còn khả dụng. Nhà vườn sẽ gợi ý cây tương tự theo ngân sách của bạn.
                </p>
              )}

              {isTouch ? (
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="w-full border-2 border-amber-400 text-amber-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  Gọi Tư Vấn: 0922 727 277
                </button>
              ) : (
                <a
                  href={ZALO_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full border-2 border-amber-400 text-amber-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-50 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  Gọi Tư Vấn Zalo: 0922 727 277
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                  🚚
                </div>
                <div>
                  <p className="font-bold">Vận Chuyển An Toàn</p>
                  <p className="text-xs text-slate-400">Đội ngũ chuyên nghiệp</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                  🎧
                </div>
                <div>
                  <p className="font-bold">Hỗ Trợ 24/7</p>
                  <p className="text-xs text-slate-400">Tư vấn tận tâm</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 mt-14">
        <div className="bg-white rounded-3xl p-6 md:p-12 shadow-sm">
          <div className="flex gap-4 mb-10">
            <button
              onClick={() => setActiveTab("specs")}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === "specs"
                ? "bg-amber-500 text-amber-950 shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              type="button"
            >
              Thông Số
            </button>

            <button
              onClick={() => setActiveTab("care")}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === "care"
                ? "bg-amber-500 text-amber-950 shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              type="button"
            >
              Hướng Dẫn Chăm Sóc
            </button>
          </div>

          {activeTab === "specs" ? (
            <div className="max-w-3xl">
              <div className="space-y-3 text-slate-700">
                <div className="flex justify-between py-3 border-b border-slate-50">
                  <span className="text-slate-500">Chiều cao</span>
                  <span className="font-medium">{product.height ?? "---"}</span>
                </div>

                <div className="flex justify-between py-3 border-b border-slate-50">
                  <span className="text-slate-500">Tán / ngang</span>
                  <span className="font-medium">{product.width ?? "---"}</span>
                </div>

                <div className="flex justify-between py-3 border-b border-slate-50">
                  <span className="text-slate-500">Số cánh hoa</span>
                  <span className="font-medium">8 - 15 cánh</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl text-slate-600 leading-relaxed">
              <div>
                <p className="font-bold text-amber-700 flex items-center gap-2 mb-2">💧 Tưới Nước</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Tưới 1 lần/ngày vào buổi trưa.</li>
                  <li>Tưới đều vào bầu đất trong chậu, không tưới trực tiếp lên hoa.</li>
                  <li>Tưới đúng cách giúp hoa nở tươi lâu, hạn chế rụng hoa.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-red-700 flex items-center gap-2 mb-2">⚠️ Lưu ý quan trọng</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Không tưới nước nóng, nước đá.</li>
                  <li>
                    Không tưới bia, rượu hoặc các loại hóa chất khác vì sẽ ảnh hưởng xấu đến cây mai.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      <div className="container mx-auto px-4 mt-20">
        <div className="bg-white rounded-3xl p-6 md:p-12 shadow-sm">
          <h2 className="text-3xl font-bold font-serif mb-12">Bạn Cũng Có Thể Thích</h2>

          <div className="px-2 sm:px-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p: any) => {
                const h = toNum(p.height);
                const w = toNum(p.width);
                const hoanh = getHoanhCm(p);
                const chau = getChauM(p);

                return (
                  <div
                    key={String(p.id)}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToProduct(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToProduct(p);
                      }
                    }}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <img
                      src={p.image || FALLBACK_IMG}
                      onError={onImgError}
                      alt={p.name}
                      className="aspect-[4/3] object-cover bg-slate-100 w-full"
                      draggable={false}
                    />

                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-bold text-sm text-slate-800 mb-3 line-clamp-1">
                        {p.name}
                      </h3>

                      {/* ✅ Ẩn giá - thay bằng 4 thông số */}
                      <div className="mt-auto flex items-end justify-between gap-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 w-full">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">Cao</span>
                            <span className="font-semibold">{h != null ? `${h}m` : "---"}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">Tán</span>
                            <span className="font-semibold">{w != null ? `${w}m` : "---"}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">Hoành</span>
                            <span className="font-semibold">
                              {hoanh != null ? `${hoanh}cm` : "---"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">Chậu</span>
                            <span className="font-semibold">{chau != null ? `${chau}m` : "---"}</span>
                          </div>
                        </div>

                        <span className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-4 py-2 rounded-lg text-xs font-bold transition-all select-none shrink-0">
                          Chi Tiết
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Bottom-sheet chọn Gọi / Zalo (chỉ mobile/tablet) ===== */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-end lg:hidden"
          onClick={() => setContactOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

            <div className="text-center font-bold text-slate-800 mb-3">Liên hệ ngay</div>

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

      {/* ===== Lightbox overlay ===== */}
      {viewerOpen && viewerSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          style={{ touchAction: "none" }}
          onClick={closeViewer}
          onTouchStart={(e) => {
            if (e.touches.length >= 2) {
              swipeIgnoreRef.current = true;
              return;
            }

            const touch = e.touches[0];
            if (!touch) return;

            const EDGE = 24;
            const w = window.innerWidth || 0;
            swipeIgnoreRef.current = touch.clientX <= EDGE || touch.clientX >= w - EDGE;

            touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
            touchLastRef.current = { x: touch.clientX, y: touch.clientY };
            touchMovedRef.current = false;
          }}
          onTouchMove={(e) => {
            if (e.touches.length >= 2) return;

            if (!touchStartRef.current || swipeIgnoreRef.current) return;
            const touch = e.touches[0];
            if (!touch) return;

            touchLastRef.current = { x: touch.clientX, y: touch.clientY };

            const dx = touch.clientX - touchStartRef.current.x;
            const dy = touch.clientY - touchStartRef.current.y;

            if (Math.abs(dx) > 10) touchMovedRef.current = true;

            if (Math.abs(dx) > Math.abs(dy) * 1.2) {
              e.preventDefault();
            }
          }}
          onTouchEnd={() => {
            const start = touchStartRef.current;
            const last = touchLastRef.current;

            touchStartRef.current = null;
            touchLastRef.current = null;

            const ignored = swipeIgnoreRef.current;
            swipeIgnoreRef.current = false;

            if (!start || !last) return;
            if (ignored) return;
            if (!touchMovedRef.current) return;
            if (viewerScale > 1) return;

            const dx = last.x - start.x;
            const dy = last.y - start.y;
            const dt = Date.now() - start.t;

            const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
            const farEnough = Math.abs(dx) >= 70;
            const fastEnough = dt <= 600;

            if (isHorizontal && farEnough && fastEnough) {
              closeViewer();
            }
          }}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 hover:bg-white/20 text-white w-11 h-11 flex items-center justify-center text-2xl"
            onClick={(e) => {
              e.stopPropagation();
              closeViewer();
            }}
            aria-label="Đóng"
          >
            ×
          </button>

          <div
            className="max-h-[90vh] max-w-[95vw] overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ touchAction: "pinch-zoom" }}
            onWheel={(e) => {
              e.preventDefault();
              const img = viewerImgRef.current;
              if (!img) return;

              const rect = img.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * 100;
              const py = ((e.clientY - rect.top) / rect.height) * 100;

              const ox = Math.max(0, Math.min(100, px));
              const oy = Math.max(0, Math.min(100, py));
              setViewerOrigin({ x: ox, y: oy });

              const direction = e.deltaY < 0 ? 1 : -1;
              const step = 0.18;

              setViewerScale((prev) => {
                const next = Math.max(1, Math.min(4, Number((prev + direction * step).toFixed(3))));
                if (next === 1) setViewerTranslate({ x: 0, y: 0 });
                return next;
              });
            }}
            onTouchStart={(e) => {
              if (e.touches.length >= 2) return;
              if (viewerScale <= 1) return;

              e.stopPropagation();
              const t = e.touches[0];
              if (!t) return;

              touchPanRef.current = {
                active: true,
                startX: t.clientX,
                startY: t.clientY,
                baseX: viewerTranslate.x,
                baseY: viewerTranslate.y,
              };
            }}
            onTouchMove={(e) => {
              if (e.touches.length >= 2) return;

              const p = touchPanRef.current;
              if (!p?.active) return;

              e.preventDefault();
              e.stopPropagation();

              const t = e.touches[0];
              if (!t) return;

              const dx = t.clientX - p.startX;
              const dy = t.clientY - p.startY;

              setViewerTranslate({ x: p.baseX + dx, y: p.baseY + dy });
            }}
            onTouchEnd={(e) => {
              const p = touchPanRef.current;
              if (!p) return;
              if (e.touches.length > 0) return;
              touchPanRef.current = { ...p, active: false };
            }}
            onMouseDown={(e) => {
              if (viewerScale <= 1) return;
              e.preventDefault();
              dragRef.current = {
                dragging: true,
                startX: e.clientX,
                startY: e.clientY,
                baseX: viewerTranslate.x,
                baseY: viewerTranslate.y,
              };
            }}
            onMouseMove={(e) => {
              const d = dragRef.current;
              if (!d?.dragging) return;
              e.preventDefault();
              const dx = e.clientX - d.startX;
              const dy = e.clientY - d.startY;
              setViewerTranslate({ x: d.baseX + dx, y: d.baseY + dy });
            }}
            onMouseUp={() => {
              const d = dragRef.current;
              if (!d) return;
              dragRef.current = { ...d, dragging: false };
            }}
            onMouseLeave={() => {
              const d = dragRef.current;
              if (!d) return;
              dragRef.current = { ...d, dragging: false };
            }}
          >
            <img
              ref={viewerImgRef}
              src={viewerSrc}
              alt="Ảnh sản phẩm"
              className="block max-h-[90vh] max-w-[95vw] object-contain select-none"
              style={{
                transformOrigin: `${viewerOrigin.x}% ${viewerOrigin.y}%`,
                transform: `translate(${viewerTranslate.x}px, ${viewerTranslate.y}px) scale(${viewerScale})`,
                transition: "transform 80ms linear",
                cursor: viewerScale > 1 ? "grab" : "zoom-in",
              }}
              onDoubleClick={() => {
                setViewerScale(1);
                setViewerOrigin({ x: 50, y: 50 });
                setViewerTranslate({ x: 0, y: 0 });
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
