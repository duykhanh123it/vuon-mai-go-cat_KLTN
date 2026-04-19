import type {
  OrderDetailResponse,
  OrderLineItem,
  OrderPayment,
  OrderSummary,
  OrderTransactionType,
} from "../types";

export type CreateOrderPayload = {
  customer: {
    email: string;
    name: string;
    phone: string;
  };
  orderType: OrderTransactionType;
  note?: string;
  items: Array<{
    productCode: string;
    productType: string;
    transactionType: OrderTransactionType;
    price: number;
    quantity: number;
    note?: string;
  }>;
};

const getApiBase = (): string => {
  const base = import.meta.env.VITE_PRODUCTS_API_BASE;
  if (!base) {
    throw new Error("Missing VITE_PRODUCTS_API_BASE in .env");
  }
  return String(base).replace(/\/+$/, "");
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const normalized = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
};

const toStringValue = (value: unknown): string =>
  value == null ? "" : String(value).trim();

const normalizeOrderSummary = (value: any): OrderSummary => ({
  orderId: toStringValue(value?.orderId),
  createdAt: toStringValue(value?.createdAt),
  customerEmail: toStringValue(value?.customerEmail).toLowerCase(),
  customerName: toStringValue(value?.customerName),
  customerPhone: toStringValue(value?.customerPhone),
  orderType:
    toStringValue(value?.orderType).toLowerCase() === "buy" ? "buy" : "rent",
  orderStatus: toStringValue(value?.orderStatus || "new").toLowerCase(),
  totalAmount: toNumber(value?.totalAmount),
  depositAmount: toNumber(value?.depositAmount),
  paidAmount: toNumber(value?.paidAmount),
  remainingAmount: toNumber(value?.remainingAmount),
  note: toStringValue(value?.note),
  createdBy: toStringValue(value?.createdBy),
  updatedAt: toStringValue(value?.updatedAt),
});

const normalizeOrderLineItem = (value: any): OrderLineItem => ({
  orderItemId: toStringValue(value?.orderItemId),
  orderId: toStringValue(value?.orderId),
  productCode: toStringValue(value?.productCode),
  productType: toStringValue(value?.productType),
  transactionType:
    toStringValue(value?.transactionType).toLowerCase() === "buy"
      ? "buy"
      : "rent",
  price: toNumber(value?.price),
  quantity: Math.max(1, toNumber(value?.quantity)),
  lineTotal: toNumber(value?.lineTotal),
  snapshotNote: toStringValue(value?.snapshotNote),
});

const normalizeOrderPayment = (value: any): OrderPayment => ({
  paymentId: toStringValue(value?.paymentId),
  orderId: toStringValue(value?.orderId),
  paidAt: toStringValue(value?.paidAt || value?.createdAt),
  amount: toNumber(value?.amount),
  method: toStringValue(value?.method),
  note: toStringValue(value?.note),
  createdBy: toStringValue(value?.createdBy || value?.recordedBy),
});

const handleApiError = (data: any, fallbackMessage: string) => {
  if (!data?.ok) {
    throw new Error(data?.error || fallbackMessage);
  }
  return data;
};

export const createOrder = async (
  payload: CreateOrderPayload,
): Promise<{ ok: true; orderId: string; message?: string }> => {
  const res = await fetch(getApiBase(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      api: "createOrder",
      ...payload,
    }),
  });

  const data = await res.json();
  handleApiError(data, "Không thể tạo đơn hàng");

  return {
    ok: true,
    orderId: toStringValue(data?.orderId),
    message: toStringValue(data?.message),
  };
};

export const fetchOrders = async (): Promise<OrderSummary[]> => {
  const res = await fetch(`${getApiBase()}?api=getOrders`, {
    cache: "no-store",
  });

  const data = await res.json();
  handleApiError(data, "Không thể tải danh sách đơn hàng");

  const orders = Array.isArray(data?.data) ? data.data : [];
  return orders.map((item: any) => normalizeOrderSummary(item));
};

export const fetchOrderDetail = async (
  orderId: string,
): Promise<OrderDetailResponse> => {
  const encodedOrderId = encodeURIComponent(String(orderId || "").trim());
  const res = await fetch(
    `${getApiBase()}?api=getOrderDetail&orderId=${encodedOrderId}`,
    {
      cache: "no-store",
    },
  );

  const data = await res.json();
  handleApiError(data, "Không thể tải chi tiết đơn hàng");

  const order = normalizeOrderSummary(data?.order || {});
  const items = Array.isArray(data?.items)
    ? data.items.map((item: any) => normalizeOrderLineItem(item))
    : [];
  const payments = Array.isArray(data?.payments)
    ? data.payments.map((item: any) => normalizeOrderPayment(item))
    : [];

  return { order, items, payments };
};

export const addPayment = async (payload: {
  orderId: string;
  amount: number;
  method: string;
  note?: string;
}): Promise<{ ok: true; paidAmount: number; remainingAmount: number }> => {
  const res = await fetch(getApiBase(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      api: "addPayment",
      ...payload,
    }),
  });

  const data = await res.json();
  handleApiError(data, "Không thể ghi nhận thanh toán");

  return {
    ok: true,
    paidAmount: toNumber(data?.paidAmount),
    remainingAmount: toNumber(data?.remainingAmount),
  };
};

export const fetchMyOrders = async (email: string): Promise<OrderSummary[]> => {
  const normalizedEmail = toStringValue(email).toLowerCase();
  if (!normalizedEmail) return [];

  const orders = await fetchOrders();
  return orders
    .filter((order) => order.customerEmail === normalizedEmail)
    .sort((a, b) => {
      const timeA = Date.parse(a.createdAt || "") || 0;
      const timeB = Date.parse(b.createdAt || "") || 0;
      return timeB - timeA;
    });
};
