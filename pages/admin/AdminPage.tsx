import React from "react";
import type { AuthUser, Booking, Product } from "../../types";
import {
  clearProductsCache,
  createProduct,
  deleteProduct,
  fetchAdminMeta,
  getCachedAdminBookings,
  getCachedAdminProducts,
  getCachedAdminUsers,
  setCachedAdminBookings,
  setCachedAdminProducts,
  setCachedAdminUsers,
  syncAdminBookings,
  syncAdminProducts,
  syncAdminUsers,
  updateBookingNote,
  updateBookingStatus,
  updateProduct as updateProductApi,
  updateUserPermissions,
  verifyAdminPassword,
  type AdminMeta,
  type ProductsMeta,
  type ProductsType,
} from "../../utils/productsApi";
import { getProductAvailabilityStatus } from "../../utils/productAvailability";
import { useToast } from "../../components/Toast";
import BookingsTab from "./tabs/BookingsTab";
import ProductsTab from "./tabs/ProductsTab";
import UsersTab from "./tabs/UsersTab";
import OrdersTab from "./tabs/OrdersTab";
import {
  RECENT_USER_DAYS,
  buildOptimisticProduct,
  buildProductStats,
  extractUserNote,
  hasRealAvatar,
  matchesProductsType,
  sortProductsForAdmin,
  toMillionInput,
} from "./helpers";
import type { AdminTab } from "./types";

interface AdminPageProps {
  authUser?: AuthUser | null;
  activeTab: AdminTab;
  onChangeTab: (tab: AdminTab) => void;
  onBackToSite?: () => void;
}

const ADMIN_META_POLL_MS = 20_000;

const USER_PERMISSION_OPTIONS = [
  { value: "products", label: "Quản trị sản phẩm" },
  { value: "bookings", label: "Quản trị lịch hẹn" },
  { value: "orders", label: "Quản trị đơn hàng" },
] as const;

const AdminPage: React.FC<AdminPageProps> = ({
  authUser,
  activeTab,
  onChangeTab,
  onBackToSite,
}) => {
  const { showToast, showConfirm } = useToast();

  // ==================== SCROLL MANAGEMENT ====================
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = React.useRef<Record<string, number>>({
    products: 0,
    bookings: 0,
    users: 0,
    orders: 0,
  });
  // ===========================================================

  const [products, setProducts] = React.useState<Product[]>([]);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [users, setUsers] = React.useState<AuthUser[]>([]);
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<AuthUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = React.useState<
    string[]
  >([]);
  const [selectedRole, setSelectedRole] = React.useState<"user" | "admin">(
    "user",
  );
  const [adminPassword, setAdminPassword] = React.useState("");
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(
    null,
  );
  const [cancelReason, setCancelReason] = React.useState("");
  const [otherReason, setOtherReason] = React.useState("");
  const [showBookingNoteModal, setShowBookingNoteModal] = React.useState(false);
  const [selectedBookingNote, setSelectedBookingNote] = React.useState("");
  const [editingBooking, setEditingBooking] = React.useState<Booking | null>(
    null,
  );
  const [editingBookingNote, setEditingBookingNote] = React.useState("");
  const [bookingFilter, setBookingFilter] = React.useState("Tất cả");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [userSearch, setUserSearch] = React.useState("");
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [loadingAdminTab, setLoadingAdminTab] = React.useState(false);
  const [productsType, setProductsType] = React.useState<"All" | "BS" | "T">(
    "All",
  );
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const [bookingPage, setBookingPage] = React.useState(1);
  const [bookingPageInput, setBookingPageInput] = React.useState("1");
  const [userPage, setUserPage] = React.useState(1);
  const [userPageInput, setUserPageInput] = React.useState("1");
  const itemsPerPage = 10;

  const latestAdminMetaRef = React.useRef<AdminMeta | null>(null);
  const dirtyResourcesRef = React.useRef({
    products: false,
    bookings: false,
    users: false,
  });

  const [stats, setStats] = React.useState({
    total: 0,
    bonsai: 0,
    tang: 0,
  });

  const [showModal, setShowModal] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "view" | "edit">(
    "create",
  );
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(
    null,
  );
  const [formData, setFormData] = React.useState({
    id: "",
    category: "Mai Bonsai",
    rentPrice: "",
    price: "",
    height: "",
    width: "",
    hoanh: "",
    chau: "",
    note: "",
    daThue: false,
    daBan: false,
  });
  const [idError, setIdError] = React.useState("");
  const [isIdTouched, setIsIdTouched] = React.useState(false);
  const [errors, setErrors] = React.useState({
    rentPrice: "",
    price: "",
    height: "",
    width: "",
    hoanh: "",
    chau: "",
  });
  const [productImageFile, setProductImageFile] = React.useState<File | null>(
    null,
  );
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [fullImage, setFullImage] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Restore scroll position khi chuyển tab
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const saved = scrollPositionsRef.current[activeTab] || 0;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: saved,
        behavior: "smooth",
      });
    });
  }, [activeTab]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPermissionModal) {
          setShowPermissionModal(false);
          setSelectedUser(null);
          return;
        }
        if (showCancelModal) {
          setShowCancelModal(false);
          setSelectedBooking(null);
          setCancelReason("");
          setOtherReason("");
          return;
        }
        if (showBookingNoteModal) {
          setShowBookingNoteModal(false);
          return;
        }
        if (editingBooking) {
          setEditingBooking(null);
          setEditingBookingNote("");
          return;
        }
        if (fullImage) {
          setFullImage(null);
          return;
        }
        if (showModal) {
          setShowModal(false);
          setProductImageFile(null);
          setPreviewImage(null);
          setSelectedProduct(null);
          setIdError("");
          setIsIdTouched(false);
          setErrors({
            rentPrice: "",
            price: "",
            height: "",
            width: "",
            hoanh: "",
            chau: "",
          });
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [
    showModal,
    showPermissionModal,
    showCancelModal,
    showBookingNoteModal,
    editingBooking,
    fullImage,
  ]);

  React.useEffect(() => {
    const hasAnyModalOpen =
      showModal ||
      showPermissionModal ||
      showCancelModal ||
      showBookingNoteModal ||
      !!editingBooking ||
      !!fullImage;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    if (hasAnyModalOpen) {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
    }
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [
    showModal,
    showPermissionModal,
    showCancelModal,
    showBookingNoteModal,
    editingBooking,
    fullImage,
  ]);

  React.useEffect(() => {
    if (!selectedProduct) return;

    const availability = getProductAvailabilityStatus(selectedProduct);

    setFormData({
      id: selectedProduct.id || "",
      category: selectedProduct.category || "Mai Bonsai",
      rentPrice: toMillionInput(selectedProduct.rentPrice),
      price: toMillionInput(selectedProduct.price),
      height:
        selectedProduct.height != null
          ? String(selectedProduct.height).replace(".", ",")
          : "",
      width:
        selectedProduct.width != null
          ? String(selectedProduct.width).replace(".", ",")
          : "",
      hoanh:
        (selectedProduct as any).hoanh_cm != null
          ? String((selectedProduct as any).hoanh_cm)
          : "",
      chau:
        (selectedProduct as any).chau_m != null
          ? String((selectedProduct as any).chau_m).replace(".", ",")
          : "",
      note: extractUserNote(selectedProduct.description || ""),
      daThue: availability === "rented_out",
      daBan: availability === "sold",
    });
    setPreviewImage(selectedProduct.image || null);
    setProductImageFile(null);
  }, [selectedProduct]);

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  React.useEffect(() => {
    setBookingPageInput(String(bookingPage));
  }, [bookingPage]);

  React.useEffect(() => {
    setUserPageInput(String(userPage));
  }, [userPage]);

  React.useEffect(() => {
    if (activeTab === "products") {
      setCurrentPage(1);
    }
    if (activeTab === "bookings") {
      setBookingPage(1);
    }
    if (activeTab === "users") {
      setUserPage(1);
    }
  }, [activeTab]);

  const applyProductsSnapshot = React.useCallback(
    (items: Product[], options?: { resetPage?: boolean }) => {
      const sorted = sortProductsForAdmin(Array.isArray(items) ? items : []);
      setProducts(sorted);
      if (options?.resetPage !== false) {
        setCurrentPage(1);
      }
      setStats(buildProductStats(sorted));
    },
    [],
  );

  const applyBookingsSnapshot = React.useCallback((items: Booking[]) => {
    setBookings(Array.isArray(items) ? items : []);
  }, []);

  const applyUsersSnapshot = React.useCallback((items: AuthUser[]) => {
    setUsers(Array.isArray(items) ? items : []);
  }, []);

  const commitOptimisticProducts = React.useCallback(
    (items: Product[], options?: { resetPage?: boolean }) => {
      const sorted = sortProductsForAdmin(Array.isArray(items) ? items : []);
      setProducts(sorted);
      if (options?.resetPage !== false) {
        setCurrentPage(1);
      }
      setStats(buildProductStats(sorted));
      clearProductsCache();
      setCachedAdminProducts(
        { type: productsType },
        {
          products: sorted,
          meta: {
            imgVersion: String(Date.now()),
            dataVersion: String(Date.now()),
          },
          total: sorted.length,
        },
      );
      dirtyResourcesRef.current.products = true;
      return sorted;
    },
    [productsType],
  );

  const commitOptimisticBookings = React.useCallback((items: Booking[]) => {
    const nextItems = Array.isArray(items) ? items : [];
    setBookings(nextItems);
    setCachedAdminBookings(nextItems, String(Date.now()));
    dirtyResourcesRef.current.bookings = true;
    return nextItems;
  }, []);

  const commitOptimisticUsers = React.useCallback((items: AuthUser[]) => {
    const nextItems = Array.isArray(items) ? items : [];
    setUsers(nextItems);
    setCachedAdminUsers(nextItems, String(Date.now()));
    dirtyResourcesRef.current.users = true;
    return nextItems;
  }, []);

  const refreshProducts = React.useCallback(
    async (options?: {
      force?: boolean;
      silent?: boolean;
      knownMeta?: ProductsMeta;
      resetPage?: boolean;
    }) => {
      try {
        if (!options?.silent) {
          setLoadingProducts(true);
          setLoadingAdminTab(true);
        }
        const payload = await syncAdminProducts(
          { type: productsType },
          {
            force: options?.force,
            knownMeta: options?.knownMeta,
          },
        );
        applyProductsSnapshot(payload.products, {
          resetPage: options?.resetPage,
        });
        dirtyResourcesRef.current.products = false;
        if (latestAdminMetaRef.current) {
          latestAdminMetaRef.current = {
            ...latestAdminMetaRef.current,
            products: payload.meta,
            now: Date.now(),
          };
        }
        return payload;
      } catch (err) {
        console.error("Load products error:", err);
        if (!options?.silent) {
          showToast("Không tải được dữ liệu sản phẩm", "error");
        }
        return null;
      } finally {
        if (!options?.silent) {
          setLoadingProducts(false);
          setLoadingAdminTab(false);
        }
      }
    },
    [applyProductsSnapshot, productsType, showToast],
  );

  const refreshBookings = React.useCallback(
    async (options?: {
      force?: boolean;
      silent?: boolean;
      knownVersion?: string;
    }) => {
      try {
        if (!options?.silent) {
          setLoadingAdminTab(true);
        }
        const payload = await syncAdminBookings({
          force: options?.force,
          knownVersion: options?.knownVersion,
        });
        applyBookingsSnapshot(payload.data);
        dirtyResourcesRef.current.bookings = false;
        if (latestAdminMetaRef.current && options?.knownVersion) {
          latestAdminMetaRef.current = {
            ...latestAdminMetaRef.current,
            bookings: { dataVersion: options.knownVersion },
            now: Date.now(),
          };
        }
        return payload;
      } catch (err) {
        console.error("Load bookings error:", err);
        if (!options?.silent) {
          showToast("Không tải được dữ liệu đặt lịch", "error");
        }
        return null;
      } finally {
        if (!options?.silent) {
          setLoadingAdminTab(false);
        }
      }
    },
    [applyBookingsSnapshot, showToast],
  );

  const refreshUsers = React.useCallback(
    async (options?: {
      force?: boolean;
      silent?: boolean;
      knownVersion?: string;
    }) => {
      try {
        if (!options?.silent) {
          setLoadingAdminTab(true);
        }
        const payload = await syncAdminUsers({
          force: options?.force,
          knownVersion: options?.knownVersion,
        });
        applyUsersSnapshot(payload.data);
        dirtyResourcesRef.current.users = false;
        if (latestAdminMetaRef.current && options?.knownVersion) {
          latestAdminMetaRef.current = {
            ...latestAdminMetaRef.current,
            users: { dataVersion: options.knownVersion },
            now: Date.now(),
          };
        }
        return payload;
      } catch (err) {
        console.error("Load users error:", err);
        if (!options?.silent) {
          showToast("Không tải được user", "error");
        }
        return null;
      } finally {
        if (!options?.silent) {
          setLoadingAdminTab(false);
        }
      }
    },
    [applyUsersSnapshot, showToast],
  );

  React.useEffect(() => {
    if (activeTab !== "products") return;
    const cached = getCachedAdminProducts({ type: productsType });
    if (cached) {
      applyProductsSnapshot(cached.products, { resetPage: false });
      setLoadingProducts(false);
      setLoadingAdminTab(false);
      if (dirtyResourcesRef.current.products) {
        void refreshProducts({
          force: true,
          silent: true,
          knownMeta: latestAdminMetaRef.current?.products,
          resetPage: false,
        });
      }
      return;
    }
    setProducts([]);
    setStats({ total: 0, bonsai: 0, tang: 0 });
    setLoadingProducts(true);
    setLoadingAdminTab(true);
    if (latestAdminMetaRef.current?.products) {
      void refreshProducts({
        force: true,
        knownMeta: latestAdminMetaRef.current.products,
      });
    }
  }, [activeTab, productsType, applyProductsSnapshot, refreshProducts]);

  React.useEffect(() => {
    if (activeTab !== "bookings") return;
    const cached = getCachedAdminBookings();
    if (cached) {
      applyBookingsSnapshot(cached.data);
      setLoadingAdminTab(false);
      if (dirtyResourcesRef.current.bookings) {
        void refreshBookings({
          force: true,
          silent: true,
          knownVersion: latestAdminMetaRef.current?.bookings.dataVersion,
        });
      }
      return;
    }
    setBookings([]);
    setLoadingAdminTab(true);
    if (latestAdminMetaRef.current?.bookings.dataVersion) {
      void refreshBookings({
        force: true,
        knownVersion: latestAdminMetaRef.current.bookings.dataVersion,
      });
    }
  }, [activeTab, applyBookingsSnapshot, refreshBookings]);

  React.useEffect(() => {
    if (activeTab !== "users") return;
    const cached = getCachedAdminUsers();
    if (cached) {
      applyUsersSnapshot(cached.data);
      setLoadingAdminTab(false);
      if (dirtyResourcesRef.current.users) {
        void refreshUsers({
          force: true,
          silent: true,
          knownVersion: latestAdminMetaRef.current?.users.dataVersion,
        });
      }
      return;
    }
    setUsers([]);
    setLoadingAdminTab(true);
    if (latestAdminMetaRef.current?.users.dataVersion) {
      void refreshUsers({
        force: true,
        knownVersion: latestAdminMetaRef.current.users.dataVersion,
      });
    }
  }, [activeTab, applyUsersSnapshot, refreshUsers]);

  React.useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    const runMetaSync = async () => {
      if (disposed) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      try {
        const meta = await fetchAdminMeta();
        if (disposed) return;
        latestAdminMetaRef.current = meta;
        const productsCache = getCachedAdminProducts({ type: productsType });
        const bookingsCache = getCachedAdminBookings();
        const usersCache = getCachedAdminUsers();
        dirtyResourcesRef.current.products =
          !productsCache ||
          productsCache.meta.dataVersion !== meta.products.dataVersion ||
          productsCache.meta.imgVersion !== meta.products.imgVersion;
        dirtyResourcesRef.current.bookings =
          !bookingsCache || bookingsCache.version !== meta.bookings.dataVersion;
        dirtyResourcesRef.current.users =
          !usersCache || usersCache.version !== meta.users.dataVersion;
        const hasProductsCache = !!productsCache;
        const hasBookingsCache = !!bookingsCache;
        const hasUsersCache = !!usersCache;
        if (activeTab === "products" && dirtyResourcesRef.current.products) {
          await refreshProducts({
            force: true,
            silent: hasProductsCache,
            knownMeta: meta.products,
            resetPage: false,
          });
        }
        if (activeTab === "bookings" && dirtyResourcesRef.current.bookings) {
          await refreshBookings({
            force: true,
            silent: hasBookingsCache,
            knownVersion: meta.bookings.dataVersion,
          });
        }
        if (activeTab === "users" && dirtyResourcesRef.current.users) {
          await refreshUsers({
            force: true,
            silent: hasUsersCache,
            knownVersion: meta.users.dataVersion,
          });
        }
      } catch (err) {
        console.error("Admin meta sync error:", err);
      }
    };
    const handleVisibility = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        void runMetaSync();
      }
    };
    void runMetaSync();
    if (typeof window !== "undefined") {
      timer = window.setInterval(() => {
        void runMetaSync();
      }, ADMIN_META_POLL_MS);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    return () => {
      disposed = true;
      if (timer != null && typeof window !== "undefined") {
        window.clearInterval(timer);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [activeTab, productsType, refreshBookings, refreshProducts, refreshUsers]);

  const filteredProducts = products.filter((p) =>
    p.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === "Tất cả") return true;
    return b.trangThai === bookingFilter;
  });
  const totalBookingPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / itemsPerPage),
  );
  const paginatedBookings = filteredBookings.slice(
    (bookingPage - 1) * itemsPerPage,
    bookingPage * itemsPerPage,
  );

  const filteredUsers = React.useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((u) => {
      const email = String(u.email || "").toLowerCase();
      const name = String(u.name || "").toLowerCase();
      const phone = String(u.phone || "").toLowerCase();
      const gender = String(u.gender || "").toLowerCase();
      return (
        email.includes(keyword) ||
        name.includes(keyword) ||
        phone.includes(keyword) ||
        gender.includes(keyword)
      );
    });
  }, [users, userSearch]);

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / itemsPerPage),
  );
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * itemsPerPage,
    userPage * itemsPerPage,
  );

  React.useEffect(() => {
    setBookingPage(1);
  }, [bookingFilter]);

  React.useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  const bookingStats = React.useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.trangThai === "Mới").length;
    const confirmed = bookings.filter(
      (b) => b.trangThai === "Đã xác nhận",
    ).length;
    return { total, pending, confirmed };
  }, [bookings]);

  const userStats = React.useMemo(() => {
    const now = new Date();
    const recentThreshold = new Date(now);
    recentThreshold.setDate(recentThreshold.getDate() - RECENT_USER_DAYS);
    const parseCreatedAt = (value: string) => {
      const raw = String(value || "").trim();
      if (!raw) return null;
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      const match = raw.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
      );
      if (!match) return null;
      const [, dd, mm, yyyy, hh = "0", min = "0", ss = "0"] = match;
      const normalized = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
        Number(ss),
      );
      return Number.isNaN(normalized.getTime()) ? null : normalized;
    };
    const totalUsers = users.length;
    const avatarCount = users.filter((u) => hasRealAvatar(u.avatarUrl)).length;
    const recentUsers = users.filter((u) => {
      const createdAt = parseCreatedAt(u.createdAt || "");
      return createdAt ? createdAt >= recentThreshold : false;
    }).length;
    return {
      totalUsers,
      avatarCount,
      recentUsers,
      recentDays: RECENT_USER_DAYS,
    };
  }, [users]);

  const sidebarItems = [
    {
      key: "products",
      label: "Sản phẩm",
      icon: "🌼",
      description: "Quản lý cây mai",
      allow:
        authUser?.role === "admin" ||
        authUser?.permissions?.includes("products"),
    },
    {
      key: "bookings",
      label: "Đặt lịch",
      icon: "📅",
      description: "Quản lý lịch tham quan",
      allow:
        authUser?.role === "admin" ||
        authUser?.permissions?.includes("bookings"),
    },
    {
      key: "orders",
      label: "Đơn hàng",
      icon: "🧾",
      description: "Quản lý đơn mua / thuê",
      allow:
        authUser?.role === "admin" || authUser?.permissions?.includes("orders"),
    },
    {
      key: "users",
      label: "Người dùng",
      icon: "👤",
      description: "Phân quyền tài khoản",
      allow: authUser?.role === "admin",
    },
  ];

  const validateTreeId = (id: string, category: string) => {
    const value = id.trim().toUpperCase();
    if (!value) return "Vui lòng nhập mã cây";
    const prefix = category === "Mai Bonsai" ? "BS" : "T";
    const regex = new RegExp(`^${prefix}\\d+[A-Z0-9]*$`);
    if (!regex.test(value)) {
      return `Sai định dạng. ${prefix} + số + hậu tố (tuỳ chọn). VD: ${
        prefix === "BS" ? "BS01A" : "T12"
      }`;
    }
    return "";
  };

  const normalizeId = (val: string) => val.replace(/\s+/g, "").toUpperCase();

  const isDuplicateId = (id: string) => {
    const normalizedInput = normalizeId(id);
    return products.some((p) => {
      const productId = normalizeId(p.id || "");
      return (
        productId === normalizedInput &&
        normalizeId(p.id || "") !== normalizeId(selectedProduct?.id || "")
      );
    });
  };

  const validateNumber = (value: string, field: string) => {
    if (!value) return "";
    if (field === "hoanh") {
      if (!/^\d+$/.test(value)) {
        return "Hoành phải là số nguyên (cm)";
      }
    } else {
      if (!/^\d+(,\d+)?$/.test(value)) {
        return "Chỉ được nhập số (dùng dấu phẩy nếu có thập phân)";
      }
    }
    return "";
  };

  const renderHeaderTitle = () => {
    switch (activeTab) {
      case "products":
        return {
          title: "Quản lý sản phẩm",
          subtitle:
            "Xem, thêm, sửa, xóa cây mai trong hai nhóm Mai Bonsai và Mai Tàng.",
        };
      case "bookings":
        return {
          title: "Quản lý đặt lịch",
          subtitle:
            "Theo dõi các lịch hẹn tham quan, cập nhật trạng thái xử lý.",
        };
      case "orders":
        return {
          title: "Quản lý đơn hàng",
          subtitle: "Theo dõi đơn mua, thuê, thanh toán và công nợ.",
        };
      case "users":
        return {
          title: "Quản lý người dùng",
          subtitle: "Xem thông tin tài khoản đã đăng ký trong hệ thống.",
        };
      default:
        return {
          title: "Admin",
          subtitle: "Trang quản trị hệ thống.",
        };
    }
  };

  const headerInfo = renderHeaderTitle();

  const handleUpdateProduct = async () => {
    try {
      const id = formData.id.trim().toUpperCase();
      if (!id) {
        showToast("Vui lòng nhập mã cây", "error");
        return;
      }
      const idErrorCheck = validateTreeId(id, formData.category);
      if (idErrorCheck) {
        showToast(idErrorCheck, "error");
        return;
      }
      if (isDuplicateId(id)) {
        showToast("Mã cây đã tồn tại", "error");
        return;
      }

      // BƯỚC 5: chặn trạng thái sai
      if (formData.daBan && formData.daThue) {
        showToast("Không thể vừa bán vừa cho thuê", "error");
        return;
      }

      let fileData = "";
      if (productImageFile) {
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(productImageFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
      }

      await updateProductApi({
        originalId: selectedProduct?.id || id,
        id,
        category: formData.category,
        rentPrice: formData.rentPrice,
        price: formData.price,
        height: formData.height,
        width: formData.width,
        hoanh: formData.hoanh,
        chau: formData.chau,
        note: formData.note,
        daThue: formData.daThue && !formData.daBan,
        daBan: formData.daBan,
        fileData,
      });

      const optimisticProduct = buildOptimisticProduct(
        { ...formData, id },
        previewImage || selectedProduct?.image || null,
      );
      const nextBase = products.filter(
        (item) =>
          normalizeId(item.id || "") !== normalizeId(selectedProduct?.id || id),
      );
      const nextProducts = matchesProductsType(
        optimisticProduct.category,
        productsType,
      )
        ? [optimisticProduct, ...nextBase]
        : nextBase;

      commitOptimisticProducts(nextProducts, { resetPage: false });
      showToast("Cập nhật thành công", "success");
      setShowModal(false);
      setSelectedProduct(null);
      setProductImageFile(null);
      setPreviewImage(null);
      void refreshProducts({
        force: true,
        silent: true,
        resetPage: false,
      });
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối server", "error");
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "products":
        return (
          <ProductsTab
            loadingProducts={loadingProducts}
            stats={stats}
            searchTerm={searchTerm}
            onSearchTermChange={(value) => {
              setSearchTerm(value);
              setCurrentPage(1);
            }}
            productsType={productsType}
            onProductsTypeChange={(value) => {
              setProductsType(value);
              setCurrentPage(1);
            }}
            onOpenCreate={() => {
              setModalMode("create");
              setSelectedProduct(null);
              setFormData({
                id: "",
                category: "Mai Bonsai",
                rentPrice: "",
                price: "",
                height: "",
                width: "",
                hoanh: "",
                chau: "",
                note: "",
                daThue: false,
                daBan: false,
              });
              setProductImageFile(null);
              setPreviewImage(null);
              setIdError("");
              setIsIdTouched(false);
              setErrors({
                rentPrice: "",
                price: "",
                height: "",
                width: "",
                hoanh: "",
                chau: "",
              });
              setShowModal(true);
            }}
            filteredProducts={filteredProducts}
            paginatedProducts={paginatedProducts}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageInput={pageInput}
            onPageInputChange={setPageInput}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onOpenView={(product) => {
              setModalMode("view");
              setSelectedProduct(product);
              setShowModal(true);
            }}
            onOpenEdit={(product) => {
              setModalMode("edit");
              setSelectedProduct(product);
              setShowModal(true);
            }}
            onDelete={(product) => {
              showConfirm(`Xóa cây ${product.id}?`, async () => {
                try {
                  await deleteProduct(
                    product.id,
                    product.category === "Mai Bonsai" ? "BS" : "T",
                  );
                  const nextProducts = products.filter(
                    (item) =>
                      normalizeId(item.id || "") !==
                      normalizeId(product.id || ""),
                  );
                  commitOptimisticProducts(nextProducts, {
                    resetPage: false,
                  });
                  showToast("Đã xóa sản phẩm thành công", "success");
                  void refreshProducts({
                    force: true,
                    silent: true,
                    resetPage: false,
                  });
                } catch (err) {
                  console.error(err);
                  showToast("Lỗi kết nối server", "error");
                }
              });
            }}
          />
        );
      case "bookings":
        return (
          <BookingsTab
            bookingStats={bookingStats}
            bookingFilter={bookingFilter}
            onBookingFilterChange={setBookingFilter}
            filteredBookings={filteredBookings}
            paginatedBookings={paginatedBookings}
            bookingPage={bookingPage}
            setBookingPage={setBookingPage}
            bookingPageInput={bookingPageInput}
            onBookingPageInputChange={setBookingPageInput}
            totalBookingPages={totalBookingPages}
            itemsPerPage={itemsPerPage}
            onViewCancelledNote={(note) => {
              setSelectedBookingNote(note);
              setShowBookingNoteModal(true);
            }}
            onEditBookingNote={(booking) => {
              setEditingBooking(booking);
              setEditingBookingNote(booking.ghiChu || "");
            }}
            onConfirmBooking={async (booking) => {
              const previousBookings = [...bookings];
              const nextBookings = previousBookings.map((item) =>
                item.maDatLich === booking.maDatLich
                  ? {
                      ...item,
                      trangThai: "Đã xác nhận" as const,
                    }
                  : item,
              );
              commitOptimisticBookings(nextBookings);
              const ok = await updateBookingStatus(
                booking.maDatLich,
                "Đã xác nhận",
              );
              if (!ok) {
                commitOptimisticBookings(previousBookings);
                showToast("Xác nhận thất bại", "error");
                return;
              }
              showToast("Đã xác nhận lịch", "success");
            }}
            onCancelBooking={(booking) => {
              setSelectedBooking(booking);
              setCancelReason("");
              setOtherReason("");
              setShowCancelModal(true);
            }}
          />
        );
      case "orders":
        return <OrdersTab />;
      case "users":
        return (
          <UsersTab
            userStats={userStats}
            userSearch={userSearch}
            onUserSearchChange={setUserSearch}
            filteredUsers={filteredUsers}
            paginatedUsers={paginatedUsers}
            userPage={userPage}
            setUserPage={setUserPage}
            userPageInput={userPageInput}
            onUserPageInputChange={setUserPageInput}
            totalUserPages={totalUserPages}
            itemsPerPage={itemsPerPage}
            onOpenPermission={(user) => {
              setUserSearch("");
              setSelectedUser(user);
              setSelectedPermissions(user.permissions || []);
              setSelectedRole(user.role === "admin" ? "admin" : "user");
              setAdminPassword("");
              setShowPermissionModal(true);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bg-slate-900 text-white px-5 py-6">
          <div className="mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center text-xl font-bold">
                A
              </div>
              <div>
                <h1 className="text-lg font-bold">Admin Vườn Mai</h1>
                <p className="text-sm text-slate-300">Bản quản trị v1</p>
              </div>
            </div>
          </div>
          <div className="mb-6 rounded-2xl bg-white/10 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-300 mb-2">
              Đăng nhập
            </p>
            <p className="font-semibold text-white">
              {authUser?.name || "Admin"}
            </p>
            <p className="text-sm text-slate-300 break-all">
              {authUser?.email || "admin"}
            </p>
          </div>
          <nav className="space-y-2">
            {sidebarItems
              .filter((item) => item.allow)
              .map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (containerRef.current) {
                        scrollPositionsRef.current[activeTab] =
                          containerRef.current.scrollTop;
                      }
                      onChangeTab(item.key);
                    }}
                    className={`w-full text-left rounded-2xl px-4 py-4 transition ${
                      isActive
                        ? "bg-amber-400 text-amber-950"
                        : "bg-white/5 hover:bg-white/10 text-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none">{item.icon}</span>
                      <div className="min-w-0">
                        <div className="font-bold">{item.label}</div>
                        <div
                          className={`text-sm mt-1 ${
                            isActive ? "text-amber-900/80" : "text-slate-300"
                          }`}
                        >
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
          </nav>
          <div className="mt-8">
            <button
              type="button"
              onClick={onBackToSite}
              className="w-full h-11 rounded-xl border border-white/15 text-white hover:bg-white/10 transition"
            >
              ← Quay lại website
            </button>
          </div>
        </aside>

        {/* Main content với ref và scroll */}
        <main
          ref={containerRef}
          className="px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto h-screen"
        >
          {loadingAdminTab && (
            <div className="fixed inset-0 z-[70] bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-slate-700">
                  Đang tải dữ liệu...
                </span>
              </div>
            </div>
          )}

          <header className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {headerInfo.title}
                </h2>
                <p className="text-slate-500 mt-2 max-w-3xl">
                  {headerInfo.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-900 px-4 py-2 text-sm font-medium">
                  <span>●</span>
                  Admin v1
                </div>
              </div>
            </div>
          </header>

          {renderTabContent()}

          {/* Modal tạo/sửa/xem sản phẩm */}
          {showModal && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-hidden p-4"
              onClick={() => setShowModal(false)}
            >
              <div
                className="bg-white w-full max-w-2xl rounded-2xl shadow-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="max-h-[90vh] overflow-y-auto px-6 pb-6 pt-0">
                  <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-white shadow-sm">
                    <h2 className="text-xl font-bold">
                      {modalMode === "create"
                        ? "Tạo cây mới"
                        : modalMode === "edit"
                          ? "Sửa sản phẩm"
                          : "Xem chi tiết sản phẩm"}
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <input
                        placeholder="Mã cây (VD: BS01A, T12)"
                        className={`border p-2 rounded outline-none transition ${
                          idError && isIdTouched
                            ? "border-red-500 focus:ring-2 focus:ring-red-200"
                            : "focus:ring-2 focus:ring-amber-400"
                        }`}
                        value={formData.id}
                        onFocus={() => setIsIdTouched(true)}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setFormData({ ...formData, id: value });
                          let err = validateTreeId(value, formData.category);
                          if (!err && isDuplicateId(value)) {
                            err = "Mã cây đã tồn tại";
                          }
                          setIdError(err);
                        }}
                        disabled={modalMode === "view" || modalMode === "edit"}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Quy chuẩn: TYPE + số + hậu tố.
                        {formData.category === "Mai Bonsai"
                          ? " TYPE = BS (VD: BS01A, BS12)"
                          : " TYPE = T (VD: T01, T03NHATRANG)"}
                      </p>
                      {idError && (
                        <p className="text-xs text-red-500 mt-1">{idError}</p>
                      )}
                    </div>
                    <select
                      className="border p-2 rounded"
                      value={formData.category}
                      onChange={(e) => {
                        const newCategory = e.target.value;
                        const id = formData.id;
                        setFormData({ ...formData, category: newCategory });
                        let err = validateTreeId(id, newCategory);
                        if (!err && isDuplicateId(id)) {
                          err = "Mã cây đã tồn tại";
                        }
                        setIdError(err);
                      }}
                      disabled={modalMode === "view"}
                    >
                      <option>Mai Bonsai</option>
                      <option>Mai Tàng</option>
                    </select>

                    <div className="flex flex-col">
                      <input
                        placeholder="Giá thuê (triệu)"
                        className={`border p-2 rounded outline-none ${
                          errors.rentPrice
                            ? "border-red-500 focus:ring-2 focus:ring-red-200"
                            : "focus:ring-2 focus:ring-amber-400"
                        }`}
                        value={formData.rentPrice}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d,]/g, "");
                          setFormData({ ...formData, rentPrice: val });
                          const err = validateNumber(val, "rentPrice");
                          setErrors((prev) => ({ ...prev, rentPrice: err }));
                        }}
                        disabled={modalMode === "view"}
                      />
                      {errors.rentPrice && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.rentPrice}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <input
                        placeholder="Giá bán (triệu)"
                        className={`border p-2 rounded outline-none ${
                          errors.price
                            ? "border-red-500 focus:ring-2 focus:ring-red-200"
                            : "focus:ring-2 focus:ring-amber-400"
                        }`}
                        value={formData.price}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d,]/g, "");
                          setFormData({ ...formData, price: val });
                          const err = validateNumber(val, "price");
                          setErrors((prev) => ({ ...prev, price: err }));
                        }}
                        disabled={modalMode === "view"}
                      />
                      {errors.price && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.price}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <input
                        placeholder="Chiều cao (m)"
                        className={`border p-2 rounded outline-none ${
                          errors.height
                            ? "border-red-500 focus:ring-2 focus:ring-red-200"
                            : "focus:ring-2 focus:ring-amber-400"
                        }`}
                        value={formData.height}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d,]/g, "");
                          setFormData({ ...formData, height: val });
                          const err = validateNumber(val, "height");
                          setErrors((prev) => ({ ...prev, height: err }));
                        }}
                        disabled={modalMode === "view"}
                      />
                      {errors.height && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.height}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <input
                        placeholder="Ngang (m)"
                        className={`border p-2 rounded outline-none ${
                          errors.width
                            ? "border-red-500 focus:ring-2 focus:ring-red-200"
                            : "focus:ring-2 focus:ring-amber-400"
                        }`}
                        value={formData.width}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d,]/g, "");
                          setFormData({ ...formData, width: val });
                          const err = validateNumber(val, "width");
                          setErrors((prev) => ({ ...prev, width: err }));
                        }}
                        disabled={modalMode === "view"}
                      />
                      {errors.width && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.width}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <input
                        placeholder="Hoành (cm)"
                        className={`border p-2 rounded outline-none ${
                          errors.hoanh
                            ? "border-red-500 focus:ring-2 focus:ring-red-200"
                            : "focus:ring-2 focus:ring-amber-400"
                        }`}
                        value={formData.hoanh}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d]/g, "");
                          setFormData({ ...formData, hoanh: val });
                          const err = validateNumber(val, "hoanh");
                          setErrors((prev) => ({ ...prev, hoanh: err }));
                        }}
                        disabled={modalMode === "view"}
                      />
                      {errors.hoanh && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.hoanh}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <input
                        placeholder="Chậu (m)"
                        className={`border p-2 rounded outline-none ${
                          errors.chau
                            ? "border-red-500 focus:ring-2 focus:ring-red-200"
                            : "focus:ring-2 focus:ring-amber-400"
                        }`}
                        value={formData.chau}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d,]/g, "");
                          setFormData({ ...formData, chau: val });
                          const err = validateNumber(val, "chau");
                          setErrors((prev) => ({ ...prev, chau: err }));
                        }}
                        disabled={modalMode === "view"}
                      />
                      {errors.chau && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.chau}
                        </p>
                      )}
                    </div>
                    <textarea
                      placeholder="Ghi chú hiển thị"
                      className="border p-2 rounded col-span-2"
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                      disabled={modalMode === "view"}
                    />
                  </div>

                  <div className="mt-4 pt-4">
                    <p className="text-sm font-semibold text-slate-700 mb-3">
                      Thông tin nâng cao
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className={`col-span-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition
                          ${
                            isDragging
                              ? "border-amber-400 bg-amber-50 scale-[1.02]"
                              : "border-slate-300 bg-slate-50 hover:bg-slate-100"
                          }`}
                        onClick={() =>
                          modalMode !== "view" && fileInputRef.current?.click()
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (modalMode === "view") return;
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          if (modalMode === "view") return;
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            setProductImageFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setPreviewImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (modalMode === "view") return;
                            const file = e.target.files?.[0] || null;
                            setProductImageFile(file);
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setPreviewImage(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        {modalMode === "edit" && (
                          <p className="text-sm text-slate-500 mb-2">
                            Kéo thả ảnh vào đây hoặc bấm để chọn ảnh
                          </p>
                        )}
                        {previewImage ? (
                          <div className="mt-3">
                            <img
                              src={previewImage}
                              alt="preview"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (modalMode === "view") {
                                  setFullImage(previewImage);
                                }
                              }}
                              className={`w-full h-40 object-cover rounded-lg border hover:opacity-90 transition ${
                                modalMode === "view"
                                  ? "cursor-zoom-in"
                                  : "cursor-pointer"
                              }`}
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-1">
                            Hỗ trợ JPG, PNG, JPEG,... (dùng ảnh thật để hiển thị
                            tốt hơn)
                          </p>
                        )}
                      </div>

                      {/* BƯỚC 3: Checkbox đã được thay thế logic chống trùng */}
                      <label className="flex items-center gap-2 h-11">
                        <input
                          type="checkbox"
                          checked={formData.daThue}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData({
                              ...formData,
                              daThue: checked,
                              daBan: checked ? false : formData.daBan,
                            });
                          }}
                          disabled={modalMode === "view"}
                        />
                        Đã thuê
                      </label>
                      <label className="flex items-center gap-2 h-11">
                        <input
                          type="checkbox"
                          checked={formData.daBan}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData({
                              ...formData,
                              daBan: checked,
                              daThue: checked ? false : formData.daThue,
                            });
                          }}
                          disabled={modalMode === "view"}
                        />
                        Đã bán
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setProductImageFile(null);
                        setPreviewImage(null);
                        setSelectedProduct(null);
                        setIdError("");
                        setIsIdTouched(false);
                        setErrors({
                          rentPrice: "",
                          price: "",
                          height: "",
                          width: "",
                          hoanh: "",
                          chau: "",
                        });
                      }}
                      className="px-4 py-2 border rounded-lg"
                    >
                      Đóng
                    </button>
                    {modalMode !== "view" &&
                      (() => {
                        const isFormValid =
                          formData.id.trim() !== "" &&
                          !validateTreeId(formData.id, formData.category) &&
                          !isDuplicateId(formData.id) &&
                          !Object.values(errors).some((e) => e !== "");

                        return (
                          <button
                            onClick={async () => {
                              if (modalMode === "edit") {
                                handleUpdateProduct();
                                return;
                              }

                              // BƯỚC 5: chặn trạng thái sai khi tạo mới
                              if (formData.daBan && formData.daThue) {
                                showToast(
                                  "Không thể vừa bán vừa cho thuê",
                                  "error",
                                );
                                return;
                              }

                              try {
                                const id = formData.id.trim().toUpperCase();
                                const idErrorCheck = validateTreeId(
                                  id,
                                  formData.category,
                                );
                                if (idErrorCheck) {
                                  showToast(idErrorCheck, "error");
                                  return;
                                }
                                if (isDuplicateId(id)) {
                                  showToast("Mã cây đã tồn tại", "error");
                                  return;
                                }

                                let fileData = "";
                                if (productImageFile) {
                                  fileData = await new Promise<string>(
                                    (resolve, reject) => {
                                      const reader = new FileReader();
                                      reader.readAsDataURL(productImageFile);
                                      reader.onload = () =>
                                        resolve(reader.result as string);
                                      reader.onerror = reject;
                                    },
                                  );
                                }

                                await createProduct({
                                  ...formData,
                                  id,
                                  daThue: formData.daThue && !formData.daBan,
                                  daBan: formData.daBan,
                                  fileData,
                                });

                                const optimisticProduct =
                                  buildOptimisticProduct(
                                    { ...formData, id },
                                    previewImage || null,
                                  );
                                const nextProducts = matchesProductsType(
                                  optimisticProduct.category,
                                  productsType,
                                )
                                  ? [
                                      optimisticProduct,
                                      ...products.filter(
                                        (item) =>
                                          normalizeId(item.id || "") !==
                                          normalizeId(
                                            optimisticProduct.id || "",
                                          ),
                                      ),
                                    ]
                                  : products;

                                commitOptimisticProducts(nextProducts);
                                setShowModal(false);
                                setProductImageFile(null);
                                setPreviewImage(null);
                                setIdError("");
                                setIsIdTouched(false);
                                setErrors({
                                  rentPrice: "",
                                  price: "",
                                  height: "",
                                  width: "",
                                  hoanh: "",
                                  chau: "",
                                });
                                showToast("Tạo sản phẩm thành công", "success");
                                void refreshProducts({
                                  force: true,
                                  silent: true,
                                  resetPage: false,
                                });
                              } catch (err) {
                                console.error(err);
                                showToast("Lỗi kết nối server", "error");
                              }
                            }}
                            disabled={!isFormValid}
                            className={`px-4 py-2 rounded-lg font-bold ${
                              !isFormValid
                                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                : "bg-amber-400"
                            }`}
                          >
                            {modalMode === "edit" ? "Cập nhật" : "Lưu"}
                          </button>
                        );
                      })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Các modal khác giữ nguyên */}
          {showCancelModal && selectedBooking && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={() => {
                setShowCancelModal(false);
                setSelectedBooking(null);
                setCancelReason("");
                setOtherReason("");
              }}
            >
              <div
                className="bg-white rounded-xl p-6 w-[400px]"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold mb-4">Chọn lý do hủy</h2>
                <div className="space-y-2">
                  {[
                    "Khách không đến",
                    "Khách hủy",
                    "Trùng lịch",
                    "Thời tiết xấu",
                  ].map((reason) => (
                    <label key={reason} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason}
                        onChange={(e) => setCancelReason(e.target.value)}
                      />
                      {reason}
                    </label>
                  ))}
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="cancelReason"
                      value="Khác"
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                    Khác
                  </label>
                  {cancelReason === "Khác" && (
                    <input
                      type="text"
                      placeholder="Nhập lý do..."
                      className="w-full border rounded px-3 py-2 mt-2"
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                    />
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setSelectedBooking(null);
                      setCancelReason("");
                      setOtherReason("");
                    }}
                    className="px-4 py-2 bg-slate-100 rounded"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={async () => {
                      const rawReason =
                        cancelReason === "Khác"
                          ? otherReason.trim()
                          : cancelReason.trim();
                      if (!rawReason) {
                        showToast("Vui lòng chọn hoặc nhập lý do hủy", "error");
                        return;
                      }
                      const finalReason = `${rawReason}`;
                      const previousBookings = [...bookings];
                      const nextBookings = previousBookings.map((item) =>
                        item.maDatLich === selectedBooking.maDatLich
                          ? {
                              ...item,
                              trangThai: "Đã hủy" as const,
                              ghiChu: `🔴 LÝ DO HỦY: ${finalReason}`,
                            }
                          : item,
                      );
                      commitOptimisticBookings(nextBookings);
                      const ok = await updateBookingStatus(
                        selectedBooking.maDatLich,
                        "Đã hủy",
                        finalReason,
                      );
                      if (!ok) {
                        commitOptimisticBookings(previousBookings);
                        showToast("Hủy lịch thất bại", "error");
                        return;
                      }
                      showToast("Đã hủy lịch", "success");
                      setShowCancelModal(false);
                      setSelectedBooking(null);
                      setCancelReason("");
                      setOtherReason("");
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded"
                  >
                    Xác nhận hủy
                  </button>
                </div>
              </div>
            </div>
          )}

          {showBookingNoteModal && (
            <div
              className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
              onClick={() => setShowBookingNoteModal(false)}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">
                    Chi tiết ghi chú / lý do hủy
                  </h3>
                </div>
                <div className="px-5 py-4">
                  <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-700 leading-6">
                    {selectedBookingNote || "-"}
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowBookingNoteModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingBooking && (
            <div
              className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
              onClick={() => {
                setEditingBooking(null);
                setEditingBookingNote("");
              }}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">
                    Chỉnh sửa ghi chú
                  </h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm text-slate-500">
                    Mã lịch:{" "}
                    <span className="font-medium text-slate-700">
                      {editingBooking.maDatLich}
                    </span>
                  </p>
                  <textarea
                    value={editingBookingNote}
                    onChange={(e) => setEditingBookingNote(e.target.value)}
                    placeholder="Nhập ghi chú..."
                    className="w-full min-h-[140px] rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBooking(null);
                      setEditingBookingNote("");
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingBooking?.maDatLich) {
                        showToast(
                          "Không tìm thấy mã lịch để cập nhật",
                          "error",
                        );
                        return;
                      }
                      const targetBookingId = editingBooking.maDatLich;
                      const previousBookings = [...bookings];
                      const nextBookings = previousBookings.map((item) =>
                        item.maDatLich === targetBookingId
                          ? { ...item, ghiChu: editingBookingNote }
                          : item,
                      );
                      commitOptimisticBookings(nextBookings);
                      setEditingBooking(null);
                      setEditingBookingNote("");
                      const ok = await updateBookingNote(
                        targetBookingId,
                        editingBookingNote,
                      );
                      if (!ok) {
                        commitOptimisticBookings(previousBookings);
                        showToast("Lưu ghi chú thất bại", "error");
                        return;
                      }
                      showToast("Đã lưu ghi chú", "success");
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-amber-950 font-medium"
                  >
                    Lưu ghi chú
                  </button>
                </div>
              </div>
            </div>
          )}

          {fullImage && (
            <div
              className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
              onClick={() => setFullImage(null)}
            >
              <img
                src={fullImage}
                alt="full"
                className="max-w-full max-h-full rounded-lg shadow-xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {showPermissionModal && selectedUser && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={() => {
                setShowPermissionModal(false);
                setSelectedUser(null);
              }}
            >
              <div
                className="bg-white rounded-xl p-6 w-[420px] space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold">Phân quyền người dùng</h2>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Vai trò
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) =>
                      setSelectedRole(
                        e.target.value === "admin" ? "admin" : "user",
                      )
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {USER_PERMISSION_OPTIONS.map((permissionOption) => (
                    <label
                      key={permissionOption.value}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(
                          permissionOption.value,
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions((prev) =>
                              prev.includes(permissionOption.value)
                                ? prev
                                : [...prev, permissionOption.value],
                            );
                          } else {
                            setSelectedPermissions((prev) =>
                              prev.filter(
                                (permission) =>
                                  permission !== permissionOption.value,
                              ),
                            );
                          }
                        }}
                      />
                      {permissionOption.label}
                    </label>
                  ))}
                </div>
                <input
                  type="password"
                  name="admin-confirm-password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Nhập mật khẩu admin..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowPermissionModal(false);
                      setSelectedUser(null);
                    }}
                    className="px-4 py-2 bg-slate-100 rounded"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      if (!adminPassword) {
                        showToast("Nhập mật khẩu admin", "error");
                        return;
                      }
                      const ok = await verifyAdminPassword(
                        authUser?.email || "",
                        adminPassword,
                      );
                      if (!ok) {
                        showToast("Sai mật khẩu admin", "error");
                        return;
                      }
                      const success = await updateUserPermissions({
                        adminEmail: authUser?.email || "",
                        adminPassword,
                        targetEmail: selectedUser.email,
                        role: selectedRole,
                        permissions: selectedPermissions,
                      });
                      if (!success) {
                        showToast("Cập nhật thất bại", "error");
                        return;
                      }
                      const nextUsers = users.map((user) =>
                        user.email === selectedUser.email
                          ? {
                              ...user,
                              role: selectedRole,
                              permissions: [...selectedPermissions],
                            }
                          : user,
                      );
                      commitOptimisticUsers(nextUsers);
                      showToast("Đã cập nhật quyền", "success");
                      setShowPermissionModal(false);
                      setSelectedUser(null);
                    }}
                    className="px-4 py-2 bg-amber-400 rounded font-bold"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
