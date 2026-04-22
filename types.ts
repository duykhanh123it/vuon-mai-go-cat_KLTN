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
export type LocationSource =
  | "manual_pin"
  | "device_geolocation"
  | "text_only"
  | "legacy_pinned"
  | "";
export type LocationConfidence = "high" | "medium" | "low" | "";

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
  lat?: number | null;
  lng?: number | null;
  locationSource?: LocationSource;
  locationConfidence?: LocationConfidence;
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
  lat?: number | null;
  lng?: number | null;
  locationSource?: LocationSource;
  locationConfidence?: LocationConfidence;
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

type LocationAwareValue = {
  lat?: number | null;
  lng?: number | null;
  locationSource?: LocationSource | string | null;
  locationConfidence?: LocationConfidence | string | null;
};

export function hasValidLocationCoordinates(
  value: LocationAwareValue | null | undefined,
): boolean {
  return (
    typeof value?.lat === "number" &&
    Number.isFinite(value.lat) &&
    typeof value?.lng === "number" &&
    Number.isFinite(value.lng)
  );
}

const normalizeLocationSource = (
  value: unknown,
  hasCoordinates: boolean,
): LocationSource => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "manual_pin" || raw === "manual_pin_after_geolocation") {
    return "manual_pin";
  }
  if (raw === "device_geolocation") return "device_geolocation";
  if (raw === "text_only") return "text_only";
  if (raw === "legacy_pinned") return hasCoordinates ? "legacy_pinned" : "text_only";
  return hasCoordinates ? "legacy_pinned" : "text_only";
};

const normalizeLocationConfidence = (
  value: unknown,
  options: { source: LocationSource; hasCoordinates: boolean },
): LocationConfidence => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "high" || raw === "medium" || raw === "low") {
    return raw;
  }

  if (options.source === "manual_pin") return "high";
  if (
    options.source === "device_geolocation" ||
    options.source === "legacy_pinned"
  ) {
    return "medium";
  }
  if (options.hasCoordinates) return "medium";
  return "low";
};

export type LocationDisplayInfo = {
  hasCoordinates: boolean;
  source: Exclude<LocationSource, "">;
  confidence: "high" | "medium" | "low";
  sourceLabel: string;
  confidenceLabel: string;
  statusLabel: string;
  helperText: string;
  adminHelperText: string;
  icon: string;
};

export function getLocationDisplayInfo(
  value: LocationAwareValue | null | undefined,
): LocationDisplayInfo {
  const lat = normalizeCoordinate(
    (value as any)?.lat ?? (value as any)?.latitude,
    -90,
    90,
  );
  const lng = normalizeCoordinate(
    (value as any)?.lng ?? (value as any)?.longitude ?? (value as any)?.lon,
    -180,
    180,
  );
  const hasCoordinates =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng);
  const source = normalizeLocationSource(
    (value as any)?.locationSource ?? (value as any)?.geoSource,
    hasCoordinates,
  ) as Exclude<LocationSource, "">;
  const confidence = normalizeLocationConfidence(
    (value as any)?.locationConfidence ?? (value as any)?.confidence,
    { source, hasCoordinates },
  ) as "high" | "medium" | "low";

  if (!hasCoordinates) {
    return {
      hasCoordinates: false,
      source: "text_only",
      confidence: "low",
      sourceLabel: "Chỉ có địa chỉ text",
      confidenceLabel: "Ước lượng",
      statusLabel: "Chưa có vị trí ghim",
      helperText:
        "Bạn vẫn có thể lưu bằng địa chỉ text. Nếu ghim map, đội giao hàng sẽ mở đúng vị trí hơn.",
      adminHelperText:
        "Đơn này đang mở map theo text địa chỉ, nên kiểm tra lại với khách khi điểm giao khó tìm.",
      icon: "📝",
    };
  }

  if (source === "manual_pin") {
    return {
      hasCoordinates: true,
      source,
      confidence: confidence === "low" ? "high" : confidence,
      sourceLabel: "Ghim tay",
      confidenceLabel: "Độ chính xác cao",
      statusLabel: "Đã ghim chính xác",
      helperText:
        "Bạn đã tự chọn điểm trên map. Admin và đội giao hàng sẽ ưu tiên mở đúng tọa độ này.",
      adminHelperText:
        "Khách đã tự ghim trên map nên độ tin cậy cao hơn. Thường có thể dùng ngay cho giao hàng.",
      icon: "📍",
    };
  }

  if (source === "device_geolocation") {
    return {
      hasCoordinates: true,
      source,
      confidence: confidence === "high" ? "high" : "medium",
      sourceLabel: "Vị trí hiện tại",
      confidenceLabel: confidence === "high" ? "Đã xác nhận lại" : "Độ chính xác vừa",
      statusLabel: "Đã lấy từ vị trí hiện tại của thiết bị",
      helperText:
        "Nếu địa điểm giao không phải nơi bạn đang đứng, hãy chỉnh lại ghim để chính xác hơn.",
      adminHelperText:
        "Tọa độ lấy từ vị trí hiện tại của thiết bị. Nên kiểm tra thêm khi nơi giao không trùng vị trí khách đang đứng.",
      icon: "📱",
    };
  }

  return {
    hasCoordinates: true,
    source: "legacy_pinned",
    confidence: confidence === "high" ? "high" : "medium",
    sourceLabel: "Có tọa độ",
    confidenceLabel: confidence === "high" ? "Độ chính xác cao" : "Độ chính xác vừa",
    statusLabel: "Đã có tọa độ ghim",
    helperText:
      "Địa chỉ này đã có tọa độ ghim, nhưng bản cũ chưa ghi rõ nguồn lấy vị trí.",
    adminHelperText:
      "Đơn có tọa độ nhưng dữ liệu cũ chưa ghi rõ nguồn. Có thể mở map theo tọa độ, nhưng vẫn nên kiểm tra khi cần.",
    icon: "📌",
  };
}

export function getLocationSourceLabel(
  value: LocationAwareValue | null | undefined,
): string {
  return getLocationDisplayInfo(value).sourceLabel;
}

export function getLocationConfidenceLabel(
  value: LocationAwareValue | null | undefined,
): string {
  return getLocationDisplayInfo(value).confidenceLabel;
}

export function normalizeUserAddress(value: Partial<UserAddress> | null | undefined): UserAddress {
  const lat = normalizeCoordinate((value as any)?.lat ?? (value as any)?.latitude, -90, 90);
  const lng = normalizeCoordinate(
    (value as any)?.lng ?? (value as any)?.longitude ?? (value as any)?.lon,
    -180,
    180,
  );
  const locationSource = normalizeLocationSource(
    (value as any)?.locationSource ?? (value as any)?.geoSource,
    typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng),
  );
  const locationConfidence = normalizeLocationConfidence(
    (value as any)?.locationConfidence ?? (value as any)?.confidence,
    {
      source: locationSource,
      hasCoordinates:
        typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng),
    },
  );

  return {
    id: String(value?.id || "").trim(),
    label: String(value?.label || "").trim(),
    recipientName: String(value?.recipientName || "").trim(),
    recipientPhone: String(value?.recipientPhone || "").trim(),
    province: String(value?.province || "").trim(),
    ward: String(value?.ward || "").trim(),
    line1: String(value?.line1 || "").trim(),
    lat,
    lng,
    locationSource,
    locationConfidence,
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

const normalizeCoordinate = (
  value: unknown,
  min: number,
  max: number,
): number | null => {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
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
  const lat = normalizeCoordinate(
    (value as any)?.lat ?? (value as any)?.latitude,
    -90,
    90,
  );
  const lng = normalizeCoordinate(
    (value as any)?.lng ?? (value as any)?.longitude ?? (value as any)?.lon,
    -180,
    180,
  );

  const hasCoordinates =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng);
  const locationSource = normalizeLocationSource(
    (value as any)?.locationSource ?? (value as any)?.geoSource,
    hasCoordinates,
  );
  const locationConfidence = normalizeLocationConfidence(
    (value as any)?.locationConfidence ?? (value as any)?.confidence,
    { source: locationSource, hasCoordinates },
  );

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
    lat,
    lng,
    locationSource,
    locationConfidence,
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

export function buildOrderAddressMapUrl(
  value: Partial<OrderAddressSnapshot> | null | undefined,
  fallbackAddress?: string | null,
): string {
  const address = normalizeOrderAddressSnapshot(value);

  if (
    typeof address.lat === "number" &&
    Number.isFinite(address.lat) &&
    typeof address.lng === "number" &&
    Number.isFinite(address.lng)
  ) {
    return `https://www.google.com/maps?q=${address.lat},${address.lng}`;
  }

  const query = [address.fullAddress, String(fallbackAddress || "").trim()]
    .find((item) => Boolean(String(item || "").trim()))
    ?.trim();

  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
