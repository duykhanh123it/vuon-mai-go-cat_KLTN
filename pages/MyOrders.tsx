import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildOrderAddressMapUrl,
  formatOrderAddressSnapshot,
  getLocationDisplayInfo,
  getOrderAddressSnapshotSourceLabel,
  hasOrderAddressSnapshot,
} from "../types";
import type { AuthUser, OrderDetailResponse, OrderSummary } from "../types";
import { fetchOrderDetail, fetchOrders, fetchOrdersMeta } from "../utils/ordersApi";
import {
  formatCurrencyVnd,
  formatDateTimeVN,
  formatOrderStatusLabel,
  formatPaymentStatusLabel,
  formatTransactionTypeLabel,
} from "../utils/shopFormat";
import { getOrderStatusClassName } from "../utils/orderLifecycle";
import { getPaymentStatusClassName } from "../utils/paymentStatus";
import { useToast } from "../components/Toast";
import {
  getUserOrdersCacheScope,
  putOrdersInteractionDetail,
  readOrdersInteractionCache,
  replaceOrdersInteractionList,
  setOrdersInteractionSelectedOrder,
} from "../utils/ordersInteractionCache";

const MY_ORDERS_META_POLL_MS = 6_000;
const MY_ORDERS_DETAIL_STALE_MS = 20_000;

const sortOrdersByNewest = (list: OrderSummary[]) =>
  [...list].sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
  );

const upsertOrderInList = (list: OrderSummary[], nextOrder: OrderSummary) => {
  const safeOrderId = String(nextOrder?.orderId || "").trim();
  if (!safeOrderId) return list;

  const index = list.findIndex((item) => item.orderId === safeOrderId);
  if (index >= 0) {
    const next = [...list];
    next[index] = nextOrder;
    return next;
  }

  return sortOrdersByNewest([nextOrder, ...list]);
};

const buildCachedOrdersView = (
  scope: string,
  highlightedOrderId?: string,
) => {
  if (!scope) {
    return {
      cache: {
        list: [] as OrderSummary[],
        listSavedAt: 0,
        detailById: {} as Record<string, OrderDetailResponse>,
        detailSavedAtById: {} as Record<string, number>,
        selectedOrderId: "",
        dataVersion: "",
      },
      orders: [] as OrderSummary[],
      selectedOrderId: "",
      detail: null as OrderDetailResponse | null,
    };
  }

  const cache = readOrdersInteractionCache(scope);
  const orders = sortOrdersByNewest(cache.list || []);
  const preferredOrderId = String(highlightedOrderId || "").trim();
  const selectedOrderId =
    orders.find((item) => item.orderId === preferredOrderId)?.orderId ||
    preferredOrderId ||
    cache.selectedOrderId ||
    orders[0]?.orderId ||
    "";

  return {
    cache,
    orders,
    selectedOrderId,
    detail: selectedOrderId ? cache.detailById[selectedOrderId] || null : null,
  };
};

const getLocationBadgeClassName = (confidence: "high" | "medium" | "low") => {
  if (confidence === "high") return "bg-emerald-100 text-emerald-800";
  if (confidence === "medium") return "bg-sky-100 text-sky-800";
  return "bg-slate-200 text-slate-700";
};

interface MyOrdersPageProps {
  authUser?: AuthUser | null;
  highlightedOrderId?: string;
  onRequestLogin: () => void;
  onGoProducts: () => void;
  onOpenProduct: (productId: string) => void;
}

const EmptyOrders: React.FC<{ onGoProducts: () => void }> = ({
  onGoProducts,
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
      📄
    </div>
    <h2 className="text-2xl font-bold text-slate-900">
      Bạn chưa có đơn hàng nào
    </h2>
    <p className="mt-3 text-slate-500 leading-relaxed">
      Khi tạo đơn thuê hoặc mua cây, lịch sử sẽ xuất hiện tại đây.
    </p>
    <button
      type="button"
      onClick={onGoProducts}
      className="mt-8 inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
    >
      Xem sản phẩm
    </button>
  </div>
);

const MyOrdersPage: React.FC<MyOrdersPageProps> = ({
  authUser,
  highlightedOrderId,
  onRequestLogin,
  onGoProducts,
  onOpenProduct,
}) => {
  const { showToast } = useToast();
  const customerEmail = String(authUser?.email || "").trim().toLowerCase();
  const ordersScope = customerEmail
    ? getUserOrdersCacheScope(customerEmail)
    : "";
  const initialCachedView = useMemo(
    () => buildCachedOrdersView(ordersScope, highlightedOrderId),
    [highlightedOrderId, ordersScope],
  );

  const [orders, setOrders] = useState<OrderSummary[]>(initialCachedView.orders);
  const [loading, setLoading] = useState(!initialCachedView.orders.length);
  const [selectedOrderId, setSelectedOrderId] = useState(
    initialCachedView.selectedOrderId,
  );
  const [detail, setDetail] = useState<OrderDetailResponse | null>(
    initialCachedView.detail,
  );
  const [detailLoading, setDetailLoading] = useState(
    !initialCachedView.detail && !!initialCachedView.selectedOrderId,
  );
  const [listRefreshing, setListRefreshing] = useState(false);
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  const [ordersReady, setOrdersReady] = useState(
    initialCachedView.orders.length > 0,
  );

  const latestOrdersVersionRef = useRef(initialCachedView.cache.dataVersion || "");
  const selectedOrderIdRef = useRef(initialCachedView.selectedOrderId);
  const ordersRef = useRef<OrderSummary[]>(initialCachedView.orders);
  const detailCacheRef = useRef<Record<string, OrderDetailResponse>>(
    initialCachedView.cache.detailById || {},
  );
  const detailSavedAtRef = useRef<Record<string, number>>(
    initialCachedView.cache.detailSavedAtById || {},
  );
  const backgroundSyncingRef = useRef(false);

  const applyOrdersSnapshot = React.useCallback(
    (
      nextOrders: OrderSummary[],
      options?: {
        focusOrderId?: string;
        dataVersion?: string;
      },
    ) => {
      if (!ordersScope) return "";

      const sorted = sortOrdersByNewest(nextOrders);
      const focusOrderId = String(options?.focusOrderId || "").trim();
      const nextSelected =
        sorted.find((item) => item.orderId === focusOrderId)?.orderId ||
        focusOrderId ||
        selectedOrderIdRef.current ||
        sorted[0]?.orderId ||
        "";

      ordersRef.current = sorted;
      setOrders(sorted);
      replaceOrdersInteractionList(ordersScope, sorted, {
        selectedOrderId: nextSelected,
        dataVersion: options?.dataVersion,
      });

      if (options?.dataVersion !== undefined) {
        latestOrdersVersionRef.current = String(
          options.dataVersion || "",
        ).trim();
      }

      selectedOrderIdRef.current = nextSelected;
      setSelectedOrderId(nextSelected);

      if (!nextSelected) {
        setDetail(null);
      } else if (detailCacheRef.current[nextSelected]) {
        setDetail(detailCacheRef.current[nextSelected]);
      }

      return nextSelected;
    },
    [ordersScope],
  );

  const applyDetailSnapshot = React.useCallback(
    (
      nextDetail: OrderDetailResponse,
      options?: {
        dataVersion?: string;
      },
    ) => {
      if (!ordersScope) return;

      const safeOrderId = String(nextDetail?.order?.orderId || "").trim();
      if (!safeOrderId) return;

      detailCacheRef.current = {
        ...detailCacheRef.current,
        [safeOrderId]: nextDetail,
      };
      detailSavedAtRef.current = {
        ...detailSavedAtRef.current,
        [safeOrderId]: Date.now(),
      };

      putOrdersInteractionDetail(ordersScope, nextDetail, {
        selectedOrderId: safeOrderId,
        dataVersion: options?.dataVersion,
      });

      if (options?.dataVersion !== undefined) {
        latestOrdersVersionRef.current = String(
          options.dataVersion || "",
        ).trim();
      }

      setOrders((prev) => {
        const next = upsertOrderInList(prev, nextDetail.order);
        ordersRef.current = next;
        return next;
      });

      if (selectedOrderIdRef.current === safeOrderId) {
        setDetail(nextDetail);
      }
    },
    [ordersScope],
  );

  const loadOrders = React.useCallback(
    async (options?: {
      focusOrderId?: string;
      silent?: boolean;
      knownVersion?: string;
    }) => {
      if (!customerEmail || !ordersScope) return "";

      const silent = !!options?.silent;
      const hasRenderedOrders = ordersRef.current.length > 0;

      try {
        if (!silent) {
          if (hasRenderedOrders) {
            setListRefreshing(true);
          } else {
            setLoading(true);
          }
        }

        const data = await fetchOrders({ customerEmail });
        const nextSelected = applyOrdersSnapshot(data, {
          focusOrderId: options?.focusOrderId,
          dataVersion: options?.knownVersion,
        });
        return nextSelected;
      } catch (error) {
        if (!silent) {
          showToast(
            String(
              (error as any)?.message || error || "Không tải được đơn hàng",
            ),
            "error",
          );
        } else {
          console.error("MyOrders list sync error:", error);
        }
        return "";
      } finally {
        if (!silent) {
          setLoading(false);
          setListRefreshing(false);
        }
      }
    },
    [applyOrdersSnapshot, customerEmail, ordersScope, showToast],
  );

  const loadDetail = React.useCallback(
    async (
      orderId: string,
      options?: {
        silent?: boolean;
        force?: boolean;
      },
    ) => {
      const safeOrderId = String(orderId || "").trim();
      const silent = !!options?.silent;
      if (!customerEmail || !ordersScope) return null;

      if (!safeOrderId) {
        setDetail(null);
        return null;
      }

      const cachedDetail = detailCacheRef.current[safeOrderId] || null;
      const savedAt = Number(detailSavedAtRef.current[safeOrderId] || 0);
      const isFresh =
        !!cachedDetail &&
        !options?.force &&
        Date.now() - savedAt < MY_ORDERS_DETAIL_STALE_MS;

      if (cachedDetail && selectedOrderIdRef.current === safeOrderId) {
        setDetail(cachedDetail);
        setDetailLoading(false);
      }

      if (isFresh) {
        return cachedDetail;
      }

      try {
        if (!cachedDetail && !silent) {
          setDetailLoading(true);
        } else {
          setDetailRefreshing(true);
        }

        const data = await fetchOrderDetail(safeOrderId, {
          customerEmail,
        });
        applyDetailSnapshot(data);
        return data;
      } catch (error) {
        if (!silent) {
          showToast(
            String(
              (error as any)?.message || error || "Không tải được chi tiết đơn",
            ),
            "error",
          );
        } else {
          console.error("MyOrders detail sync error:", error);
        }
        return cachedDetail;
      } finally {
        setDetailLoading(false);
        setDetailRefreshing(false);
      }
    },
    [applyDetailSnapshot, customerEmail, ordersScope, showToast],
  );

  const syncOrdersByVersion = React.useCallback(async () => {
    if (
      backgroundSyncingRef.current ||
      !customerEmail ||
      !ordersScope ||
      loading ||
      detailLoading
    ) {
      return;
    }

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    backgroundSyncingRef.current = true;
    try {
      const meta = await fetchOrdersMeta({ customerEmail });
      const nextVersion = String(meta.dataVersion || "").trim();
      if (!nextVersion || nextVersion === latestOrdersVersionRef.current) {
        return;
      }

      const activeOrderId = String(
        selectedOrderIdRef.current || highlightedOrderId || "",
      ).trim();
      await loadOrders({
        focusOrderId: activeOrderId,
        silent: true,
        knownVersion: nextVersion,
      });
      if (activeOrderId) {
        await loadDetail(activeOrderId, { silent: true, force: true });
      }
    } catch (error) {
      console.error("MyOrders meta sync error:", error);
    } finally {
      backgroundSyncingRef.current = false;
    }
  }, [
    customerEmail,
    detailLoading,
    highlightedOrderId,
    loadDetail,
    loadOrders,
    loading,
    ordersScope,
  ]);

  useEffect(() => {
    const hydrated = buildCachedOrdersView(ordersScope, highlightedOrderId);

    ordersRef.current = hydrated.orders;
    detailCacheRef.current = hydrated.cache.detailById || {};
    detailSavedAtRef.current = hydrated.cache.detailSavedAtById || {};
    latestOrdersVersionRef.current = hydrated.cache.dataVersion || "";
    selectedOrderIdRef.current = hydrated.selectedOrderId;

    setOrders(hydrated.orders);
    setLoading(!!ordersScope && hydrated.orders.length === 0);
    setSelectedOrderId(hydrated.selectedOrderId);
    setDetail(hydrated.detail);
    setDetailLoading(!hydrated.detail && !!hydrated.selectedOrderId);
    setListRefreshing(false);
    setDetailRefreshing(false);
    setOrdersReady(hydrated.orders.length > 0);
  }, [highlightedOrderId, ordersScope]);

  useEffect(() => {
    if (!customerEmail || !ordersScope) return;
    let disposed = false;

    const bootstrap = async () => {
      const shouldStaySilent = ordersRef.current.length > 0;
      try {
        const meta = await fetchOrdersMeta({ customerEmail });
        if (disposed) return;
        latestOrdersVersionRef.current = String(meta.dataVersion || "").trim();
        await loadOrders({
          focusOrderId: highlightedOrderId,
          silent: shouldStaySilent,
          knownVersion: meta.dataVersion,
        });
      } catch (error) {
        if (disposed) return;
        await loadOrders({
          focusOrderId: highlightedOrderId,
          silent: shouldStaySilent,
        });
      } finally {
        if (!disposed) {
          setOrdersReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      disposed = true;
    };
  }, [customerEmail, highlightedOrderId, loadOrders, ordersScope]);

  useEffect(() => {
    if (!customerEmail || !selectedOrderId) {
      setDetail(null);
      return;
    }

    setOrdersInteractionSelectedOrder(ordersScope, selectedOrderId);
    selectedOrderIdRef.current = selectedOrderId;
    void loadDetail(selectedOrderId);
  }, [customerEmail, loadDetail, ordersScope, selectedOrderId]);

  useEffect(() => {
    if (!ordersReady || !customerEmail || !ordersScope) return;

    let disposed = false;
    let timer: number | null = null;

    const runSync = async () => {
      if (disposed) return;
      await syncOrdersByVersion();
    };

    const handleVisibility = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        void runSync();
      }
    };

    if (typeof window !== "undefined") {
      timer = window.setInterval(() => {
        void runSync();
      }, MY_ORDERS_META_POLL_MS);
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      disposed = true;
      if (timer != null && typeof window !== "undefined") {
        window.clearInterval(timer);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [customerEmail, ordersReady, ordersScope, syncOrdersByVersion]);

  const handleSelectOrder = React.useCallback(
    (orderId: string) => {
      const safeOrderId = String(orderId || "").trim();
      if (!safeOrderId) return;

      selectedOrderIdRef.current = safeOrderId;
      setSelectedOrderId(safeOrderId);

      if (ordersScope) {
        setOrdersInteractionSelectedOrder(ordersScope, safeOrderId);
      }

      const cachedDetail = detailCacheRef.current[safeOrderId];
      if (cachedDetail) {
        setDetail(cachedDetail);
        setDetailLoading(false);
      }
    },
    [ordersScope],
  );

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.total += 1;
        if (order.paymentStatus === "paid") acc.paid += 1;
        if (order.remainingAmount > 0) acc.debt += order.remainingAmount;
        return acc;
      },
      { total: 0, paid: 0, debt: 0 },
    );
  }, [orders]);

  const detailAddressText = useMemo(
    () =>
      formatOrderAddressSnapshot(detail?.order?.addressSnapshot) ||
      detail?.order?.deliveryInfo?.address ||
      "",
    [detail?.order?.addressSnapshot, detail?.order?.deliveryInfo?.address],
  );

  const detailMapUrl = useMemo(
    () =>
      buildOrderAddressMapUrl(
        detail?.order?.addressSnapshot,
        detail?.order?.deliveryInfo?.address,
      ),
    [detail?.order?.addressSnapshot, detail?.order?.deliveryInfo?.address],
  );

  const detailLocationInfo = useMemo(
    () => getLocationDisplayInfo(detail?.order?.addressSnapshot),
    [detail?.order?.addressSnapshot],
  );

  if (!authUser) {
    return (
      <div className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            🔐
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Đăng nhập để xem đơn hàng của bạn
          </h1>
          <p className="mt-3 text-slate-500 leading-relaxed">
            Hệ thống tra cứu theo email tài khoản. Hãy đăng nhập bằng đúng email
            đã dùng khi tạo đơn.
          </p>
          <button
            type="button"
            onClick={onRequestLogin}
            className="mt-8 inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Đơn hàng của tôi
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Theo dõi tiến độ đơn và thanh toán
          </h1>
          <p className="mt-2 text-slate-500">
            Email đang xem:{" "}
            <span className="font-semibold text-slate-700">
              {authUser.email}
            </span>
          </p>
          <p className="mt-2 text-sm text-emerald-600">
            {listRefreshing
              ? "Đang đồng bộ danh sách đơn ở nền..."
              : "Danh sách và chi tiết sẽ ưu tiên hiện từ cache trước, rồi tự làm mới nền khi cần."}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Tổng đơn</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {totals.total}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Đã thanh toán đủ</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {totals.paid}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Công nợ còn lại</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">
                {formatCurrencyVnd(totals.debt)}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm text-slate-500">
            Đang tải danh sách đơn hàng...
          </div>
        ) : orders.length === 0 ? (
          <EmptyOrders onGoProducts={onGoProducts} />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="space-y-4">
              {orders.map((order) => {
                const isActive = order.orderId === selectedOrderId;
                return (
                  <button
                    key={order.orderId}
                    type="button"
                    onClick={() => handleSelectOrder(order.orderId)}
                    className={`w-full rounded-3xl border p-5 text-left shadow-sm transition ${
                      isActive
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {order.orderId}
                        </p>
                        <h2 className="mt-2 text-lg font-bold text-slate-900">
                          Đơn{" "}
                          {formatTransactionTypeLabel(
                            order.orderType,
                          ).toLowerCase()}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                          Tạo lúc {formatDateTimeVN(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Tổng tiền</p>
                        <p className="mt-1 text-lg font-bold text-amber-600">
                          {formatCurrencyVnd(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClassName(order.orderStatus)}`}
                      >
                        {formatOrderStatusLabel(order.orderStatus)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusClassName(order.paymentStatus)}`}
                      >
                        {formatPaymentStatusLabel(order.paymentStatus)}
                      </span>
                    </div>
                    <div className="mt-4 text-sm text-slate-500">
                      Còn lại:{" "}
                      <span className="font-semibold text-slate-700">
                        {formatCurrencyVnd(order.remainingAmount)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {detailLoading || !detail ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                  {detailLoading
                    ? "Đang tải chi tiết đơn hàng..."
                    : "Chọn một đơn để xem chi tiết."}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {detail.order.orderId}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">
                        Đơn{" "}
                        {formatTransactionTypeLabel(
                          detail.order.orderType,
                        ).toLowerCase()}
                      </h2>
                      <p className="mt-2 text-slate-500">
                        Cập nhật gần nhất:{" "}
                        {formatDateTimeVN(
                          detail.order.updatedAt || detail.order.createdAt,
                        )}
                      </p>
                      {detailRefreshing && (
                        <p className="mt-2 text-sm font-medium text-emerald-600">
                          Đang đồng bộ chi tiết mới nhất ở nền...
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClassName(detail.order.orderStatus)}`}
                      >
                        {formatOrderStatusLabel(detail.order.orderStatus)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusClassName(detail.order.paymentStatus)}`}
                      >
                        {formatPaymentStatusLabel(detail.order.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Tổng đơn</p>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {formatCurrencyVnd(detail.order.totalAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Đã thanh toán</p>
                      <p className="mt-2 text-xl font-bold text-green-600">
                        {formatCurrencyVnd(detail.order.paidAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Còn lại</p>
                      <p className="mt-2 text-xl font-bold text-amber-600">
                        {formatCurrencyVnd(detail.order.remainingAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-5">
                    <h3 className="text-lg font-bold text-slate-900">
                      Thông tin giao / bàn giao
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-slate-500">Người nhận</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {hasOrderAddressSnapshot(detail.order.addressSnapshot)
                            ? detail.order.addressSnapshot.recipientName ||
                              detail.order.customerName ||
                              "--"
                            : detail.order.customerName || "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Điện thoại nhận</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {hasOrderAddressSnapshot(detail.order.addressSnapshot)
                            ? detail.order.addressSnapshot.recipientPhone ||
                              detail.order.customerPhone ||
                              "--"
                            : detail.order.customerPhone || "--"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-slate-500">Địa chỉ snapshot</p>
                          {hasOrderAddressSnapshot(detail.order.addressSnapshot) && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              {getOrderAddressSnapshotSourceLabel(
                                detail.order.addressSnapshot,
                              )}
                            </span>
                          )}
                          {detail.order.addressSnapshot.label && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {detail.order.addressSnapshot.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLocationBadgeClassName(
                              detailLocationInfo.confidence,
                            )}`}
                          >
                            {detailLocationInfo.icon} {detailLocationInfo.sourceLabel}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {detailLocationInfo.confidenceLabel}
                          </span>
                        </div>
                        {detailMapUrl ? (
                          <div className="mt-1 space-y-2">
                            <a
                              href={detailMapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline whitespace-pre-line leading-relaxed text-amber-700 underline decoration-amber-300 underline-offset-4 transition hover:text-amber-800"
                            >
                              {detailAddressText || "--"}
                            </a>
                            <p className="text-sm text-slate-500">
                              {detailLocationInfo.helperText}
                            </p>
                            <div>
                              <a
                                href={detailMapUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                              >
                                Mở Google Maps ↗
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 space-y-2">
                            <p className="whitespace-pre-line leading-relaxed text-slate-700">
                              {detailAddressText || "--"}
                            </p>
                            <p className="text-sm text-slate-500">
                              {detailLocationInfo.helperText}
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">
                          Thời gian giao dự kiến
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {detail.order.deliveryInfo.scheduledAt
                            ? formatDateTimeVN(detail.order.deliveryInfo.scheduledAt)
                            : "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Cập nhật giao hàng</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {detail.order.deliveryInfo.updatedAt
                            ? formatDateTimeVN(detail.order.deliveryInfo.updatedAt)
                            : "--"}
                        </p>
                      </div>
                      {(detail.order.deliveryInfo.note ||
                        detail.order.addressSnapshot.note) && (
                        <div className="sm:col-span-2">
                          <p className="text-sm text-slate-500">
                            Ghi chú giao hàng
                          </p>
                          <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">
                            {detail.order.deliveryInfo.note ||
                              detail.order.addressSnapshot.note}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Danh sách cây trong đơn
                    </h3>
                    <div className="mt-4 space-y-3">
                      {detail.items.map((item) => (
                        <div
                          key={item.orderItemId}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <button
                                type="button"
                                onClick={() => onOpenProduct(item.productCode)}
                                className="text-left text-base font-semibold text-slate-900 hover:text-amber-700"
                              >
                                {item.productCode}
                              </button>
                              <p className="mt-1 text-sm text-slate-500">
                                {item.productType} •{" "}
                                {formatTransactionTypeLabel(
                                  item.transactionType,
                                )}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-500">Giá trị</p>
                              <p className="text-lg font-bold text-amber-600">
                                {formatCurrencyVnd(item.lineTotal)}
                              </p>
                            </div>
                          </div>
                          {item.snapshotNote && (
                            <p className="mt-3 text-sm leading-relaxed text-slate-500">
                              {item.snapshotNote}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Lịch sử thanh toán
                    </h3>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      <table className="min-w-full border-separate border-spacing-0">
                        <thead>
                          <tr className="bg-slate-50 text-left text-sm text-slate-600">
                            <th className="px-4 py-3 font-semibold">
                              Thời gian
                            </th>
                            <th className="px-4 py-3 font-semibold">Số tiền</th>
                            <th className="px-4 py-3 font-semibold">
                              Phương thức
                            </th>
                            <th className="px-4 py-3 font-semibold">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.payments.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-6 text-center text-sm text-slate-500"
                              >
                                Chưa có khoản thanh toán nào.
                              </td>
                            </tr>
                          ) : (
                            detail.payments.map((payment) => (
                              <tr key={payment.paymentId}>
                                <td className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                                  {formatDateTimeVN(payment.createdAt)}
                                </td>
                                <td className="border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
                                  {formatCurrencyVnd(payment.amount)}
                                </td>
                                <td className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600 uppercase">
                                  {payment.method}
                                </td>
                                <td className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                                  {payment.note || "--"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrdersPage;
