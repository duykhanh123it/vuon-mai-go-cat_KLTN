import type {
  OrderTransactionType,
  Product,
  ProductAvailabilityStatus,
} from "../types";

export interface ProductAvailability {
  status: ProductAvailabilityStatus;
  label: string;
  canBuy: boolean;
  canRent: boolean;
  reason?: string;
}

const hasPositiveNumber = (value: unknown) => {
  const num = Number(value || 0);
  return Number.isFinite(num) && num > 0;
};

export const normalizeProductAvailabilityStatus = (
  value: unknown,
): ProductAvailabilityStatus => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "reserved") return "reserved";
  if (raw === "sold") return "sold";
  if (raw === "rented_out" || raw === "rentedout") return "rented_out";
  return "available";
};

export const getProductAvailabilityLabel = (
  status: ProductAvailabilityStatus,
): string => {
  switch (status) {
    case "available":
      return "Sẵn sàng";
    case "reserved":
      return "Đang giữ cho đơn khác";
    case "sold":
      return "Đã bán";
    case "rented_out":
      return "Đang cho thuê";
    default:
      return "Sẵn sàng";
  }
};

export const getProductAvailabilityClassName = (
  status: ProductAvailabilityStatus,
) => {
  switch (status) {
    case "available":
      return "bg-green-100 text-green-700 border-green-200";
    case "reserved":
      return "bg-slate-900 text-white border-slate-900";
    case "sold":
      return "bg-red-100 text-red-700 border-red-200";
    case "rented_out":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export const resolveProductAvailability = (
  product: Partial<Product> | null | undefined,
): ProductAvailability => {
  const explicitStatus = normalizeProductAvailabilityStatus(product?.inventoryStatus);
  let status = explicitStatus;

  if (!product?.inventoryStatus) {
    if (product?.isSold) {
      status = "sold";
    } else if (product?.isRented) {
      status = "rented_out";
    }
  }

  const hasBuyPrice = hasPositiveNumber(product?.price);
  const hasRentPrice = hasPositiveNumber(product?.rentPrice);

  if (status === "sold") {
    return {
      status,
      label: getProductAvailabilityLabel(status),
      canBuy: false,
      canRent: false,
      reason: "Cây này đã bán xong.",
    };
  }

  if (status === "rented_out") {
    return {
      status,
      label: getProductAvailabilityLabel(status),
      canBuy: false,
      canRent: false,
      reason: "Cây đang nằm trong đơn thuê đang diễn ra.",
    };
  }

  if (status === "reserved") {
    return {
      status,
      label: getProductAvailabilityLabel(status),
      canBuy: false,
      canRent: false,
      reason: "Cây đang được giữ cho một đơn đã xác nhận.",
    };
  }

  return {
    status: "available",
    label: getProductAvailabilityLabel("available"),
    canBuy: hasBuyPrice,
    canRent: hasRentPrice,
    reason:
      hasBuyPrice || hasRentPrice
        ? ""
        : "Cây này chưa có giá công khai để đặt trực tuyến.",
  };
};

export const canProductTransactionProceed = (
  product: Partial<Product> | null | undefined,
  transactionType: OrderTransactionType,
) => {
  const availability = resolveProductAvailability(product);
  return transactionType === "buy" ? availability.canBuy : availability.canRent;
};

export const getProductAvailabilityStatus = (
  product: Partial<Product> | null | undefined,
): ProductAvailabilityStatus => {
  return resolveProductAvailability(product).status;
};