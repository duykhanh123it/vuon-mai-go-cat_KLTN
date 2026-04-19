// src/types.ts

export type Page =
  | "home"
  | "products"
  | "product-detail"
  | "booking"
  | "contact"
  | "admin"
  | "cart"
  | "checkout"
  | "my-orders";

export type AdminTab = "products" | "bookings" | "users" | "orders";

/**
 * Product dùng cho web Vườn Mai Gò Cát
 * - Các field số có thể null để tránh bug khi data thiếu
 * - KHÔNG dùng undefined để dễ kiểm soát render
 */
export interface Product {
  /** ID hiển thị & dùng nội bộ (vd: "BS01") */
  id: string;

  /** Tên hiển thị (vd: "Mai BS01") */
  name: string;

  /** Giá bán theo đơn vị VND – null = Liên hệ */
  price: number | null;

  /** Giá thuê theo đơn vị VND – null = Liên hệ */
  rentPrice: number | null;

  /** Phân loại hiển thị */
  category: "Mai Bonsai" | "Mai Tàng" | "Khác";

  /** Chiều cao cây (m) */
  height: number | null;

  /** Tán / ngang cây (m) */
  width: number | null;

  /** Tuổi cây (nếu có) */
  age: number | null;

  /** Ảnh chính */
  image: string | null;

  /** Ảnh phụ */
  thumbnails: string[];

  /** Mô tả chi tiết */
  description: string;

  /** Hoành cây (cm) */
  hoanh_cm: number | null;

  /** Đường kính chậu (m) */
  chau_m: number | null;

  /** Trạng thái */
  isRented: boolean;
  isSold: boolean;

  /** Giá nội bộ hỗ trợ lọc trên ProductList */
  __filterRentPrice?: number | null;
  __filterSellPrice?: number | null;
}

// ================= AUTH =================

export interface AuthUser {
  name: string;
  email: string;

  phone: string;
  birthDate: string;
  gender: string;
  createdAt: string;
  avatarUrl: string;

  role: "user" | "admin";
  permissions: string[];
  hasPassword: boolean;
}

export interface AppRouteState {
  page: Page | "not-found";
  productsPage: number;
  productId?: string;
  adminTab?: AdminTab;
}

export const DEFAULT_USER: AuthUser = {
  name: "",
  email: "",
  phone: "",
  birthDate: "",
  gender: "",
  createdAt: "",
  avatarUrl: "",
  role: "user",
  permissions: [],
  hasPassword: false,
};

const normalizePermissions = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }
    } catch {
      // fallback nếu backend trả string thường
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export function normalizeAuthUser(
  user: Partial<AuthUser> | null | undefined,
): AuthUser {
  return {
    name: String(user?.name || ""),
    email: String(user?.email || ""),
    phone: String(user?.phone || ""),
    birthDate: String(user?.birthDate || ""),
    gender: String(user?.gender || ""),
    createdAt: String(user?.createdAt || ""),
    avatarUrl: String(user?.avatarUrl || ""),
    role: String(user?.role || "").toLowerCase() === "admin" ? "admin" : "user",
    permissions: normalizePermissions(user?.permissions),
    hasPassword: Boolean(user?.hasPassword),
  };
}

export const normalizeProductId = (value: unknown) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");

export const clampPositiveInt = (value: unknown, fallback = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.max(1, Math.trunc(num));
};

export const isAdminTab = (value: unknown): value is AdminTab =>
  value === "products" ||
  value === "bookings" ||
  value === "orders" ||
  value === "users";

export function getDefaultAdminTab(user: AuthUser | null | undefined): AdminTab {
  if (user?.role === "admin") return "products";
  if (user?.permissions?.includes("products")) return "products";
  if (user?.permissions?.includes("bookings")) return "bookings";
  if (user?.permissions?.includes("orders")) return "orders";
  return "products";
}

export const canAccessAdminTab = (user, tab) => {
  if (!user) return false;

  // admin thì vào hết
  if (user.role === "admin") return true;

  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  if (tab === "products") return permissions.includes("products");
  if (tab === "bookings") return permissions.includes("bookings");
  if (tab === "orders") return permissions.includes("orders");
  if (tab === "users") return permissions.includes("users");

  return false;
};

export function canAccessAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (
    permission === "products" ||
    permission === "bookings" ||
    permission === "orders" ||
    permission === "users"
  ) {
    return permissions.includes(permission);
  }
  return false;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// ================= GOOGLE AUTH =================

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

// ================= BOOKING =================

export interface Booking {
  maDatLich: string;

  thoiGianTao: string;

  hoTen: string;
  soDienThoai: string;
  email: string;

  ngayThamQuan: string;
  gioHen: string;

  ghiChu: string;

  nguon: string;

  trangThai: "Mới" | "Đã xác nhận" | "Đã hủy";
}

// ================= CART & ORDER =================

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "rent" | "buy";
};

export type Order = {
  orderId: string;
  createdAt: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  orderType: "buy" | "rent";
  orderStatus: string;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  remainingAmount: number;
  note: string;
};

export type OrderItem = {
  orderItemId: string;
  orderId: string;
  productCode: string;
  productType: string;
  transactionType: "buy" | "rent";
  price: number;
  quantity: number;
  lineTotal: number;
  snapshotNote: string;
};

export type Payment = {
  paymentId: string;
  orderId: string;
  createdAt: string;
  amount: number;
  method: string;
  note: string;
};