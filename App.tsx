import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Page,
  Product,
  AuthUser,
  canAccessAdmin,
  normalizeAuthUser,
} from "./types";
import { fetchProductsBundleRevalidateMapped } from "./utils/productsApi";
import { Navbar, Footer } from "./components/Layout";

import Home from "./pages/Home";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import Booking from "./pages/Booking";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
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
  const h = raw.startsWith("#") ? raw.slice(1) : raw;

  const [pathPart, queryPart] = h.split("?");
  const parts = pathPart.split("/").filter(Boolean);

  const params = new URLSearchParams(queryPart || "");
  const p = Math.max(1, Math.trunc(Number(params.get("p") || "1") || 1));

  if (parts.length === 0) return { page: "home", productsPage: p };

  if (parts[0] === "admin") {
    return { page: "admin", productsPage: 1 };
  }

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

const getRouteState = (): {
  page: Page;
  productId?: string;
  productsPage: number;
} => {
  if (window.location.pathname === "/admin") {
    return { page: "admin", productsPage: 1 };
  }

  return hashToState(window.location.hash);
};

// ===== Products cache reader (để App restore detail khi F5) =====
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
  const all = safeReadProductsCacheByType("All");
  if (all?.items?.length) return all;

  const bs = safeReadProductsCacheByType("BS");
  const t = safeReadProductsCacheByType("T");
  const merged = [...(bs?.items || []), ...(t?.items || [])];

  if (!merged.length) return null;

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
  const [appProducts, setAppProducts] = useState<Product[]>(() => {
    const c = safeReadProductsCacheAllMerged();
    return (c?.items as Product[]) ?? [];
  });

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
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Load user từ localStorage khi app khởi động
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vmgc_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setAuthUser(normalizeAuthUser(parsed));
      }
    } catch {
      // ignore
    }
  }, []);

  // ✅ Load products cho App
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const cached = safeReadProductsCacheAllMerged();
        if (alive && cached?.items?.length) {
          setAppProducts(cached.items as Product[]);
        }

        const res = await fetchProductsBundleRevalidateMapped({ type: "All" });
        if (!alive) return;

        setAppProducts(res.products || []);
      } catch {
        // im lặng
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const syncingRef = useRef(false);

  const handleLogin = (user: AuthUser) => {
    const normalizedUser = normalizeAuthUser(user);

    setAuthUser(normalizedUser);
    localStorage.setItem("vmgc_user", JSON.stringify(normalizedUser));
    setShowLogin(false);
  };

  const handleLogout = () => {
    setLogoutLoading(true);

    setTimeout(() => {
      setAuthUser(null);
      localStorage.removeItem("vmgc_user");
      setLogoutLoading(false);
    }, 600);
  };

  const handleUpdateUser = (user: AuthUser) => {
    const mergedUser = normalizeAuthUser({
      ...authUser,
      ...user,
    });

    setAuthUser(mergedUser);
    localStorage.setItem("vmgc_user", JSON.stringify(mergedUser));
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

  useEffect(() => {
    const applyFromHash = (fromHashChange: boolean) => {
      if (syncingRef.current) {
        syncingRef.current = false;
        return;
      }

      const { page, productId, productsPage: p } = getRouteState();
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

      if (fromHashChange) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    applyFromHash(false);

    const onHashChange = () => applyFromHash(true);
    const onPopState = () => applyFromHash(true);

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    const { page, productId } = getRouteState();
    if (page !== "product-detail" || !productId) return;

    if (selectedProduct) return;

    const pid = normPid(productId);
    const found = appProductsRef.current.find((x) => normPid(x.id) === pid);

    if (found) {
      setSelectedProduct(found);
      setIsResolvingDetail(false);
      return;
    }

    if (isResolvingDetail) {
      const t = window.setTimeout(() => {
        const st = getRouteState();
        if (st.page === "product-detail" && st.productId === productId) {
          setIsResolvingDetail(false);
          navigate("products");
        }
      }, 6000);

      return () => window.clearTimeout(t);
    }
  }, [appProducts, selectedProduct, isResolvingDetail, navigate]);

  useEffect(() => {
    if (currentPage === "admin") {
      if (window.location.pathname !== "/admin") {
        window.history.pushState({}, "", "/admin");
      }
      return;
    }

    if (window.location.pathname === "/admin") {
      window.history.pushState({}, "", "/");
    }

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
              products={appProducts}
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

      case "admin":
        // ❌ chưa login
        if (!authUser) {
          return (
            <div className="container mx-auto px-4 py-20 text-center">
              <p className="text-lg text-red-600 font-semibold">
                Bạn cần đăng nhập để truy cập trang quản trị
              </p>
              <button
                onClick={() => setShowLogin(true)}
                className="mt-4 px-6 py-2 bg-amber-400 rounded-lg font-bold"
              >
                Đăng nhập
              </button>
            </div>
          );
        }

        // ❌ không có quyền admin
        const hasPermission = canAccessAdmin(authUser);

        if (!hasPermission) {
          return (
            <div className="container mx-auto px-4 py-20 text-center">
              <p className="text-lg text-red-600 font-semibold">
                Bạn không có quyền truy cập trang quản trị
              </p>
            </div>
          );
        }

        // ✅ OK
        return (
          <Admin authUser={authUser} onBackToSite={() => navigate("home")} />
        );

      default:
        return <Home setCurrentPage={navigate} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {logoutLoading && (
        <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium text-amber-900">
            Đang đăng xuất...
          </p>
        </div>
      )}

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

      {chatOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setChatOpen(false)}
        />
      )}

      <div
        className={`fixed bottom-6 right-6 z-50 md:hidden transition-all duration-300 ${
          isScrolling
            ? "opacity-30 pointer-events-none"
            : "opacity-100 pointer-events-auto"
        }`}
      >
        <div className="relative flex flex-col items-end gap-3">
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

          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Nhắn tin"
            className="cta-breathe w-14 h-14 bg-green-500 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl active:scale-95 transition"
          >
            💬
          </button>

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
