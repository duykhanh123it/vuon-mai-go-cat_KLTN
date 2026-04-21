import type {
  CartItem,
  OrderCustomer,
  OrderDeliveryInfo,
  OrderDetailResponse,
  OrderItemRecord,
  OrderSummary,
  OrderStatus,
  PaymentRecord,
  PaymentStatus,
} from "../types";
import { normalizeOrderStatus } from "./orderLifecycle";
import { derivePaymentStatus } from "./paymentStatus";

const getApiBase = () => {
  const base = import.meta.env.VITE_PRODUCTS_API_BASE;
  if (!base) {
    throw new Error("Missing VITE_PRODUCTS_API_BASE in .env");
  }
  return String(base).replace(/\/+$/, "");
};

const getStoredSessionToken = () => {
  try {
    if (typeof window === "undefined") return "";
    return String(window.localStorage.getItem("vmgc_session_token") || "").trim();
  } catch {
    return "";
  }
};

const requireSessionToken = () => {
  const token = getStoredSessionToken();
  if (!token) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  return token;
};

const toSafeNumber = (value: unknown) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return num;
};

const normalizePaymentStatus = (
  value: unknown,
  fallback: PaymentStatus,
): PaymentStatus => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "unpaid") return "unpaid";
  if (raw === "deposit_paid") return "deposit_paid";
  if (raw === "partial_paid") return "partial_paid";
  if (raw === "paid") return "paid";
  return fallback;
};

const EMPTY_DELIVERY_INFO: OrderDeliveryInfo = {
  address: "",
  scheduledAt: "",
  note: "",
  updatedAt: "",
};

const normalizeDeliveryInfo = (raw: any): OrderDeliveryInfo => ({
  address: String(raw?.address || ""),
  scheduledAt: String(raw?.scheduledAt || ""),
  note: String(raw?.note || ""),
  updatedAt: String(raw?.updatedAt || ""),
});

const normalizePaymentRecord = (raw: any): PaymentRecord => ({
  paymentId: String(raw?.paymentId || ""),
  orderId: String(raw?.orderId || ""),
  createdAt: String(raw?.createdAt || raw?.paidAt || ""),
  amount: toSafeNumber(raw?.amount),
  method: String(raw?.method || ""),
  note: String(raw?.note || ""),
  createdBy: String(raw?.createdBy || raw?.recordedBy || ""),
});

const normalizeOrderItem = (raw: any): OrderItemRecord => ({
  orderItemId: String(raw?.orderItemId || ""),
  orderId: String(raw?.orderId || ""),
  productCode: String(raw?.productCode || ""),
  productType: String(raw?.productType || ""),
  transactionType: raw?.transactionType === "buy" ? "buy" : "rent",
  price: toSafeNumber(raw?.price),
  quantity: Math.max(1, toSafeNumber(raw?.quantity) || 1),
  lineTotal: toSafeNumber(raw?.lineTotal),
  snapshotNote: String(raw?.snapshotNote || ""),
});

const normalizeOrderSummary = (raw: any): OrderSummary => {
  const totalAmount = toSafeNumber(raw?.totalAmount);
  const paidAmount = toSafeNumber(raw?.paidAmount);
  const depositAmount = toSafeNumber(raw?.depositAmount);
  const remainingAmount = Math.max(0, toSafeNumber(raw?.remainingAmount || totalAmount - paidAmount));
  const computedPaymentStatus = derivePaymentStatus({
    totalAmount,
    paidAmount,
    depositAmount,
  });

  return {
    orderId: String(raw?.orderId || ""),
    createdAt: String(raw?.createdAt || ""),
    customerEmail: String(raw?.customerEmail || "").trim().toLowerCase(),
    customerName: String(raw?.customerName || ""),
    customerPhone: String(raw?.customerPhone || ""),
    orderType: raw?.orderType === "buy" ? "buy" : "rent",
    orderStatus: normalizeOrderStatus(raw?.orderStatus),
    paymentStatus: normalizePaymentStatus(raw?.paymentStatus, computedPaymentStatus),
    totalAmount,
    depositAmount,
    paidAmount,
    remainingAmount,
    note: String(raw?.note || ""),
    deliveryInfo: raw?.deliveryInfo ? normalizeDeliveryInfo(raw.deliveryInfo) : { ...EMPTY_DELIVERY_INFO },
    auditTrail: Array.isArray(raw?.auditTrail)
      ? raw.auditTrail.map((item: any) => String(item || "")).filter(Boolean)
      : undefined,
    createdBy: String(raw?.createdBy || ""),
    updatedAt: String(raw?.updatedAt || ""),
    itemCount: Number(raw?.itemCount || 0) || undefined,
    reservedProductCodes: Array.isArray(raw?.reservedProductCodes)
      ? raw.reservedProductCodes.map((item: any) => String(item || "")).filter(Boolean)
      : undefined,
    allowedTransitions: Array.isArray(raw?.allowedTransitions)
      ? raw.allowedTransitions.filter((item: any) => ["new", "confirmed", "delivering", "active", "cancelled", "completed"].includes(String(item || "")))
      : undefined,
  };
};

const ensureOk = async <T>(response: Response): Promise<T> => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `API HTTP ${response.status}`);
  }
  if (data?.ok === false) {
    throw new Error(data?.error || "API returned ok=false");
  }
  return data as T;
};

const postJson = async <T>(payload: any): Promise<T> => {
  const token = requireSessionToken();
  const res = await fetch(getApiBase(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      ...payload,
      authToken: token,
    }),
  });
  return ensureOk<T>(res);
};

export type OrdersMeta = {
  dataVersion: string;
  now: number;
};

export const fetchOrdersMeta = async (): Promise<OrdersMeta> => {
  const query = new URLSearchParams({
    api: "getOrdersMeta",
    authToken: requireSessionToken(),
  });

  const res = await fetch(`${getApiBase()}?${query.toString()}`, {
    cache: "no-store",
  });
  const data = await ensureOk<{
    ok: boolean;
    dataVersion?: string;
    now?: number;
  }>(res);

  return {
    dataVersion: String(data.dataVersion || "0"),
    now: typeof data.now === "number" ? data.now : Date.now(),
  };
};

export const fetchOrders = async (options?: {
  customerEmail?: string;
}): Promise<OrderSummary[]> => {
  const query = new URLSearchParams({
    api: "getOrders",
    authToken: requireSessionToken(),
  });
  if (options?.customerEmail) {
    query.set("customerEmail", options.customerEmail.trim().toLowerCase());
  }

  const res = await fetch(`${getApiBase()}?${query.toString()}`, {
    cache: "no-store",
  });
  const data = await ensureOk<{ ok: boolean; data?: any[] }>(res);
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map(normalizeOrderSummary);
};

export const fetchOrderDetail = async (
  orderId: string,
  options?: { customerEmail?: string },
): Promise<OrderDetailResponse> => {
  const query = new URLSearchParams({
    api: "getOrderDetail",
    orderId: String(orderId || "").trim(),
    authToken: requireSessionToken(),
  });
  if (options?.customerEmail) {
    query.set("customerEmail", options.customerEmail.trim().toLowerCase());
  }

  const res = await fetch(`${getApiBase()}?${query.toString()}`, {
    cache: "no-store",
  });
  const data = await ensureOk<{
    ok: boolean;
    order: any;
    items?: any[];
    payments?: any[];
  }>(res);

  return {
    order: normalizeOrderSummary(data.order),
    items: Array.isArray(data.items) ? data.items.map(normalizeOrderItem) : [],
    payments: Array.isArray(data.payments)
      ? data.payments.map(normalizePaymentRecord)
      : [],
  };
};

export const createOrder = async (params: {
  customer: OrderCustomer;
  items: CartItem[];
  note?: string;
  deliveryInfo?: Partial<OrderDeliveryInfo>;
}): Promise<{ ok: boolean; orderId: string; message?: string }> => {
  const items = Array.isArray(params.items) ? params.items : [];
  if (!items.length) {
    throw new Error("Giỏ hàng đang trống.");
  }

  const orderType = items[0]?.transactionType === "buy" ? "buy" : "rent";

  return postJson<{ ok: boolean; orderId: string; message?: string }>({
    api: "createOrder",
    customer: {
      name: String(params.customer?.name || "").trim(),
      email: String(params.customer?.email || "").trim().toLowerCase(),
      phone: String(params.customer?.phone || "").trim(),
    },
    orderType,
    note: String(params.note || "").trim(),
    deliveryInfo: {
      address: String(params.deliveryInfo?.address || ""),
      scheduledAt: String(params.deliveryInfo?.scheduledAt || ""),
      note: String(params.deliveryInfo?.note || ""),
    },
    items: items.map((item) => ({
      productCode: item.productId,
      productType: item.productCategory,
      transactionType: item.transactionType,
      price: item.unitPrice,
      quantity: 1,
      note: item.snapshotNote,
    })),
  });
};

export const updateOrderDelivery = async (params: {
  orderId: string;
  deliveryInfo: Partial<OrderDeliveryInfo>;
}) => {
  return postJson<{
    ok: boolean;
    message?: string;
    deliveryInfo?: OrderDeliveryInfo;
  }>({
    api: "updateOrderDelivery",
    orderId: String(params.orderId || "").trim(),
    deliveryInfo: {
      address: String(params.deliveryInfo?.address || ""),
      scheduledAt: String(params.deliveryInfo?.scheduledAt || ""),
      note: String(params.deliveryInfo?.note || ""),
    },
  });
};

export const addPayment = async (params: {
  orderId: string;
  amount: number;
  method: string;
  note?: string;
  paymentKind?: "deposit" | "partial" | "final";
}) => {
  return postJson<{
    ok: boolean;
    message?: string;
    paidAmount?: number;
    remainingAmount?: number;
    paymentStatus?: PaymentStatus;
  }>({
    api: "addPayment",
    orderId: String(params.orderId || "").trim(),
    amount: Number(params.amount || 0),
    method: String(params.method || "").trim().toLowerCase(),
    note: String(params.note || "").trim(),
    paymentKind: params.paymentKind || undefined,
  });
};

export const updateOrderStatus = async (params: {
  orderId: string;
  status: OrderStatus;
  reason?: string;
}) => {
  return postJson<{
    ok: boolean;
    message?: string;
    orderStatus?: OrderStatus;
    paymentStatus?: PaymentStatus;
  }>({
    api: "updateOrderStatus",
    orderId: String(params.orderId || "").trim(),
    status: params.status,
    reason: String(params.reason || "").trim(),
  });
};
