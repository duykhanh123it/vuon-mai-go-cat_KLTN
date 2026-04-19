import type { OrderStatus, OrderTransactionType } from "../types";

export const formatCurrencyVnd = (value: number | null | undefined): string => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("vi-VN")}đ`;
};

export const formatDateTimeValue = (value: string | null | undefined): string => {
  const raw = String(value || "").trim();
  if (!raw) return "--";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

export const getTransactionTypeLabel = (
  value: OrderTransactionType | string | null | undefined,
): string => {
  return String(value || "").trim().toLowerCase() === "buy" ? "Mua" : "Thuê";
};

export const getOrderStatusMeta = (
  value: OrderStatus | string | null | undefined,
): { label: string; className: string } => {
  const status = String(value || "new").trim().toLowerCase();

  if (status === "paid") {
    return {
      label: "Đã thanh toán",
      className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    };
  }

  if (status === "confirmed") {
    return {
      label: "Đã xác nhận",
      className: "bg-sky-100 text-sky-800 border border-sky-200",
    };
  }

  if (status === "completed") {
    return {
      label: "Hoàn tất",
      className: "bg-indigo-100 text-indigo-800 border border-indigo-200",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Đã hủy",
      className: "bg-rose-100 text-rose-800 border border-rose-200",
    };
  }

  return {
    label: "Mới tạo",
    className: "bg-amber-100 text-amber-900 border border-amber-200",
  };
};
