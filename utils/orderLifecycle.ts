import type {
  OrderStatus,
  OrderTransactionType,
  PaymentStatus,
} from "../types";

const ORDER_LIFECYCLE_BY_TYPE: Record<
  OrderTransactionType,
  Record<OrderStatus, OrderStatus[]>
> = {
  buy: {
    new: ["confirmed", "cancelled"],
    confirmed: ["delivering", "cancelled"],
    delivering: ["confirmed", "completed"],
    active: [],
    cancelled: [],
    completed: [],
  },
  rent: {
    new: ["confirmed", "cancelled"],
    confirmed: ["active", "cancelled"],
    delivering: [],
    active: ["completed"],
    cancelled: [],
    completed: [],
  },
};

export const normalizeOrderStatus = (value: unknown): OrderStatus => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "delivering" || raw === "shipping" || raw === "delivery") {
    return "delivering";
  }
  if (raw === "active" || raw === "in_rental" || raw === "rented_out") {
    return "active";
  }
  if (raw === "confirmed") return "confirmed";
  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  if (raw === "completed" || raw === "done") return "completed";
  if (raw === "paid") return "confirmed"; // legacy value from old backend
  return "new";
};

export const getOrderStatusTone = (status: OrderStatus) => {
  switch (status) {
    case "new":
      return "amber";
    case "confirmed":
      return "blue";
    case "delivering":
      return "orange";
    case "active":
      return "violet";
    case "cancelled":
      return "red";
    case "completed":
      return "green";
    default:
      return "slate";
  }
};

export const getOrderStatusClassName = (status: OrderStatus) => {
  switch (status) {
    case "new":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "confirmed":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "delivering":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "active":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "cancelled":
      return "bg-red-100 text-red-700 border-red-200";
    case "completed":
      return "bg-green-100 text-green-700 border-green-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export const getAllowedOrderTransitions = (
  current: OrderStatus,
  paymentStatus?: PaymentStatus,
  orderType: OrderTransactionType = "buy",
): OrderStatus[] => {
  if (orderType === "buy") {
    if (current === "delivering") {
      if (paymentStatus === "paid") {
        return ["confirmed", "completed"];
      }
      return ["confirmed"];
    }

    return ORDER_LIFECYCLE_BY_TYPE.buy[current] || [];
  }

  if (current === "active") {
    if (paymentStatus === "paid") {
      return ["completed"];
    }
    return [];
  }

  return ORDER_LIFECYCLE_BY_TYPE.rent[current] || [];
};

export const canTransitionOrderStatus = (
  current: OrderStatus,
  next: OrderStatus,
  paymentStatus?: PaymentStatus,
  orderType: OrderTransactionType = "buy",
) => getAllowedOrderTransitions(current, paymentStatus, orderType).includes(next);
