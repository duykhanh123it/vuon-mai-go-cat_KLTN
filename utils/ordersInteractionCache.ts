import type { OrderDetailResponse, OrderSummary, PaymentRecord } from "../types";

export interface OrdersInteractionCacheSnapshot {
  list: OrderSummary[];
  listSavedAt: number;
  detailById: Record<string, OrderDetailResponse>;
  detailSavedAtById: Record<string, number>;
  selectedOrderId: string;
  dataVersion: string;
}

const DEFAULT_SNAPSHOT: OrdersInteractionCacheSnapshot = {
  list: [],
  listSavedAt: 0,
  detailById: {},
  detailSavedAtById: {},
  selectedOrderId: "",
  dataVersion: "",
};

const caches = new Map<string, OrdersInteractionCacheSnapshot>();

const cloneValue = <T,>(value: T): T => {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const ensureScope = (scope: string) => {
  const safeScope = String(scope || "").trim();
  if (!safeScope) {
    throw new Error("Orders cache scope is required");
  }
  return safeScope;
};

const getMutableSnapshot = (scope: string) => {
  const safeScope = ensureScope(scope);
  if (!caches.has(safeScope)) {
    caches.set(safeScope, cloneValue(DEFAULT_SNAPSHOT));
  }
  return caches.get(safeScope)!;
};

const upsertOrderInList = (list: OrderSummary[], nextOrder: OrderSummary) => {
  const safeOrderId = String(nextOrder?.orderId || "").trim();
  if (!safeOrderId) return list;

  const index = list.findIndex((item) => item.orderId === safeOrderId);
  if (index >= 0) {
    const next = [...list];
    next[index] = cloneValue(nextOrder);
    return next;
  }

  return [cloneValue(nextOrder), ...list];
};

export const getAdminOrdersCacheScope = () => "orders:admin";

export const getUserOrdersCacheScope = (email?: string | null) =>
  `orders:user:${String(email || "").trim().toLowerCase()}`;

export const readOrdersInteractionCache = (
  scope: string,
): OrdersInteractionCacheSnapshot => cloneValue(getMutableSnapshot(scope));

export const replaceOrdersInteractionList = (
  scope: string,
  list: OrderSummary[],
  options?: {
    selectedOrderId?: string;
    dataVersion?: string;
  },
) => {
  const snapshot = getMutableSnapshot(scope);
  snapshot.list = cloneValue(Array.isArray(list) ? list : []);
  snapshot.listSavedAt = Date.now();

  if (options?.selectedOrderId !== undefined) {
    snapshot.selectedOrderId = String(options.selectedOrderId || "").trim();
  } else if (
    snapshot.selectedOrderId &&
    !snapshot.list.some((item) => item.orderId === snapshot.selectedOrderId)
  ) {
    snapshot.selectedOrderId = snapshot.list[0]?.orderId || "";
  } else if (!snapshot.selectedOrderId) {
    snapshot.selectedOrderId = snapshot.list[0]?.orderId || "";
  }

  if (options?.dataVersion !== undefined) {
    snapshot.dataVersion = String(options.dataVersion || "").trim();
  }
};

export const setOrdersInteractionSelectedOrder = (
  scope: string,
  orderId?: string | null,
) => {
  const snapshot = getMutableSnapshot(scope);
  snapshot.selectedOrderId = String(orderId || "").trim();
};

export const setOrdersInteractionDataVersion = (
  scope: string,
  dataVersion?: string | null,
) => {
  const snapshot = getMutableSnapshot(scope);
  snapshot.dataVersion = String(dataVersion || "").trim();
};

export const upsertOrdersInteractionOrder = (
  scope: string,
  order: OrderSummary,
  options?: {
    selectedOrderId?: string;
    dataVersion?: string;
  },
) => {
  const snapshot = getMutableSnapshot(scope);
  snapshot.list = upsertOrderInList(snapshot.list, order);
  snapshot.listSavedAt = Date.now();

  const safeOrderId = String(order?.orderId || "").trim();
  if (safeOrderId && snapshot.detailById[safeOrderId]) {
    snapshot.detailById[safeOrderId] = {
      ...cloneValue(snapshot.detailById[safeOrderId]),
      order: cloneValue(order),
    };
    snapshot.detailSavedAtById[safeOrderId] = Date.now();
  }

  if (options?.selectedOrderId !== undefined) {
    snapshot.selectedOrderId = String(options.selectedOrderId || "").trim();
  }

  if (options?.dataVersion !== undefined) {
    snapshot.dataVersion = String(options.dataVersion || "").trim();
  }
};

export const putOrdersInteractionDetail = (
  scope: string,
  detail: OrderDetailResponse,
  options?: {
    selectedOrderId?: string;
    dataVersion?: string;
  },
) => {
  const snapshot = getMutableSnapshot(scope);
  const safeOrderId = String(detail?.order?.orderId || "").trim();
  if (!safeOrderId) return;

  snapshot.detailById[safeOrderId] = cloneValue(detail);
  snapshot.detailSavedAtById[safeOrderId] = Date.now();
  snapshot.list = upsertOrderInList(snapshot.list, detail.order);
  snapshot.listSavedAt = Date.now();

  if (options?.selectedOrderId !== undefined) {
    snapshot.selectedOrderId = String(options.selectedOrderId || "").trim();
  }

  if (options?.dataVersion !== undefined) {
    snapshot.dataVersion = String(options.dataVersion || "").trim();
  }
};

export const appendOrdersInteractionPayment = (
  scope: string,
  orderId: string,
  payment: PaymentRecord,
  updatedOrder?: OrderSummary | null,
) => {
  const snapshot = getMutableSnapshot(scope);
  const safeOrderId = String(orderId || "").trim();
  if (!safeOrderId) return;

  const existingDetail = snapshot.detailById[safeOrderId];
  if (!existingDetail) {
    if (updatedOrder) {
      upsertOrdersInteractionOrder(scope, updatedOrder);
    }
    return;
  }

  const nextDetail: OrderDetailResponse = {
    ...cloneValue(existingDetail),
    order: updatedOrder ? cloneValue(updatedOrder) : cloneValue(existingDetail.order),
    payments: [...cloneValue(existingDetail.payments), cloneValue(payment)],
  };

  snapshot.detailById[safeOrderId] = nextDetail;
  snapshot.detailSavedAtById[safeOrderId] = Date.now();
  snapshot.list = upsertOrderInList(snapshot.list, nextDetail.order);
  snapshot.listSavedAt = Date.now();
};

export const removeOrdersInteractionDetail = (scope: string, orderId: string) => {
  const snapshot = getMutableSnapshot(scope);
  const safeOrderId = String(orderId || "").trim();
  if (!safeOrderId) return;
  delete snapshot.detailById[safeOrderId];
  delete snapshot.detailSavedAtById[safeOrderId];
};

export const clearOrdersInteractionCache = (scope: string) => {
  caches.delete(ensureScope(scope));
};
