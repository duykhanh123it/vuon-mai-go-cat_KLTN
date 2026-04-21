// src/types.ts

export type Page =
  | "home"
  | "products"
  | "product-detail"
  | "booking"
  | "cart"
  | "checkout"
  | "my-orders"
  | "contact"
  | "admin";

export type AdminTab = "products" | "orders" | "bookings" | "users";
export type AdminPermission = "products" | "orders" | "bookings" | "users";

export type OrderStatus = "new" | "confirmed" | "delivering" | "active" | "cancelled" | "completed";
export type PaymentStatus =
  | "unpaid"
  | "deposit_paid"
  | "partial_paid"
  | "paid";
export type ProductAvailabilityStatus =
  | "available"
  | "reserved"
  | "sold"
  | "rented_out";
export type OrderTransactionType = "buy" | "rent";
export type CartMode = OrderTransactionType | null;

export interface Product {
  id: string;
  name: string;
  price: number | null;
  rentPrice: number | null;
  category: "Mai Bonsai" | "Mai Tàng" | "Khác";
  height: number | string | null;
  width: number | string | null;
  age: number | null;
  image: string | null;
  thumbnails: string[];
  description: string;
  hoanh_cm: number | null;
  chau_m: number | null;
  isRented: boolean;
  isSold: boolean;
  inventoryStatus?: ProductAvailabilityStatus;
  reservedByOrderId?: string | null;
  reservedAt?: string | null;
  availabilityText?: string | null;
  canBuy?: boolean;
  canRent?: boolean;
  __filterRentPrice?: number | null;
  __filterSellPrice?: number | null;
}

export interface CartItem {
  cartKey: string;
  productId: string;
  productName: string;
  productCategory: Product["category"];
  image: string | null;
  transactionType: OrderTransactionType;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  snapshotNote: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface OrderDeliveryInfo {
  address: string;
  scheduledAt: string;
  note: string;
  updatedAt: string;
}

export type OrderAddressSnapshotSource = "saved_address" | "manual_input" | "";

export interface OrderAddressSnapshot {
  id: string;
  label: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  ward: string;
  line1: string;
  note: string;
  isDefault: boolean;
  source: OrderAddressSnapshotSource;
  fullAddress: string;
}

export interface OrderSummary {
  orderId: string;
  createdAt: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderTransactionType;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  remainingAmount: number;
  note: string;
  deliveryInfo: OrderDeliveryInfo;
  addressSnapshot: OrderAddressSnapshot;
  auditTrail?: string[];
  createdBy: string;
  updatedAt: string;
  itemCount?: number;
  reservedProductCodes?: string[];
  allowedTransitions?: OrderStatus[];
}

export interface OrderItemRecord {
  orderItemId: string;
  orderId: string;
  productCode: string;
  productType: string;
  transactionType: OrderTransactionType;
  price: number;
  quantity: number;
  lineTotal: number;
  snapshotNote: string;
}

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  createdAt: string;
  amount: number;
  method: string;
  note: string;
  createdBy: string;
}

export interface OrderDetailResponse {
  order: OrderSummary;
  items: OrderItemRecord[];
  payments: PaymentRecord[];
}

export interface UserAddress {
  id: string;
  label: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  ward: string;
  line1: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  addressBook: UserAddress[];
  hasPassword: boolean;
}

export interface AppRouteState {
  page: Page | "not-found";
  productsPage: number;
  productId?: string;
  adminTab?: AdminTab;
  orderId?: string;
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
  addressBook: [],
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

      if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).permissions)) {
        return (parsed as any).permissions
          .map((item: unknown) => String(item || "").trim())
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

export function normalizeUserAddress(value: Partial<UserAddress> | null | undefined): UserAddress {
  return {
    id: String(value?.id || "").trim(),
    label: String(value?.label || "").trim(),
    recipientName: String(value?.recipientName || "").trim(),
    recipientPhone: String(value?.recipientPhone || "").trim(),
    province: String(value?.province || "").trim(),
    ward: String(value?.ward || "").trim(),
    line1: String(value?.line1 || "").trim(),
    isDefault: Boolean(value?.isDefault),
    createdAt: String(value?.createdAt || "").trim(),
    updatedAt: String(value?.updatedAt || "").trim(),
  };
}

export function normalizeAddressBook(value: unknown): UserAddress[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: UserAddress[] = [];

  for (const item of value) {
    const address = normalizeUserAddress(item as Partial<UserAddress>);
    const meaningful = [
      address.label,
      address.recipientName,
      address.recipientPhone,
      address.province,
      address.ward,
      address.line1,
    ]
      .join("")
      .trim();

    if (!meaningful) continue;

    const dedupeKey = address.id || `${address.label}|${address.province}|${address.ward}|${address.line1}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(address);
  }

  let defaultIndex = out.findIndex((item) => item.isDefault);
  if (out.length && defaultIndex < 0) {
    defaultIndex = 0;
  }

  return out.map((item, index) => ({
    ...item,
    isDefault: defaultIndex >= 0 ? index === defaultIndex : false,
  }));
}

const normalizeOrderAddressSnapshotSource = (
  value: unknown,
): OrderAddressSnapshotSource => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "saved_address") return "saved_address";
  if (raw === "manual_input") return "manual_input";
  return "";
};

export function normalizeOrderAddressSnapshot(
  value: Partial<OrderAddressSnapshot> | null | undefined,
): OrderAddressSnapshot {
  const line1 = String(value?.line1 || "").trim();
  const ward = String(value?.ward || "").trim();
  const province = String(value?.province || "").trim();
  const fullAddress =
    String((value as any)?.fullAddress || (value as any)?.address || "").trim() ||
    [line1, ward, province].filter(Boolean).join(", ");

  return {
    id: String(value?.id || "").trim(),
    label: String(value?.label || "").trim(),
    recipientName: String((value as any)?.recipientName || (value as any)?.fullName || "").trim(),
    recipientPhone: String((value as any)?.recipientPhone || (value as any)?.phone || "").trim(),
    province,
    ward,
    line1,
    note: String(value?.note || "").trim(),
    isDefault: Boolean(value?.isDefault),
    source: normalizeOrderAddressSnapshotSource((value as any)?.source),
    fullAddress,
  };
}

export function hasOrderAddressSnapshot(
  value: Partial<OrderAddressSnapshot> | null | undefined,
): boolean {
  const address = normalizeOrderAddressSnapshot(value);
  return Boolean(
    [
      address.recipientName,
      address.recipientPhone,
      address.province,
      address.ward,
      address.line1,
      address.fullAddress,
    ]
      .join("")
      .trim(),
  );
}

export function formatOrderAddressSnapshot(
  value: Partial<OrderAddressSnapshot> | null | undefined,
): string {
  return normalizeOrderAddressSnapshot(value).fullAddress;
}

export function getOrderAddressSnapshotSourceLabel(
  value: Partial<OrderAddressSnapshot> | null | undefined,
): string {
  const source = normalizeOrderAddressSnapshot(value).source;
  if (source === "saved_address") return "Địa chỉ đã lưu";
  if (source === "manual_input") return "Nhập thủ công";
  return "Chưa rõ nguồn";
}

export function normalizeAuthUser(
  user: Partial<AuthUser> | null | undefined,
): AuthUser {
  const rawAddressBook = (user as Partial<AuthUser> & { addresses?: unknown })?.addressBook
    ?? (user as Partial<AuthUser> & { addresses?: unknown })?.addresses;

  return {
    name: String(user?.name || ""),
    email: String(user?.email || "").trim().toLowerCase(),
    phone: String(user?.phone || ""),
    birthDate: String(user?.birthDate || ""),
    gender: String(user?.gender || ""),
    createdAt: String(user?.createdAt || ""),
    avatarUrl: String(user?.avatarUrl || ""),
    role: String(user?.role || "").toLowerCase() === "admin" ? "admin" : "user",
    permissions: normalizePermissions(user?.permissions),
    addressBook: normalizeAddressBook(rawAddressBook),
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
  value === "orders" ||
  value === "bookings" ||
  value === "users";

export function getDefaultAdminTab(
  user: AuthUser | null | undefined,
): AdminTab {
  if (user?.role === "admin") return "products";

  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  if (permissions.includes("products")) return "products";
  if (permissions.includes("orders")) return "orders";
  if (permissions.includes("bookings")) return "bookings";
  return "products";
}

export function canAccessAdminTab(
  user: AuthUser | null | undefined,
  tab: AdminTab,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (tab === "users") return false;
  return permissions.includes(tab);
}

export function canAccessAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return (
    permissions.includes("products") ||
    permissions.includes("orders") ||
    permissions.includes("bookings")
  );
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

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

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
