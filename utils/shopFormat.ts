import type {
  OrderTransactionType,
  OrderStatus,
  PaymentStatus,
  ProductAvailabilityStatus,
} from "../types";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const formatCurrencyVnd = (value: number | null | undefined) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0đ";
  return `${num.toLocaleString("vi-VN")}đ`;
};

export const formatCompactCurrencyVnd = (value: number | null | undefined) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0đ";
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} tỷ`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")} triệu`;
  }
  return `${num.toLocaleString("vi-VN")}đ`;
};

const parseDateInput = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const nativeDate = new Date(raw);
  if (!Number.isNaN(nativeDate.getTime())) return nativeDate;

  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (match) {
    const [, dd, mm, yyyy, hh = "0", min = "0", ss = "0"] = match;
    const parsed = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const formatDateTimeVN = (value: unknown) => {
  const date = parseDateInput(value);
  if (!date) return String(value || "--");
  return DATE_TIME_FORMATTER.format(date);
};

export const formatDateVN = (value: unknown) => {
  const date = parseDateInput(value);
  if (!date) return String(value || "--");
  return DATE_FORMATTER.format(date);
};

export const formatPhoneVN = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 9) return String(value || "");
  return digits.replace(/(\d{4})(\d{3})(\d{3,4})/, "$1 $2 $3");
};

export const formatTransactionTypeLabel = (value: OrderTransactionType) =>
  value === "rent" ? "Cho thuê" : "Bán";

const ORDER_LABELS: Record<OrderStatus, string> = {
  new: "Mới tạo",
  confirmed: "Đã xác nhận",
  delivering: "Đang giao hàng",
  active: "Đang thuê",
  cancelled: "Đã hủy",
  completed: "Hoàn tất",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Chưa thanh toán",
  deposit_paid: "Đã cọc",
  partial_paid: "Thanh toán một phần",
  paid: "Đã thanh toán đủ",
};

const PRODUCT_LABELS: Record<ProductAvailabilityStatus, string> = {
  available: "Sẵn sàng",
  reserved: "Đang giữ cho đơn khác",
  sold: "Đã bán",
  rented_out: "Đang cho thuê",
};

export const formatOrderStatusLabel = (value: OrderStatus) => ORDER_LABELS[value];
export const formatPaymentStatusLabel = (value: PaymentStatus) =>
  PAYMENT_LABELS[value];
export const formatAvailabilityLabel = (value: ProductAvailabilityStatus) =>
  PRODUCT_LABELS[value];

export const joinClassNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");
