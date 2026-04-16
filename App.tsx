import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Page,
  Product,
  AuthUser,
  AppRouteState,
  canAccessAdmin,
  canAccessAdminTab,
  clampPositiveInt,
  getDefaultAdminTab,
  isAdminTab,
  normalizeAuthUser,
  normalizeProductId,
} from "./types";
import { fetchProductsBundleRevalidateMapped } from "./utils/productsApi";
import { Navbar, Footer } from "./components/Layout";

import Home from "./pages/Home";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import Booking from "./pages/Booking";
import Contact from "./pages/Contact";
import AdminPage from "./pages/admin/AdminPage";
import NotFound from "./pages/NotFound";
import LoginModal from "./components/LoginModal";
import RouteGuard from "./components/RouteGuard";

const FloatingCTAStyle = () => (
  <style>{`
@keyframes ctaBreathe {
  0%, 100% { transform: scale(1); }
  40% { transform: scale(1.1); }
  55% { transform: scale(1.07); }
}

@media (max-width: 768px) and (hover: none) and (pointer: coarse) {
  .cta-breathe {
    animation: ctaBreathe 2.6s ease-in-out infinite;
  }

  .cta-breathe-delay {
    animation: ctaBreathe 2.9s ease-in-out infinite;
    animation-delay: 0.6s;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cta-breathe,
  .cta-breathe-delay {
    animation: none !important;
  }
}
  `}</style>
);

type ProductsType = "All" | "BS" | "T";
const PRODUCTS_CACHE_KEY = (type: ProductsType) =>
  `vmgc_products_cache_v1_${type}`;

type CacheShape = {
  items: Product[];
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
      ? (parsed.items as Product[])
      : Array.isArray(parsed)
        ? (parsed as Product[])
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
  const uniq: Product[] = [];
  for (const item of merged) {
    const id = String(item?.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(item);
  }

  return { items: uniq, savedAt: Date.now() };
};

const readProductsPage = (params: URLSearchParams) =>
  clampPositiveInt(params.get("page") ?? params.get("p") ?? 1, 1);

const parseHashRoute = (hash: string): AppRouteState => {
  const raw = String(hash || "#/home").trim();
  const cleaned = raw.startsWith("#") ? raw.slice(1) : raw;
  const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const [pathPart, queryPart] = normalized.split("?");
  const params = new URLSearchParams(queryPart || "");
  const productsPage = readProductsPage(params);
  const parts = pathPart.split("/").filter(Boolean);

  if (parts.length === 0) {
    return { page: "home", productsPage: 1 };
  }

  if (parts[0] === "san-pham") {
    if (parts[1]) {
      return {
        page: "product-detail",
        productId: decodeURIComponent(parts[1]),
        productsPage,
      };
    }
    return { page: "products", productsPage };
  }

  if (parts[0] === "dat-lich") {
    return { page: "booking", productsPage: 1 };
  }

  if (parts[0] === "lien-he") {
    return { page: "contact", productsPage: 1 };
  }

  if (parts[0] === "admin") {
    const tabPart = parts[1];
    return {
      page: "admin",
      productsPage: 1,
      adminTab: isAdminTab(tabPart) ? tabPart : undefined,
    };
  }

  if (parts[0] === "404") {
    return { page: "not-found", productsPage: 1 };
  }

  if (parts[0] === "home") {
    return { page: "home", productsPage: 1 };
  }

  return { page: "not-found", productsPage: 1 };
};

const buildHashRoute = (route: AppRouteState) => {
  switch (route.page) {
    case "home":
      return "#/";
    case "products": {
      const page = clampPositiveInt(route.productsPage, 1);
      return `#/san-pham?page=${page}`;
    }
    case "product-detail": {
      const page = clampPositiveInt(route.productsPage, 1);
      const productId = normalizeProductId(route.productId);
      if (!productId) return `#/san-pham?page=${page}`;
      return `#/san-pham/${encodeURIComponent(productId)}?page=${page}`;
    }
    case "booking":
      return "#/dat-lich";
    case "contact":
      return "#/lien-he";
    case "admin": {
      const tab = route.adminTab && isAdminTab(route.adminTab)
        ? route.adminTab
        : "products";
      return `#/admin/${tab}`;
    }
    default:
      return "#/404";
  }
};

const App: React.FC = () => {
  const [appProducts, setAppProducts] = useState<Product[]>(() => {
    const cached = safeReadProductsCacheAllMerged();
    return cached?.items ?? [];
  });
  const [productsReady, setProductsReady] = useState(false);
  const appProductsRef = useRef<Product[]>(appProducts);

  const [route, setRoute] = useState<AppRouteState>(() => {
    if (typeof window === "undefined") {
      return { page: "home", productsPage: 1 };
    }
    return parseHashRoute(window.location.hash);
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    appProductsRef.current = appProducts;
  }, [appProducts]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("vmgc_user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setAuthUser(normalizeAuthUser(parsed));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const cached = safeReadProductsCacheAllMerged();
        if (alive && cached?.items?.length) {
          setAppProducts(cached.items);
        }

        const res = await fetchProductsBundleRevalidateMapped({ type: "All" });
        if (!alive) return;
        setAppProducts(res.products || []);
      } catch {
        // giữ cache cũ nếu có
      } finally {
        if (alive) {
          setProductsReady(true);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const syncRouteFromLocation = useCallback(() => {
    setRoute(parseHashRoute(window.location.hash));
  }, []);

  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/admin") {
      const nextHash = buildHashRoute({
        page: "admin",
        adminTab: getDefaultAdminTab(authUser),
        productsPage: 1,
      });
      window.history.replaceState({}, "", `/${nextHash}`);
      setRoute(parseHashRoute(nextHash));
      return;
    }

    if (!window.location.hash) {
      window.history.replaceState({}, "", "/#/");
      setRoute({ page: "home", productsPage: 1 });
      return;
    }

    syncRouteFromLocation();
  }, [authUser, syncRouteFromLocation]);

  useEffect(() => {
    window.addEventListener("hashchange", syncRouteFromLocation);
    window.addEventListener("popstate", syncRouteFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncRouteFromLocation);
      window.removeEventListener("popstate", syncRouteFromLocation);
    };
  }, [syncRouteFromLocation]);

  const navigateHash = useCallback(
    (
      hash: string,
      options?: { replace?: boolean; scroll?: ScrollBehavior | "none" },
    ) => {
      const { replace = false, scroll = "smooth" } = options || {};

      if (replace) {
        window.history.replaceState({}, "", `/${hash}`);
        setRoute(parseHashRoute(hash));
      } else if (window.location.hash !== hash) {
        window.location.hash = hash;
      } else {
        setRoute(parseHashRoute(hash));
      }

      if (scroll !== "none") {
        window.scrollTo({ top: 0, left: 0, behavior: scroll });
      }
    },
    [],
  );

  const goHome = useCallback(() => {
    navigateHash(buildHashRoute({ page: "home", productsPage: 1 }));
  }, [navigateHash]);

  const goProducts = useCallback(
    (page = 1, options?: { scroll?: ScrollBehavior | "none"; replace?: boolean }) => {
      navigateHash(
        buildHashRoute({ page: "products", productsPage: clampPositiveInt(page, 1) }),
        options,
      );
    },
    [navigateHash],
  );

  const goProductDetail = useCallback(
    (
      productId: string,
      page = 1,
      options?: { scroll?: ScrollBehavior | "none"; replace?: boolean },
    ) => {
      navigateHash(
        buildHashRoute({
          page: "product-detail",
          productId: normalizeProductId(productId),
          productsPage: clampPositiveInt(page, 1),
        }),
        options,
      );
    },
    [navigateHash],
  );

  const goBooking = useCallback(() => {
    navigateHash(buildHashRoute({ page: "booking", productsPage: 1 }));
  }, [navigateHash]);

  const goContact = useCallback(() => {
    navigateHash(buildHashRoute({ page: "contact", productsPage: 1 }));
  }, [navigateHash]);

  const goAdmin = useCallback(
    (tab?: AppRouteState["adminTab"], options?: { scroll?: ScrollBehavior | "none"; replace?: boolean }) => {
      navigateHash(
        buildHashRoute({
          page: "admin",
          adminTab:
            tab && isAdminTab(tab) ? tab : getDefaultAdminTab(authUser),
          productsPage: 1,
        }),
        options,
      );
    },
    [authUser, navigateHash],
  );

  const navigateByPage = useCallback(
    (page: Page) => {
      switch (page) {
        case "home":
          goHome();
          return;
        case "products":
          goProducts(1);
          return;
        case "booking":
          goBooking();
          return;
        case "contact":
          goContact();
          return;
        case "admin":
          goAdmin();
          return;
        case "product-detail":
          if (route.page === "product-detail" && route.productId) {
            goProductDetail(route.productId, route.productsPage || 1);
          } else {
            goProducts(1);
          }
          return;
        default:
          goHome();
      }
    },
    [goAdmin, goBooking, goContact, goHome, goProductDetail, goProducts, route],
  );

  const handleLogin = (user: AuthUser) => {
    const normalizedUser = normalizeAuthUser(user);
    setAuthUser(normalizedUser);
    localStorage.setItem("vmgc_user", JSON.stringify(normalizedUser));
    setShowLogin(false);
  };

  const handleLogout = () => {
    setLogoutLoading(true);

    window.setTimeout(() => {
      setAuthUser(null);
      localStorage.removeItem("vmgc_user");
      setLogoutLoading(false);
      if (route.page === "admin") {
        goHome();
      }
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

  const activeAdminTab = useMemo(() => {
    if (route.page !== "admin") return getDefaultAdminTab(authUser);
    if (route.adminTab && (!authUser || canAccessAdminTab(authUser, route.adminTab))) {
      return route.adminTab;
    }
    return getDefaultAdminTab(authUser);
  }, [authUser, route.adminTab, route.page]);

  useEffect(() => {
    if (route.page !== "admin") return;
    const desired = buildHashRoute({
      page: "admin",
      adminTab: activeAdminTab,
      productsPage: 1,
    });
    if (window.location.hash !== desired) {
      navigateHash(desired, { replace: true, scroll: "none" });
    }
  }, [activeAdminTab, navigateHash, route.page]);

  const resolvedProduct = useMemo(() => {
    if (route.page !== "product-detail" || !route.productId) return null;
    const pid = normalizeProductId(route.productId);
    return appProducts.find((item) => normalizeProductId(item.id) === pid) || null;
  }, [appProducts, route.page, route.productId]);

  const currentLayoutPage: Page =
    route.page === "product-detail"
      ? "products"
      : route.page === "not-found"
        ? "home"
        : route.page;

  const showPublicChrome = route.page !== "admin";

  const renderPage = () => {
    switch (route.page) {
      case "home":
        return <Home setCurrentPage={navigateByPage} />;

      case "products":
        return (
          <ProductList
            productsPage={route.productsPage}
            setProductsPage={(page) => goProducts(page, { scroll: "none" })}
            onOpenProduct={(product, page) =>
              goProductDetail(product.id, page, { scroll: "smooth" })
            }
            onProductsUpdated={setAppProducts}
          />
        );

      case "product-detail":
        if (resolvedProduct) {
          return (
            <ProductDetail
              product={resolvedProduct}
              products={appProducts}
              productsPage={route.productsPage}
              onGoHome={goHome}
              onGoProducts={(page) => goProducts(page, { scroll: "smooth" })}
              onGoContact={goContact}
              onOpenProduct={(productId, page) =>
                goProductDetail(productId, page, { scroll: "smooth" })
              }
            />
          );
        }

        if (!productsReady) {
          return (
            <div className="container mx-auto px-4 py-16 text-center">
              <div className="inline-block rounded-2xl bg-white px-6 py-6 shadow-sm border border-slate-200">
                <div className="text-slate-900 font-bold text-lg mb-2">
                  Đang tải sản phẩm…
                </div>
                <div className="text-slate-500 text-sm">
                  Vui lòng đợi trong giây lát.
                </div>
              </div>
            </div>
          );
        }

        return (
          <NotFound
            title="Không tìm thấy sản phẩm"
            description="Liên kết này không còn hợp lệ hoặc mã cây không tồn tại trong dữ liệu hiện tại."
            primaryActionLabel="Quay về danh sách sản phẩm"
            onPrimaryAction={() => goProducts(route.productsPage || 1)}
            secondaryActionLabel="Về trang chủ"
            onSecondaryAction={goHome}
          />
        );

      case "contact":
        return <Contact setCurrentPage={navigateByPage} />;

      case "booking":
        return <Booking authUser={authUser} />;

      case "admin":
        return (
          <RouteGuard
            authUser={authUser}
            requiredAdminTab={activeAdminTab}
            onRequestLogin={() => setShowLogin(true)}
          >
            <AdminPage
              authUser={authUser}
              activeTab={activeAdminTab}
              onChangeTab={(tab) => goAdmin(tab, { scroll: "none" })}
              onBackToSite={goHome}
            />
          </RouteGuard>
        );

      default:
        return (
          <NotFound
            title="Trang không tồn tại"
            description="Liên kết bạn truy cập không đúng hoặc đã bị thay đổi."
            primaryActionLabel="Về trang chủ"
            onPrimaryAction={goHome}
            secondaryActionLabel="Xem sản phẩm"
            onSecondaryAction={() => goProducts(1)}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {logoutLoading && (
        <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium text-amber-900">Đang đăng xuất...</p>
        </div>
      )}

      <FloatingCTAStyle />

      {showPublicChrome && (
        <Navbar
          currentPage={currentLayoutPage}
          setCurrentPage={navigateByPage}
          authUser={authUser}
          onOpenLogin={() => setShowLogin(true)}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
        />
      )}

      <main className="flex-grow">{renderPage()}</main>

      {showPublicChrome && <Footer setCurrentPage={navigateByPage} />}

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />
      )}

      {showPublicChrome && chatOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setChatOpen(false)}
        />
      )}

      {showPublicChrome && (
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
              onClick={() => setChatOpen((value) => !value)}
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
      )}
    </div>
  );
};

export default App;
