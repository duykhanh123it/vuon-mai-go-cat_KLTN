import React from "react";
import { AuthUser, Booking } from "../types";
import {
  fetchProductsBundleRevalidateMapped,
  fetchBookings,
  updateBookingStatus,
  updateBookingNote,
  fetchUsers,
  verifyAdminPassword,
  updateUserPermissions,
} from "../utils/productsApi";
import type { Product } from "../types";
import { useToast } from "../components/Toast";

const formatPrice = (value: number | string | null | undefined) => {
  if (value == null || value === "") return "Liên hệ";
  const num =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return "Liên hệ";
  return (num * 1_000_000).toLocaleString("vi-VN") + "đ";
};

const RECENT_USER_DAYS = 7;

const DEFAULT_AVATAR_URLS = [
  "/no-avatar.png",
  "/no_avatar_fallback.png",
  "/avt.png",
];

const hasRealAvatar = (avatarUrl?: string | null) => {
  const value = String(avatarUrl || "").trim();
  if (!value) return false;

  const lower = value.toLowerCase();
  return !DEFAULT_AVATAR_URLS.some((item) =>
    lower.endsWith(item.toLowerCase()),
  );
};

const formatGender = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "--";

  const normalized = raw.toLowerCase();
  if (["nam", "male", "m"].includes(normalized)) return "Nam";
  if (["nữ", "nu", "female", "f"].includes(normalized)) return "Nữ";

  return raw;
};

type AdminTab = "products" | "bookings" | "users";

interface AdminProps {
  authUser?: AuthUser | null;
  onBackToSite?: () => void;
}

const Admin: React.FC<AdminProps> = ({ authUser, onBackToSite }) => {
  const { showToast, showConfirm, showPromise } = useToast();
  const [activeTab, setActiveTab] = React.useState<AdminTab>(() => {
    if (authUser?.role === "admin") return "products";
    if (authUser?.permissions?.includes("products")) return "products";
    if (authUser?.permissions?.includes("bookings")) return "bookings";
    return "products";
  });
  const [products, setProducts] = React.useState<Product[]>([]);
  const [bookings, setBookings] = React.useState<any[]>([]);
  // ✅ BƯỚC 2.1 — THÊM STATE
  const [users, setUsers] = React.useState<AuthUser[]>([]);

  // 🔴 BƯỚC 1: THÊM STATE MODAL
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<AuthUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = React.useState<
    string[]
  >([]);
  const [adminPassword, setAdminPassword] = React.useState("");

  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [selectedBooking, setSelectedBooking] = React.useState<any | null>(
    null,
  );
  const [cancelReason, setCancelReason] = React.useState("");
  const [otherReason, setOtherReason] = React.useState("");
  const [showBookingNoteModal, setShowBookingNoteModal] = React.useState(false);
  const [selectedBookingNote, setSelectedBookingNote] = React.useState("");
  const [editingBooking, setEditingBooking] = React.useState<any | null>(null);
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
  const itemsPerPage = 10;
  // Thêm state thống kê
  const [stats, setStats] = React.useState({
    total: 0,
    bonsai: 0,
    tang: 0,
  });
  const [showModal, setShowModal] = React.useState(false);
  React.useEffect(() => {
    const scrollBarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (showModal) {
      document.body.style.overflow = "hidden";
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = scrollBarWidth + "px";
      }
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [showModal]);
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
  // ✅ BƯỚC 1: Thêm state validate toàn form
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
  // Bonus: Đóng modal bằng phím ESC
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);
  // Khi mở modal edit hoặc view → đổ dữ liệu vào form
  React.useEffect(() => {
    if (!selectedProduct) return;
    setFormData({
      id: selectedProduct.id || "",
      category: selectedProduct.category || "Mai Bonsai",
      rentPrice:
        selectedProduct.rentPrice != null
          ? String(selectedProduct.rentPrice).replace(".", ",")
          : "",
      price:
        selectedProduct.price != null
          ? String(selectedProduct.price).replace(".", ",")
          : "",
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
      note: selectedProduct.description || "",
      daThue: selectedProduct.isRented || false,
      daBan: selectedProduct.isSold || false,
    });
    setPreviewImage(selectedProduct.image || null);
    setProductImageFile(null);
  }, [selectedProduct]);
  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);
  React.useEffect(() => {
    if (activeTab !== "products" || products.length > 0) return;
    const fetchData = async () => {
      try {
        setLoadingProducts(true);
        setLoadingAdminTab(true);
        const res = await fetchProductsBundleRevalidateMapped({
          type: productsType,
        });
        const data = res.products || [];
        const sortedData = [...data].sort((a, b) => {
          const getNum = (id: string) =>
            parseInt(id.replace(/[^\d]/g, "")) || 0;
          return getNum(b.id) - getNum(a.id);
        });
        setProducts(sortedData);
        setCurrentPage(1);
        const bonsaiCount = data.filter(
          (p: any) => p.category === "Mai Bonsai",
        ).length;
        const tangCount = data.filter(
          (p: any) => p.category === "Mai Tàng",
        ).length;
        setStats({
          total: data.length,
          bonsai: bonsaiCount,
          tang: tangCount,
        });
      } catch (err) {
        console.error("Load products error:", err);
      } finally {
        setLoadingProducts(false);
        setLoadingAdminTab(false);
      }
    };
    fetchData();
  }, [activeTab, productsType]);
  // Load Booking
  React.useEffect(() => {
    if (activeTab !== "bookings" || bookings.length > 0) return;
    (async () => {
      try {
        setLoadingAdminTab(true);
        const data = await fetchBookings();
        setBookings(data);
      } catch (err) {
        console.error("Load bookings error:", err);
        showToast("Không tải được dữ liệu đặt lịch", "error");
      } finally {
        setLoadingAdminTab(false);
      }
    })();
  }, [activeTab]);
  // Load Users
  React.useEffect(() => {
    if (activeTab !== "users" || users.length > 0) return;
    (async () => {
      try {
        setLoadingAdminTab(true);
        const data = await fetchUsers();
        setUsers(data);
      } catch (err) {
        console.error("Load users error:", err);
        showToast("Không tải được user", "error");
      } finally {
        setLoadingAdminTab(false);
      }
    })();
  }, [activeTab]);
  const filteredProducts = products.filter((p) =>
    p.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const bookingStats = React.useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.trangThai === "Mới").length;
    const confirmed = bookings.filter(
      (b) => b.trangThai === "Đã xác nhận",
    ).length;
    return { total, pending, confirmed };
  }, [bookings]);
  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === "Tất cả") return true;
    return b.trangThai === bookingFilter;
  });
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
      key: "users",
      label: "Người dùng",
      icon: "👤",
      description: "Phân quyền tài khoản",
      allow: authUser?.role === "admin", // chỉ admin thấy
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
      const res = await fetch(
        `${import.meta.env.VITE_PRODUCTS_API_BASE}?api=updateProduct`,
        {
          method: "POST",
          body: JSON.stringify({
            api: "updateProduct",
            id,
            category: formData.category,
            rentPrice: formData.rentPrice,
            price: formData.price,
            height: formData.height,
            width: formData.width,
            hoanh: formData.hoanh,
            chau: formData.chau,
            note: formData.note,
            daThue: formData.daThue,
            daBan: formData.daBan,
          }),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        showToast(
          "Lỗi: " + (data.error || data.message || "Không cập nhật được"),
          "error",
        );
        return;
      }
      showToast("Cập nhật thành công", "success");
      setShowModal(false);
      setSelectedProduct(null);
      setProductImageFile(null);
      setPreviewImage(null);
      const resReload = await fetchProductsBundleRevalidateMapped({
        type: productsType,
      });
      const productsReloaded = resReload.products || [];
      const sortedData = [...productsReloaded].sort((a, b) => {
        const getNum = (id: string) => parseInt(id.replace(/[^\d]/g, "")) || 0;
        return getNum(b.id) - getNum(a.id);
      });
      setProducts(sortedData);
      const bonsaiCount = productsReloaded.filter(
        (p: any) => p.category === "Mai Bonsai",
      ).length;
      const tangCount = productsReloaded.filter(
        (p: any) => p.category === "Mai Tàng",
      ).length;
      setStats({
        total: productsReloaded.length,
        bonsai: bonsaiCount,
        tang: tangCount,
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Tổng sản phẩm"
                value={loadingProducts ? "..." : String(stats.total)}
                note="Dữ liệu từ Google Sheet"
              />
              <StatCard
                title="Mai Bonsai"
                value={loadingProducts ? "..." : String(stats.bonsai)}
                note="Sheet: MaiBonSai"
              />
              <StatCard
                title="Mai Tàng"
                value={loadingProducts ? "..." : String(stats.tang)}
                note="Sheet: MaiTang"
              />
            </div>
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Danh sách sản phẩm
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Dữ liệu được kết nối từ Google Sheet.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Tìm mã cây (VD: BS01...)"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <select
                    className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    value={productsType}
                    onChange={(e) => {
                      setProductsType(e.target.value as any);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All">Tất cả nhóm</option>
                    <option value="BS">Mai Bonsai</option>
                    <option value="T">Mai Tàng</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
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
                    className="h-11 px-5 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold transition-all active:scale-[0.99]"
                  >
                    + Tạo cây mới
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left">
                      <Th>STT</Th>
                      <Th>Mã cây</Th>
                      <Th>Nhóm</Th>
                      <Th>Giá thuê</Th>
                      <Th>Giá bán</Th>
                      <Th>Trạng thái</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingProducts ? (
                      <tr>
                        <Td colSpan={7}>Đang tải dữ liệu...</Td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <Td colSpan={7}>
                          {searchTerm
                            ? "Không tìm thấy sản phẩm nào khớp với từ khóa"
                            : "Không có dữ liệu"}
                        </Td>
                      </tr>
                    ) : (
                      paginatedProducts.map((p, index) => {
                        return (
                          <tr key={p.id}>
                            <Td>
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </Td>
                            <Td>{p.id}</Td>
                            <Td>{p.category}</Td>
                            <Td>{formatPrice(p.rentPrice)}</Td>
                            <Td>{formatPrice(p.price)}</Td>
                            <Td>
                              <div className="flex flex-wrap gap-2">
                                {p.isSold ? (
                                  <Badge text="Đã bán" tone="red" />
                                ) : p.isRented ? (
                                  <Badge text="Đã thuê" tone="amber" />
                                ) : (
                                  <Badge text="Đang trống" tone="green" />
                                )}
                              </div>
                            </Td>
                            <Td className="text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalMode("view");
                                    setSelectedProduct(p);
                                    setShowModal(true);
                                  }}
                                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                                >
                                  Xem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalMode("edit");
                                    setSelectedProduct(p);
                                    setShowModal(true);
                                  }}
                                  className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-800 hover:bg-amber-50 transition"
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    showConfirm(
                                      `Xóa cây ${p.id}?`,
                                      async () => {
                                        try {
                                          const res = await fetch(
                                            `${import.meta.env.VITE_PRODUCTS_API_BASE}?api=deleteProduct`,
                                            {
                                              method: "POST",
                                              body: JSON.stringify({
                                                api: "deleteProduct",
                                                id: p.id,
                                                category:
                                                  p.category === "Mai Bonsai"
                                                    ? "BS"
                                                    : "T",
                                              }),
                                            },
                                          );
                                          const data = await res.json();
                                          if (!data.ok) {
                                            showToast(
                                              "Lỗi: " +
                                                (data.error ||
                                                  "Không xóa được sản phẩm"),
                                              "error",
                                            );
                                            return;
                                          }
                                          showToast(
                                            "Đã xóa sản phẩm thành công",
                                            "success",
                                          );
                                          const resReload =
                                            await fetchProductsBundleRevalidateMapped(
                                              {
                                                type: productsType,
                                              },
                                            );
                                          const productsReloaded =
                                            resReload.products || [];
                                          const sortedData = [
                                            ...productsReloaded,
                                          ].sort((a, b) => {
                                            const getNum = (id: string) =>
                                              parseInt(
                                                id.replace(/[^\d]/g, ""),
                                              ) || 0;
                                            return getNum(b.id) - getNum(a.id);
                                          });
                                          setProducts(sortedData);
                                          const bonsaiCount =
                                            productsReloaded.filter(
                                              (x: any) =>
                                                x.category === "Mai Bonsai",
                                            ).length;
                                          const tangCount =
                                            productsReloaded.filter(
                                              (x: any) =>
                                                x.category === "Mai Tàng",
                                            ).length;
                                          setStats({
                                            total: productsReloaded.length,
                                            bonsai: bonsaiCount,
                                            tang: tangCount,
                                          });
                                        } catch (err) {
                                          console.error(err);
                                          showToast(
                                            "Lỗi kết nối server",
                                            "error",
                                          );
                                        }
                                      },
                                    );
                                  }}
                                  className="px-3 py-2 rounded-lg border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50 transition"
                                >
                                  Xóa
                                </button>
                              </div>
                            </Td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
                >
                  ←
                </button>
                <div className="px-4 py-2 rounded-xl bg-slate-100 flex items-center gap-2">
                  Trang
                  <input
                    type="number"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        let page = Number(pageInput);
                        if (!page || page < 1) page = 1;
                        if (page > totalPages) page = totalPages;
                        setCurrentPage(page);
                      }
                    }}
                    className="w-16 px-2 py-1 border rounded text-center outline-none"
                  />
                  / {totalPages || 1}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages || 1, p + 1))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
                >
                  →
                </button>
              </div>
            </section>
          </div>
        );
      case "bookings":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Tổng lịch hẹn"
                value={String(bookingStats.total)}
                note="Sheet: DatLich"
              />
              <StatCard
                title="Chờ xử lý"
                value={String(bookingStats.pending)}
                note="Trạng thái mới"
              />
              <StatCard
                title="Đã xác nhận"
                value={String(bookingStats.confirmed)}
                note="Sẽ nối API sau"
              />
            </div>
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Danh sách đặt lịch
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Tạm hiển thị dữ liệu mẫu để hoàn thiện layout quản trị.
                  </p>
                </div>
                <select
                  className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value)}
                >
                  <option value="Tất cả">Tất cả trạng thái</option>
                  <option value="Mới">Mới</option>
                  <option value="Đã xác nhận">Đã xác nhận</option>
                  <option value="Đã hủy">Đã hủy</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left">
                      <Th>Mã lịch</Th>
                      <Th>Khách hàng</Th>
                      <Th>Ngày tham quan</Th>
                      <Th>Giờ hẹn</Th>
                      <Th>Trạng thái</Th>
                      <Th>Ghi chú</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((b) => (
                      <tr key={b.maDatLich}>
                        <Td>{b.maDatLich}</Td>
                        <Td>{b.hoTen}</Td>
                        <Td>{b.ngayThamQuan}</Td>
                        <Td>{b.gioHen}</Td>
                        <Td>
                          <span
                            className={`inline-block whitespace-nowrap px-3 py-1 text-xs rounded-full font-medium
                              ${
                                b.trangThai === "Đã xác nhận"
                                  ? "bg-green-100 text-green-700"
                                  : b.trangThai === "Đã hủy"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                              }
                            `}
                          >
                            {b.trangThai}
                          </span>
                        </Td>
                        <td className="text-sm text-slate-600">
                          {b.trangThai === "Đã hủy" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBookingNote(b.ghiChu || "");
                                setShowBookingNoteModal(true);
                              }}
                              className="max-w-[220px] truncate text-left text-red-600 font-medium hover:underline"
                              title="Bấm để xem đầy đủ lý do hủy"
                            >
                              {b.ghiChu || "-"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBooking(b);
                                setEditingBookingNote(b.ghiChu || "");
                              }}
                              className={`max-w-[220px] truncate text-left hover:underline ${
                                b.ghiChu ? "text-slate-700" : "text-slate-400"
                              }`}
                              title="Bấm để sửa ghi chú"
                            >
                              {b.ghiChu || "-"}
                            </button>
                          )}
                        </td>
                        <Td className="text-right">
                          {b.trangThai === "Mới" && (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={async () => {
                                  await showPromise(
                                    updateBookingStatus(
                                      b.maDatLich,
                                      "Đã xác nhận",
                                    ),
                                    {
                                      loading: "Đang xác nhận...",
                                      success: "Đã xác nhận lịch",
                                      error: "Thất bại",
                                    },
                                  );
                                  const data = await fetchBookings();
                                  setBookings(data);
                                }}
                                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded"
                              >
                                Xác nhận
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedBooking(b);
                                  setCancelReason("");
                                  setOtherReason("");
                                  setShowCancelModal(true);
                                }}
                                className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded"
                              >
                                Hủy
                              </button>
                            </div>
                          )}
                        </Td>
                      </tr>
                    ))}
                    {filteredBookings.length === 0 && (
                      <tr>
                        <Td
                          colSpan={7}
                          className="text-center py-8 text-slate-500"
                        >
                          Không có lịch hẹn nào
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        );
      case "users":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Tổng tài khoản"
                value={String(userStats.totalUsers)}
                note="Sheet: Users"
              />
              <StatCard
                title="Có avatar"
                value={String(userStats.avatarCount)}
                note="avatarUrl khác rỗng"
              />
              <StatCard
                title="Đăng ký gần đây"
                value={String(userStats.recentUsers)}
                note={`${userStats.recentDays} ngày gần nhất theo createdAt`}
              />
            </div>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Danh sách người dùng
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Hiển thị đầy đủ email, tên, số điện thoại và giới tính từ
                    sheet Users.
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Tìm theo email, tên, số điện thoại hoặc giới tính..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left">
                      <Th>Email</Th>
                      <Th>Họ tên</Th>
                      <Th>Số điện thoại</Th>
                      <Th>Giới tính</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <Td
                          colSpan={5}
                          className="text-center text-slate-500 py-8"
                        >
                          Không có người dùng phù hợp.
                        </Td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.email}>
                          <Td>{u.email}</Td>
                          <Td>{u.name || "--"}</Td>
                          <Td>{u.phone || "--"}</Td>
                          <Td>{formatGender(u.gender)}</Td>
                          <Td className="text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setSelectedPermissions(u.permissions || []);
                                setAdminPassword("");
                                setShowPermissionModal(true);
                              }}
                              className="px-3 py-2 rounded-lg border border-amber-300 text-sm text-amber-800"
                            >
                              Phân quyền
                            </button>
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
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
                    onClick={() => setActiveTab(item.key)}
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
        <main className="px-4 sm:px-6 lg:px-8 py-6">
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
                    {/* ID + CATEGORY */}
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
                    {/* Giá thuê */}
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
                    {/* Giá bán */}
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
                    {/* Chiều cao */}
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
                    {/* Ngang */}
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
                    {/* Hoành */}
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
                    {/* Chậu */}
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
                    {/* NOTE */}
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
                  {/* ADVANCED - Luôn hiển thị */}
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
                      <label className="flex items-center gap-2 h-11">
                        <input
                          type="checkbox"
                          checked={formData.daThue}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              daThue: e.target.checked,
                            })
                          }
                          disabled={modalMode === "view"}
                        />
                        Đã thuê
                      </label>
                      <label className="flex items-center gap-2 h-11">
                        <input
                          type="checkbox"
                          checked={formData.daBan}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              daBan: e.target.checked,
                            })
                          }
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
                                await showPromise(
                                  (async () => {
                                    let fileData = "";
                                    if (productImageFile) {
                                      fileData = await new Promise<string>(
                                        (resolve, reject) => {
                                          const reader = new FileReader();
                                          reader.readAsDataURL(
                                            productImageFile,
                                          );
                                          reader.onload = () =>
                                            resolve(reader.result as string);
                                          reader.onerror = reject;
                                        },
                                      );
                                    }
                                    const res = await fetch(
                                      `${import.meta.env.VITE_PRODUCTS_API_BASE}?api=createProduct`,
                                      {
                                        method: "POST",
                                        body: JSON.stringify({
                                          api: "createProduct",
                                          ...formData,
                                          id,
                                          fileData,
                                        }),
                                      },
                                    );
                                    const data = await res.json();
                                    if (!data.ok) {
                                      throw new Error(
                                        data.error || "Tạo sản phẩm thất bại",
                                      );
                                    }
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
                                    const resReload =
                                      await fetchProductsBundleRevalidateMapped(
                                        {
                                          type: productsType,
                                        },
                                      );
                                    const productsReloaded =
                                      resReload.products || [];
                                    const sortedData = [
                                      ...productsReloaded,
                                    ].sort((a, b) => {
                                      const getNum = (id: string) =>
                                        parseInt(id.replace(/[^\d]/g, "")) || 0;
                                      return getNum(b.id) - getNum(a.id);
                                    });
                                    setProducts(sortedData);
                                    const bonsaiCount = productsReloaded.filter(
                                      (p: any) => p.category === "Mai Bonsai",
                                    ).length;
                                    const tangCount = productsReloaded.filter(
                                      (p: any) => p.category === "Mai Tàng",
                                    ).length;
                                    setStats({
                                      total: productsReloaded.length,
                                      bonsai: bonsaiCount,
                                      tang: tangCount,
                                    });
                                  })(),
                                  {
                                    loading: "Đang tạo sản phẩm...",
                                    success: "Tạo sản phẩm thành công",
                                    error: "Tạo sản phẩm thất bại",
                                  },
                                );
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
          {/* ✅ BƯỚC 2.3 — MODAL CHỌN LÝ DO HỦY */}
          {showCancelModal && selectedBooking && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-[400px]">
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
                      await showPromise(
                        updateBookingStatus(
                          selectedBooking.maDatLich,
                          "Đã hủy",
                          finalReason,
                        ),
                        {
                          loading: "Đang hủy...",
                          success: "Đã hủy lịch",
                          error: "Thất bại",
                        },
                      );
                      const data = await fetchBookings();
                      setBookings(data);
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
                      // NÂNG CẤP NHẸ - Cập nhật UI ngay lập tức
                      setBookings((prev) =>
                        prev.map((b) =>
                          b.maDatLich === editingBooking.maDatLich
                            ? { ...b, ghiChu: editingBookingNote }
                            : b,
                        ),
                      );
                      // Đóng modal ngay lập tức
                      setEditingBooking(null);
                      setEditingBookingNote("");
                      // Gọi API chạy ngầm
                      updateBookingNote(
                        editingBooking.maDatLich,
                        editingBookingNote,
                      )
                        .then(async () => {
                          const data = await fetchBookings();
                          setBookings(data);
                        })
                        .catch((err) => {
                          console.error("Update note error:", err);
                        });
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

          {/* 🔴 BƯỚC 3: THÊM MODAL PHÂN QUYỀN */}
          {showPermissionModal && selectedUser && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-[420px] space-y-4">
                <h2 className="text-lg font-semibold">Phân quyền người dùng</h2>

                <p className="text-sm text-slate-500">{selectedUser.email}</p>

                {/* Quyền */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes("products")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPermissions([
                            ...selectedPermissions,
                            "products",
                          ]);
                        } else {
                          setSelectedPermissions(
                            selectedPermissions.filter((p) => p !== "products"),
                          );
                        }
                      }}
                    />
                    Quản trị sản phẩm
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes("bookings")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPermissions([
                            ...selectedPermissions,
                            "bookings",
                          ]);
                        } else {
                          setSelectedPermissions(
                            selectedPermissions.filter((p) => p !== "bookings"),
                          );
                        }
                      }}
                    />
                    Quản trị lịch hẹn
                  </label>
                </div>

                {/* Password */}
                <input
                  type="password"
                  placeholder="Nhập mật khẩu admin..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />

                {/* Actions */}
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

                      const success = await updateUserPermissions(
                        selectedUser.email,
                        selectedPermissions,
                      );

                      if (!success) {
                        showToast("Cập nhật thất bại", "error");
                        return;
                      }

                      showToast("Đã cập nhật quyền", "success");

                      // reload users
                      const data = await fetchUsers();
                      setUsers(data);

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

const StatCard: React.FC<{
  title: string;
  value: string;
  note: string;
}> = ({ title, value, note }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold text-slate-900 mt-3">{value}</p>
      <p className="text-sm text-slate-400 mt-2">{note}</p>
    </div>
  );
};

const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = "",
}) => {
  return (
    <th
      className={`px-4 py-3 text-sm font-semibold text-slate-600 border-b border-slate-200 bg-slate-50 ${className}`}
    >
      {children}
    </th>
  );
};

const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = "",
}) => {
  return (
    <td
      className={`px-4 py-4 text-sm text-slate-700 border-b border-slate-100 align-middle ${className}`}
    >
      {children}
    </td>
  );
};

const Badge: React.FC<{
  text: string;
  tone: "green" | "amber" | "red";
}> = ({ text, tone }) => {
  const toneClass =
    tone === "green"
      ? "bg-green-100 text-green-700"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}
    >
      {text}
    </span>
  );
};

export default Admin;
