import React, { useCallback, useEffect, useRef, useState } from "react";
import { Page, Product, AuthUser } from "./types";
import { fetchProductsBundle } from "./utils/productsApi";
import { Navbar, Footer } from "./components/Layout";

import Home from "./pages/Home";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import Booking from "./pages/Booking";
import Contact from "./pages/Contact";
import LoginModal from "./components/LoginModal";

const FloatingCTAStyle = () => (
  <style>{`
@keyframes ctaBreathe {
  0%, 100% { transform: scale(1); }
  40% { transform: scale(1.1); }
  55% { transform: scale(1.07); }
}

/* Chỉ chạy trên mobile (thiết bị cảm ứng) */
@media (max-width: 768px) and (hover: none) and (pointer: coarse) {
  .cta-breathe {
    animation: ctaBreathe 2.6s ease-in-out infinite;
  }

  .cta-breathe-delay {
    animation: ctaBreathe 2.9s ease-in-out infinite;
    animation-delay: 0.6s;
  }
}

/* Tôn trọng Reduce Motion */
@media (prefers-reduced-motion: reduce) {
  .cta-breathe,
  .cta-breathe-delay {
    animation: none !important;
  }
}
  `}</style>
);

/**
 * =========================
 * Hash routing
 * - Home:        #/
 * - Sản phẩm:    #/san-pham?p=1
 * - Liên hệ:     #/lien-he
 * - Chi tiết:    #/san-pham/<id>?p=1
 * =========================
 */
const pageToHash = (
  page: Page,
  productId?: string | null,
  productsPage: number = 1,
) => {
  const p = Math.max(1, Math.trunc(productsPage || 1));

  switch (page) {
    case "home":
      return "#/";
    case "products":
      return `#/san-pham?p=${p}`;
    case "booking":
      return "#/dat-lich";
    case "contact":
      return "#/lien-he";
    case "product-detail":
      return productId
        ? `#/san-pham/${encodeURIComponent(normPid(productId))}?p=${p}`
        : `#/san-pham?p=${p}`;
    default:
      return "#/";
  }
};

// ✅ Normalize ID dùng cho routing/resolve (tránh lệch "BS 505" vs "BS505", ký tự lạ, hoa/thường)
// ✅ Normalize ID dùng cho routing/resolve (tránh lệch "BS 505" vs "BS505", ký tự lạ, hoa/thường)
function normPid(v: any) {
  return String(v ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

const hashToState = (
  hash: string,
): { page: Page; productId?: string; productsPage: number } => {
  const raw = (hash || "#/").trim();
  const h = raw.startsWith("#") ? raw.slice(1) : raw; // "/san-pham/BS02?p=20"

  const [pathPart, queryPart] = h.split("?");
  const parts = pathPart.split("/").filter(Boolean);

  const params = new URLSearchParams(queryPart || "");
  const p = Math.max(1, Math.trunc(Number(params.get("p") || "1") || 1));

  if (parts.length === 0) return { page: "home", productsPage: p };

  if (parts[0] === "san-pham") {
    if (parts[1])
      return {
        page: "product-detail",
        productId: decodeURIComponent(parts[1]),
        productsPage: p,
      };
    return { page: "products", productsPage: p };
  }

  if (parts[0] === "dat-lich") return { page: "booking", productsPage: p };
  if (parts[0] === "lien-he") return { page: "contact", productsPage: p };

  return { page: "home", productsPage: p };
};

// ===== Products cache reader (để App restore detail khi F5) =====
// ===== Products cache reader (đồng bộ với ProductList.tsx: cache theo type) =====
type ProductsType = "All" | "BS" | "T";
const PRODUCTS_CACHE_KEY = (type: ProductsType) =>
  `vmgc_products_cache_v1_${type}`;

type CacheShape = {
  items: any[];
  savedAt: number;
  imgVersion?: string;
  dataVersion?: string;
};

const safeReadProductsCacheByType = (type: ProductsType): CacheShape | null => {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY(type));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // hỗ trợ cả dạng { items: [...] } hoặc dạng [...] (legacy)
    const items = Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
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

const safeReadProductsCacheAllMerged = (): CacheShape | null => {
  // Ưu tiên All (đã merge)
  const all = safeReadProductsCacheByType("All");
  if (all?.items?.length) return all;

  // fallback merge BS + T
  const bs = safeReadProductsCacheByType("BS");
  const t = safeReadProductsCacheByType("T");
  const merged = [...(bs?.items || []), ...(t?.items || [])];

  if (!merged.length) return null;

  // unique theo id
  const seen = new Set<string>();
  const uniq: any[] = [];
  for (const p of merged) {
    const id = String(p?.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(p);
  }

  return { items: uniq, savedAt: Date.now() };
};

const App: React.FC = () => {
  // ✅ products dùng chung cho App (phục vụ restore khi F5)
  const [appProducts, setAppProducts] = useState<Product[]>(() => {
    const c = safeReadProductsCacheAllMerged();
    return (c?.items as Product[]) ?? [];
  });

  // ✅ giữ bản mới nhất của appProducts để handler hash dùng mà không cần dependency
  const appProductsRef = useRef<Product[]>([]);
  useEffect(() => {
    appProductsRef.current = appProducts;
  }, [appProducts]);

  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [productsPage, setProductsPage] = useState<number>(1);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isResolvingDetail, setIsResolvingDetail] = useState(false);
  // ================= AUTH =================
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Load user từ localStorage khi app khởi động
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vmgc_user");
      if (raw) {
        setAuthUser(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  // ✅ Load products cho App (để F5 vào detail có thể tìm product)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const bundle = await fetchProductsBundle();
        if (!alive) return;

        // ưu tiên cache mapped (nhanh + đủ field)
        // ưu tiên cache mapped (nhanh + đủ field) - theo chuẩn cache mới
        const c = safeReadProductsCacheAllMerged();
        if (c?.items?.length) {
          setAppProducts(c.items as Product[]);
          return;
        }

        // ✅ fallback: map gần giống ProductList để resolve detail khi F5/link trực tiếp
        const rawItems = (bundle as any)?.items ?? [];
        const imgVersion = String((bundle as any)?.imgVersion || "");

        const minimal = rawItems.map((sp: any) => {
          const id = String(sp?.maCay || sp?.id || "").trim();

          const toVnd = (million: any) =>
            million == null || !Number.isFinite(Number(million))
              ? null
              : Math.round(Number(million) * 1_000_000);

          const parts: string[] = [];
          if (sp?.cao_m != null) parts.push(`Cao ~ ${sp.cao_m}m`);
          if (sp?.ngang_m != null) parts.push(`Tán ~ ${sp.ngang_m}m`);
          if (sp?.hoanh_cm != null) parts.push(`Hoành ${sp.hoanh_cm}cm`);
          if (sp?.chau_m != null) parts.push(`Chậu ~ ${sp.chau_m}m`);

          const specs = parts.length ? parts.join(" · ") : "";
          const note = String(sp?.note || "").trim();
          const description =
            specs && note
              ? `${specs}. ${note}`
              : specs
                ? `${specs}.`
                : note || "";

          const norm = id.replace(/\s+/g, "").toUpperCase();
          const category = norm.startsWith("BS")
            ? "Mai Bonsai"
            : norm.startsWith("T")
              ? "Mai Tàng"
              : "Khác";

          const image = sp?.imageUrl
            ? `${sp.imageUrl}${sp.imageUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(
                imgVersion,
              )}`
            : "";

          return {
            id,
            name: id,
            category,

            rentPrice: toVnd(sp?.giaThue),
            price: toVnd(sp?.giaBan),

            height: sp?.cao_m != null ? `${sp.cao_m}m` : null,
            width: sp?.ngang_m != null ? `${sp.ngang_m}m` : null,
            age: null,

            image,
            thumbnails: image ? [image] : [],

            description,

            isRented: !!sp?.daThue,
            isSold: !!sp?.daBan,
          } as Product;
        });

        setAppProducts(minimal);
      } catch {
        // im lặng
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Tránh vòng lặp khi ta tự set hash → hashchange → setState lại
  const syncingRef = useRef(false);

  /**
   * ✅ Điều hướng chuẩn cho toàn app (giữ API cũ: setCurrentPage(page))
   * - đổi tab (page)
   * - tự cuộn về đầu trang (khi user bấm menu)
   */

  const handleLogin = (user: AuthUser) => {
    setAuthUser(user);
    localStorage.setItem("vmgc_user", JSON.stringify(user));
    setShowLogin(false);
  };

  const handleLogout = () => {
    setAuthUser(null);
    localStorage.removeItem("vmgc_user");
  };

  const handleUpdateUser = (user: AuthUser) => {
    setAuthUser(user);
    localStorage.setItem("vmgc_user", JSON.stringify(user));
  };

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    let scrollTimeout: number | undefined;

    const handleScroll = () => {
      setIsScrolling(true);

      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout);
      }

      scrollTimeout = window.setTimeout(() => {
        setIsScrolling(false);
      }, 600);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
    };
  }, []);

  /**
   * 1) Khi user bấm Back/Forward (hoặc swipe back) → hash đổi
   * => đọc hash và setState tương ứng
   */
  useEffect(() => {
    const applyFromHash = (fromHashChange: boolean) => {
      // nếu hashchange do mình tự sync thì bỏ qua vòng này (tránh giật)
      if (syncingRef.current) {
        syncingRef.current = false;
        return;
      }

      const {
        page,
        productId,
        productsPage: p,
      } = hashToState(window.location.hash);
      setProductsPage(p);

      setCurrentPage(page);

      if (page !== "product-detail") setSelectedProduct(null);

      if (page === "product-detail" && productId) {
        const pid = normPid(productId);
        const found = appProductsRef.current.find((x) => normPid(x.id) === pid);

        if (found) {
          setSelectedProduct(found);
          setIsResolvingDetail(false);
        } else {
          setSelectedProduct(null);
          setIsResolvingDetail(true);
        }
      } else {
        setIsResolvingDetail(false);
      }

      // ✅ Chỉ scroll khi user Back/Forward (hashchange thật)
      if (fromHashChange) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    // chạy lần đầu để sync trạng thái theo URL khi load trang (KHÔNG scroll)
    applyFromHash(false);

    const onHashChange = () => applyFromHash(true);
    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // ✅ Khi products đã có (cache update), tự resolve lại product-detail theo URL
  // ✅ Khi products đã có (cache update), tự resolve lại product-detail theo URL
  useEffect(() => {
    const { page, productId } = hashToState(window.location.hash);
    if (page !== "product-detail" || !productId) return;

    // ✅ QUAN TRỌNG:
    // Nếu user vừa click chọn cây (selectedProduct đã có),
    // TUYỆT ĐỐI không được resolve lại theo hash (vì hash có thể còn là cây cũ trước khi effect sync kịp chạy)
    if (selectedProduct) return;

    const pid = normPid(productId);
    const found = appProductsRef.current.find((x) => normPid(x.id) === pid);

    if (found) {
      setSelectedProduct(found);
      setIsResolvingDetail(false);
      return;
    }

    // ✅ nếu đang chờ mà vẫn chưa ra -> thoát sau 6s (tránh kẹt vô hạn)
    if (isResolvingDetail) {
      const t = window.setTimeout(() => {
        const st = hashToState(window.location.hash);
        if (st.page === "product-detail" && st.productId === productId) {
          setIsResolvingDetail(false);
          navigate("products");
        }
      }, 6000);

      return () => window.clearTimeout(t);
    }
  }, [appProducts, selectedProduct, isResolvingDetail, navigate]);

  /**
   * 2) Khi state đổi do điều hướng trong app → update hash để tạo history entry
   */
  useEffect(() => {
    // ✅ đang resolve detail thì giữ nguyên hash hiện tại, đừng tự rewrite
    if (currentPage === "product-detail" && !selectedProduct) return;

    const desired = pageToHash(
      currentPage,
      selectedProduct?.id ?? null,
      productsPage,
    );
    if (window.location.hash !== desired) {
      syncingRef.current = true;
      window.location.hash = desired;
    }
  }, [currentPage, selectedProduct, productsPage]);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home setCurrentPage={navigate} />;

      case "products":
        return (
          <ProductList
            setCurrentPage={navigate}
            setSelectedProduct={setSelectedProduct}
            productsPage={productsPage}
            setProductsPage={setProductsPage}
            onProductsUpdated={setAppProducts}
          />
        );

      case "product-detail":
        if (selectedProduct) {
          return (
            <ProductDetail
              product={selectedProduct}
              products={appProducts} // ✅ QUAN TRỌNG
              setCurrentPage={navigate}
              setSelectedProduct={setSelectedProduct}
            />
          );
        }

        if (isResolvingDetail) {
          return (
            <div className="container mx-auto px-4 py-16 text-center">
              <div className="inline-block rounded-2xl bg-white px-6 py-6 shadow-sm border border-slate-200">
                <div className="text-slate-900 font-bold text-lg mb-2">
                  Đang tải sản phẩm…
                </div>
                <div className="text-slate-500 text-sm">
                  Vui lòng đợi trong giây lát.
                </div>

                <button
                  type="button"
                  className="mt-5 bg-amber-400 hover:bg-amber-500 text-amber-950 px-5 py-2 rounded-xl font-bold"
                  onClick={() => navigate("products")}
                >
                  Quay về danh sách
                </button>
              </div>
            </div>
          );
        }

        return (
          <ProductList
            setCurrentPage={navigate}
            setSelectedProduct={setSelectedProduct}
            productsPage={productsPage}
            setProductsPage={setProductsPage}
            onProductsUpdated={setAppProducts}
          />
        );

      case "contact":
        return <Contact setCurrentPage={navigate} />;

      case "booking":
        return <Booking setCurrentPage={navigate} authUser={authUser} />;

      default:
        return <Home setCurrentPage={navigate} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <FloatingCTAStyle />
      <Navbar
        currentPage={currentPage}
        setCurrentPage={navigate}
        authUser={authUser}
        onOpenLogin={() => setShowLogin(true)}
        onLogout={handleLogout}
        onUpdateUser={handleUpdateUser}
      />

      <main className="flex-grow">{renderPage()}</main>

      <Footer setCurrentPage={navigate} />

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />
      )}

      {/* Overlay đóng menu khi click ra ngoài */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setChatOpen(false)}
        />
      )}

      {/* Floating actions (mobile) */}
      <div
        className={`fixed bottom-6 right-6 z-50 md:hidden transition-all duration-300 ${
          isScrolling
            ? "opacity-30 pointer-events-none"
            : "opacity-100 pointer-events-auto"
        }`}
      >
        <div className="relative flex flex-col items-end gap-3">
          {/* Popover menu: Messenger / Zalo */}
          {chatOpen && (
            <div className="mb-2 flex flex-col gap-2 rounded-2xl bg-white/95 backdrop-blur px-3 py-3 shadow-2xl border border-slate-200">
              <a
                href="https://m.me/vuonmaigocatquan9"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl font-semibold text-slate-800 hover:bg-slate-100 transition flex items-center gap-2"
                onClick={() => setChatOpen(false)}
              >
                💬 Messenger
              </a>

              <a
                href="https://zalo.me/84922727277"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl font-semibold text-slate-800 hover:bg-slate-100 transition flex items-center gap-2"
                onClick={() => setChatOpen(false)}
              >
                💙 Zalo
              </a>
            </div>
          )}

          {/* Chat button */}
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Nhắn tin"
            className="cta-breathe w-14 h-14 bg-green-500 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl active:scale-95 transition"
          >
            💬
          </button>

          {/* Call button */}
          <a
            href="tel:0922727277"
            aria-label="Gọi điện 0922727277"
            className="cta-breathe-delay w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl active:scale-95 transition"
          >
            📞
          </a>
        </div>
      </div>
    </div>
  );
};

export default App;
