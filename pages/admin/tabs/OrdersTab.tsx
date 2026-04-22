import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildOrderAddressMapUrl,
  formatOrderAddressSnapshot,
  getLocationDisplayInfo,
  getOrderAddressSnapshotSourceLabel,
  hasOrderAddressSnapshot,
  normalizeOrderAddressSnapshot,
} from "../../../types";
import type {
  AuthUser,
  OrderAddressSnapshot,
  OrderDeliveryInfo,
  OrderDetailResponse,
  OrderStatus,
  OrderSummary,
} from "../../../types";
import {
  addPayment,
  fetchOrderDetail,
  fetchOrders,
  fetchOrdersMeta,
  updateOrderDelivery,
  updateOrderStatus,
} from "../../../utils/ordersApi";
import {
  getAllowedOrderTransitions,
  getOrderStatusClassName,
} from "../../../utils/orderLifecycle";
import {
  derivePaymentStatus,
  getPaymentStatusClassName,
} from "../../../utils/paymentStatus";
import {
  formatCurrencyVnd,
  formatDateTimeVN,
  formatOrderStatusLabel,
  formatPaymentStatusLabel,
  formatTransactionTypeLabel,
} from "../../../utils/shopFormat";
import { useToast } from "../../../components/Toast";
import {
  getAdminOrdersCacheScope,
  putOrdersInteractionDetail,
  readOrdersInteractionCache,
  replaceOrdersInteractionList,
  setOrdersInteractionDataVersion,
  setOrdersInteractionSelectedOrder,
  upsertOrdersInteractionOrder,
} from "../../../utils/ordersInteractionCache";
import { StatCard, Th, Td } from "../shared";

interface OrdersTabProps {
  authUser?: AuthUser | null;
}

const ORDERS_META_POLL_MS = 2_500;
const ADMIN_ORDERS_DETAIL_STALE_MS = 20_000;
const ADMIN_ORDERS_CACHE_SCOPE = getAdminOrdersCacheScope();
const ORDERS_ITEMS_PER_PAGE = 10;

type PendingOrderAction = {
  actionKey: string;
  label: string;
  kind: "status" | "payment" | "delivery";
  startedAt: number;
};

const EMPTY_DELIVERY_INFO: OrderDeliveryInfo = {
  address: "",
  scheduledAt: "",
  note: "",
  updatedAt: "",
};

const normalizeDeliveryForm = (
  value?: Partial<OrderDeliveryInfo> | null,
): OrderDeliveryInfo => ({
  address: String(value?.address || "").trim(),
  scheduledAt: String(value?.scheduledAt || "").trim(),
  note: String(value?.note || "").trim(),
  updatedAt: String(value?.updatedAt || "").trim(),
});

const getDeliveryFormSignature = (value?: Partial<OrderDeliveryInfo> | null) =>
  JSON.stringify({
    address: String(value?.address || "").trim(),
    scheduledAt: String(value?.scheduledAt || "").trim(),
    note: String(value?.note || "").trim(),
  });

const toDateTimeLocalValue = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = raw.replace(" ", "T");
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) {
    const year = direct.getFullYear();
    const month = `${direct.getMonth() + 1}`.padStart(2, "0");
    const day = `${direct.getDate()}`.padStart(2, "0");
    const hour = `${direct.getHours()}`.padStart(2, "0");
    const minute = `${direct.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  const slashMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/,
  );
  if (slashMatch) {
    const [, dd, mm, yyyy, hh = "00", min = "00"] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }

  const isoMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/,
  );
  if (isoMatch) {
    const [, yyyy, mm, dd, hh = "00", min = "00"] = isoMatch;
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  return "";
};

const getStatusActionLabel = (
  order: Pick<OrderSummary, "orderType" | "orderStatus"> | null | undefined,
  nextStatus: OrderStatus,
) => {
  const orderType = order?.orderType || "buy";
  const currentStatus = order?.orderStatus || "new";

  if (nextStatus === "confirmed") {
    if (currentStatus === "delivering") {
      return "Trả về confirmed";
    }
    return orderType === "rent" ? "Xác nhận cọc" : "Xác nhận giữ cây";
  }
  if (nextStatus === "delivering") {
    return "Bắt đầu giao hàng";
  }
  if (nextStatus === "active") {
    return "Bàn giao cây";
  }
  if (nextStatus === "completed") {
    return orderType === "rent" ? "Xác nhận trả cây" : "Hoàn tất giao hàng";
  }
  if (nextStatus === "cancelled") {
    return "Hủy đơn";
  }
  return formatOrderStatusLabel(nextStatus);
};

const getLifecycleHelpText = (order: OrderSummary | null | undefined) => {
  if (!order) {
    return "Backend sẽ kiểm tra rule chuyển trạng thái, khóa cây và đồng bộ inventory trước khi ghi xuống sheet.";
  }

  if (order.orderType === "rent") {
    if (order.orderStatus === "confirmed") {
      return "Đơn thuê đã cọc và đang giữ cây. Khi bàn giao xong, chuyển sang active để cây thành rented_out.";
    }
    if (order.orderStatus === "active") {
      return "Chỉ bấm xác nhận trả cây khi cây đã về vườn và đủ điều kiện mở inventory về available.";
    }
    if (order.orderStatus === "completed") {
      return "Đơn thuê đã khép vòng đời. Inventory của cây trong đơn đã được mở lại để sẵn sàng cho giao dịch mới.";
    }
    return "Đơn thuê đi theo luồng new → confirmed → active → completed. new chưa lock cây, confirmed bắt đầu giữ cây thật.";
  }

  if (order.orderStatus === "confirmed") {
    return "Đơn bán đã được giữ cây. Hãy nhập đủ thông tin giao hàng trước khi chuyển sang delivering để nhân viên vận hành không bị mù thông tin.";
  }
  if (order.orderStatus === "delivering") {
    return "Đơn bán đang giao hàng. Cây vẫn bị giữ cho đến khi hoàn tất hoặc được trả về confirmed. Chỉ hoàn tất khi đã giao xong và thanh toán đủ.";
  }
  if (order.orderStatus === "completed") {
    return "Đơn bán đã hoàn tất. Inventory của cây trong đơn đã được chốt sold và không quay lại kho khả dụng.";
  }

  return "Đơn bán đi theo luồng new → confirmed → delivering → completed. confirmed giữ cây, delivering là bước giao hàng thực tế.";
};

const hasPinnedOrderAddress = (
  value?: Partial<OrderAddressSnapshot> | null,
): boolean => {
  const address = normalizeOrderAddressSnapshot(value);
  return (
    typeof address.lat === "number" &&
    Number.isFinite(address.lat) &&
    typeof address.lng === "number" &&
    Number.isFinite(address.lng)
  );
};

const getOrderAddressTone = (value?: Partial<OrderAddressSnapshot> | null) => {
  const locationInfo = getLocationDisplayInfo(value);

  if (locationInfo.confidence === "high") {
    return {
      icon: locationInfo.icon,
      accuracyLabel: locationInfo.confidenceLabel,
      mapLabel: locationInfo.sourceLabel,
      containerClass: "border-emerald-200 bg-emerald-50/80",
      badgeClass: "border-emerald-200 bg-white text-emerald-700",
      linkClass:
        "font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4 transition hover:text-emerald-800",
      actionClass:
        "border-emerald-200 bg-white text-emerald-800 transition hover:bg-emerald-100",
      hintClass: "text-xs text-emerald-700",
      hintText: locationInfo.adminHelperText,
    };
  }

  if (locationInfo.confidence === "medium") {
    return {
      icon: locationInfo.icon,
      accuracyLabel: locationInfo.confidenceLabel,
      mapLabel: locationInfo.sourceLabel,
      containerClass: "border-sky-200 bg-sky-50/80",
      badgeClass: "border-sky-200 bg-white text-sky-700",
      linkClass:
        "font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-800",
      actionClass:
        "border-sky-200 bg-white text-sky-800 transition hover:bg-sky-100",
      hintClass: "text-xs text-sky-700",
      hintText: locationInfo.adminHelperText,
    };
  }

  return {
    icon: locationInfo.icon,
    accuracyLabel: locationInfo.confidenceLabel,
    mapLabel: locationInfo.sourceLabel,
    containerClass: "border-slate-200 bg-slate-50",
    badgeClass: "border-slate-200 bg-white text-slate-600",
    linkClass:
      "text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900",
    actionClass:
      "border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100",
    hintClass: "text-xs text-slate-500",
    hintText: locationInfo.adminHelperText,
  };
};

const getCopyableOrderAddressText = (
  value?: Partial<OrderAddressSnapshot> | null,
  fallbackAddress?: string | null,
) =>
  (
    formatOrderAddressSnapshot(value) || String(fallbackAddress || "").trim()
  ).trim();

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

const cloneOrderState = <T,>(value: T): T => {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const formatOptimisticDateTime = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const getStatusPendingLabel = (
  order: Pick<OrderSummary, "orderType" | "orderStatus"> | null | undefined,
  nextStatus: OrderStatus,
) => {
  if (nextStatus === "confirmed") {
    return order?.orderType === "rent" && order?.orderStatus !== "delivering"
      ? "Đang xác nhận cọc..."
      : "Đang xác nhận đơn...";
  }
  if (nextStatus === "delivering") return "Đang bắt đầu giao hàng...";
  if (nextStatus === "active") return "Đang bàn giao cây...";
  if (nextStatus === "completed") {
    return order?.orderType === "rent"
      ? "Đang xác nhận trả cây..."
      : "Đang hoàn tất giao hàng...";
  }
  if (nextStatus === "cancelled") return "Đang hủy đơn...";
  return `Đang cập nhật ${formatOrderStatusLabel(nextStatus).toLowerCase()}...`;
};

const attachDerivedOrderState = (order: OrderSummary): OrderSummary => ({
  ...order,
  allowedTransitions: getAllowedOrderTransitions(
    order.orderStatus,
    order.paymentStatus,
    order.orderType,
  ),
});

const OrdersTab: React.FC<OrdersTabProps> = ({ authUser }) => {
  const { showToast } = useToast();
  const initialCachedAdminView = readOrdersInteractionCache(
    ADMIN_ORDERS_CACHE_SCOPE,
  );
  const initialOrders = sortOrdersByNewest(initialCachedAdminView.list || []);
  const initialSelectedOrderId =
    initialCachedAdminView.selectedOrderId || initialOrders[0]?.orderId || "";
  const initialDetail = initialSelectedOrderId
    ? initialCachedAdminView.detailById[initialSelectedOrderId] || null
    : null;

  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders);
  const [loading, setLoading] = useState(!initialOrders.length);
  const [selectedOrderId, setSelectedOrderId] = useState(
    initialSelectedOrderId,
  );
  const [detail, setDetail] = useState<OrderDetailResponse | null>(
    initialDetail,
  );
  const [detailLoading, setDetailLoading] = useState(
    !initialDetail && !!initialSelectedOrderId,
  );
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentKind, setPaymentKind] = useState<
    "deposit" | "partial" | "final"
  >("deposit");
  const [paymentNote, setPaymentNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [copiedAddressKey, setCopiedAddressKey] = useState("");
  const [deliveryForm, setDeliveryForm] =
    useState<OrderDeliveryInfo>(EMPTY_DELIVERY_INFO);
  const [pendingActionsByOrderId, setPendingActionsByOrderId] = useState<
    Record<string, PendingOrderAction>
  >({});
  const [ordersReady, setOrdersReady] = useState(initialOrders.length > 0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageInput, setOrdersPageInput] = useState("1");

  const latestOrdersVersionRef = React.useRef(
    initialCachedAdminView.dataVersion || "",
  );
  const selectedOrderIdRef = React.useRef(initialSelectedOrderId);
  const ordersRef = React.useRef<OrderSummary[]>(initialOrders);
  const detailCacheRef = React.useRef<Record<string, OrderDetailResponse>>(
    initialCachedAdminView.detailById || {},
  );
  const detailSavedAtRef = React.useRef<Record<string, number>>(
    initialCachedAdminView.detailSavedAtById || {},
  );
  const modalOpenRef = React.useRef(false);
  const backgroundSyncingRef = React.useRef(false);
  const copiedAddressTimerRef = React.useRef<number | null>(null);
  const hasPendingActions = useMemo(
    () => Object.keys(pendingActionsByOrderId).length > 0,
    [pendingActionsByOrderId],
  );
  const acting = !!pendingActionsByOrderId[selectedOrderId];

  useEffect(() => {
    selectedOrderIdRef.current = selectedOrderId;
    setOrdersInteractionSelectedOrder(
      ADMIN_ORDERS_CACHE_SCOPE,
      selectedOrderId,
    );
  }, [selectedOrderId]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    modalOpenRef.current = modalOpen;
  }, [modalOpen]);

  useEffect(() => {
    return () => {
      if (
        copiedAddressTimerRef.current != null &&
        typeof window !== "undefined"
      ) {
        window.clearTimeout(copiedAddressTimerRef.current);
      }
    };
  }, []);

  const hydrateDetailView = React.useCallback(
    (
      data: OrderDetailResponse,
      options?: {
        resetForms?: boolean;
      },
    ) => {
      setDetail(data);

      if (options?.resetForms ?? true) {
        setPaymentAmount("");
        setPaymentMethod("cash");
        setPaymentKind(data.order.paidAmount > 0 ? "partial" : "deposit");
        setPaymentNote("");
        setCancelReason("");
        setDeliveryForm(normalizeDeliveryForm(data.order.deliveryInfo));
      }
    },
    [],
  );

  const applyOrdersSnapshot = React.useCallback(
    (
      nextOrders: OrderSummary[],
      options?: {
        focusOrderId?: string;
        dataVersion?: string;
      },
    ) => {
      const sorted = sortOrdersByNewest(
        nextOrders.map((item) => attachDerivedOrderState(item)),
      );
      const focusOrderId = String(options?.focusOrderId || "").trim();
      const nextOrderId =
        sorted.find((item) => item.orderId === focusOrderId)?.orderId ||
        focusOrderId ||
        selectedOrderIdRef.current ||
        sorted[0]?.orderId ||
        "";

      ordersRef.current = sorted;
      setOrders(sorted);
      replaceOrdersInteractionList(ADMIN_ORDERS_CACHE_SCOPE, sorted, {
        selectedOrderId: nextOrderId,
        dataVersion: options?.dataVersion,
      });

      if (options?.dataVersion !== undefined) {
        latestOrdersVersionRef.current = String(
          options.dataVersion || "",
        ).trim();
      }

      selectedOrderIdRef.current = nextOrderId;
      setSelectedOrderId(nextOrderId);

      if (!nextOrderId) {
        setDetail(null);
      } else if (detailCacheRef.current[nextOrderId]) {
        setDetail(detailCacheRef.current[nextOrderId]);
      }

      return nextOrderId;
    },
    [],
  );

  const applyDetailSnapshot = React.useCallback(
    (
      nextDetail: OrderDetailResponse,
      options?: {
        dataVersion?: string;
        resetForms?: boolean;
      },
    ) => {
      const safeOrderId = String(nextDetail?.order?.orderId || "").trim();
      if (!safeOrderId) return;

      const clonedDetail = {
        ...cloneOrderState(nextDetail),
        order: attachDerivedOrderState(cloneOrderState(nextDetail.order)),
      };
      detailCacheRef.current = {
        ...detailCacheRef.current,
        [safeOrderId]: clonedDetail,
      };
      detailSavedAtRef.current = {
        ...detailSavedAtRef.current,
        [safeOrderId]: Date.now(),
      };

      putOrdersInteractionDetail(ADMIN_ORDERS_CACHE_SCOPE, clonedDetail, {
        selectedOrderId: safeOrderId,
        dataVersion: options?.dataVersion,
      });

      if (options?.dataVersion !== undefined) {
        latestOrdersVersionRef.current = String(
          options.dataVersion || "",
        ).trim();
      }

      setOrders((prev) => {
        const next = upsertOrderInList(prev, clonedDetail.order);
        ordersRef.current = next;
        return next;
      });

      if (selectedOrderIdRef.current === safeOrderId) {
        hydrateDetailView(clonedDetail, {
          resetForms: options?.resetForms,
        });
      }
    },
    [hydrateDetailView],
  );

  const applyOrderSummaryLocally = React.useCallback(
    (
      nextOrder: OrderSummary,
      options?: {
        dataVersion?: string;
      },
    ) => {
      const normalizedOrder = attachDerivedOrderState(
        cloneOrderState(nextOrder),
      );
      const safeOrderId = String(normalizedOrder?.orderId || "").trim();
      if (!safeOrderId) return;

      upsertOrdersInteractionOrder(ADMIN_ORDERS_CACHE_SCOPE, normalizedOrder, {
        selectedOrderId: selectedOrderIdRef.current,
        dataVersion: options?.dataVersion,
      });

      if (options?.dataVersion !== undefined) {
        latestOrdersVersionRef.current = String(
          options.dataVersion || "",
        ).trim();
      }

      setOrders((prev) => {
        const next = upsertOrderInList(prev, normalizedOrder);
        ordersRef.current = next;
        return next;
      });

      const cachedDetail = detailCacheRef.current[safeOrderId];
      if (cachedDetail) {
        const nextDetail = {
          ...cachedDetail,
          order: cloneOrderState(normalizedOrder),
        };
        detailCacheRef.current = {
          ...detailCacheRef.current,
          [safeOrderId]: nextDetail,
        };
        detailSavedAtRef.current = {
          ...detailSavedAtRef.current,
          [safeOrderId]: Date.now(),
        };
        putOrdersInteractionDetail(ADMIN_ORDERS_CACHE_SCOPE, nextDetail, {
          selectedOrderId: safeOrderId,
          dataVersion: options?.dataVersion,
        });

        if (selectedOrderIdRef.current === safeOrderId) {
          setDetail(nextDetail);
        }
      }
    },
    [],
  );

  const setPendingAction = React.useCallback(
    (orderId: string, pending: PendingOrderAction) => {
      const safeOrderId = String(orderId || "").trim();
      if (!safeOrderId) return;
      setPendingActionsByOrderId((prev) => ({
        ...prev,
        [safeOrderId]: pending,
      }));
    },
    [],
  );

  const clearPendingAction = React.useCallback((orderId: string) => {
    const safeOrderId = String(orderId || "").trim();
    if (!safeOrderId) return;
    setPendingActionsByOrderId((prev) => {
      if (!prev[safeOrderId]) return prev;
      const next = { ...prev };
      delete next[safeOrderId];
      return next;
    });
  }, []);

  const getCurrentOrderSnapshot = React.useCallback(
    (orderId: string) => {
      const safeOrderId = String(orderId || "").trim();
      if (!safeOrderId) {
        return {
          order: null as OrderSummary | null,
          detail: null as OrderDetailResponse | null,
        };
      }

      const cachedDetail =
        detailCacheRef.current[safeOrderId] ||
        (detail?.order?.orderId === safeOrderId ? detail : null) ||
        null;
      const orderFromList =
        ordersRef.current.find((item) => item.orderId === safeOrderId) || null;

      return {
        order: cloneOrderState(cachedDetail?.order || orderFromList || null),
        detail: cloneOrderState(cachedDetail),
      };
    },
    [detail],
  );

  const restoreOrderSnapshot = React.useCallback(
    (snapshot: {
      order?: OrderSummary | null;
      detail?: OrderDetailResponse | null;
      deliveryForm?: OrderDeliveryInfo | null;
    }) => {
      if (snapshot.detail?.order?.orderId) {
        applyDetailSnapshot(snapshot.detail, { resetForms: false });
      } else if (snapshot.order?.orderId) {
        applyOrderSummaryLocally(snapshot.order);
      }

      if (snapshot.deliveryForm) {
        setDeliveryForm(normalizeDeliveryForm(snapshot.deliveryForm));
      }
    },
    [applyDetailSnapshot, applyOrderSummaryLocally],
  );

  const loadOrders = React.useCallback(
    async (options?: {
      focusOrderId?: string;
      silent?: boolean;
      knownVersion?: string;
    }) => {
      const focusOrderId = String(options?.focusOrderId || "").trim();
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

        const data = await fetchOrders();
        return applyOrdersSnapshot(data, {
          focusOrderId,
          dataVersion: options?.knownVersion,
        });
      } catch (error) {
        if (!silent) {
          showToast(
            String(
              (error as any)?.message || error || "Không tải được đơn hàng",
            ),
            "error",
          );
        } else {
          console.error("Orders list sync error:", error);
        }
        return "";
      } finally {
        if (!silent) {
          setLoading(false);
          setListRefreshing(false);
        }
      }
    },
    [applyOrdersSnapshot, showToast],
  );

  const loadDetail = React.useCallback(
    async (
      orderId: string,
      options?: {
        silent?: boolean;
        force?: boolean;
        resetForms?: boolean;
      },
    ) => {
      const safeOrderId = String(orderId || "").trim();
      const silent = !!options?.silent;

      if (!safeOrderId) {
        setDetail(null);
        return null;
      }

      const cachedDetail = detailCacheRef.current[safeOrderId] || null;
      const savedAt = Number(detailSavedAtRef.current[safeOrderId] || 0);
      const isFresh =
        !!cachedDetail &&
        !options?.force &&
        Date.now() - savedAt < ADMIN_ORDERS_DETAIL_STALE_MS;

      if (cachedDetail && selectedOrderIdRef.current === safeOrderId) {
        hydrateDetailView(cachedDetail, {
          resetForms: options?.resetForms ?? !silent,
        });
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
        const data = await fetchOrderDetail(safeOrderId);
        applyDetailSnapshot(data, {
          resetForms: options?.resetForms ?? !silent,
        });
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
          console.error("Orders detail sync error:", error);
        }
        return cachedDetail;
      } finally {
        setDetailLoading(false);
        setDetailRefreshing(false);
      }
    },
    [applyDetailSnapshot, hydrateDetailView, showToast],
  );

  const revalidateOrderInBackground = React.useCallback(
    (orderId: string) => {
      const safeOrderId = String(orderId || "").trim();
      if (!safeOrderId) return;
      if (
        !(modalOpenRef.current && selectedOrderIdRef.current === safeOrderId) &&
        !detailCacheRef.current[safeOrderId]
      ) {
        return;
      }

      void loadDetail(safeOrderId, {
        silent: true,
        force: true,
        resetForms: false,
      });
    },
    [loadDetail],
  );

  const refreshSelected = React.useCallback(
    async (
      focusOrderId?: string,
      options?: {
        silent?: boolean;
        knownVersion?: string;
        includeDetail?: boolean;
      },
    ) => {
      const preferredOrderId = String(
        focusOrderId || selectedOrderIdRef.current || "",
      ).trim();
      const nextOrderId = await loadOrders({
        focusOrderId: preferredOrderId,
        silent: options?.silent,
        knownVersion: options?.knownVersion,
      });
      const detailOrderId = String(
        nextOrderId || preferredOrderId || "",
      ).trim();
      const shouldLoadDetail = options?.includeDetail ?? modalOpenRef.current;

      if (shouldLoadDetail) {
        if (detailOrderId) {
          await loadDetail(detailOrderId, { silent: options?.silent });
        } else {
          setDetail(null);
        }
      }
    },
    [loadDetail, loadOrders],
  );

  const syncOrdersByVersion = React.useCallback(async () => {
    if (
      backgroundSyncingRef.current ||
      hasPendingActions ||
      loading ||
      detailLoading
    )
      return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    backgroundSyncingRef.current = true;
    try {
      const meta = await fetchOrdersMeta();
      const nextVersion = String(meta.dataVersion || "").trim();
      if (!nextVersion || nextVersion === latestOrdersVersionRef.current) {
        return;
      }

      await refreshSelected(selectedOrderIdRef.current, {
        silent: true,
        knownVersion: nextVersion,
        includeDetail: modalOpenRef.current,
      });
    } catch (error) {
      console.error("Orders meta sync error:", error);
    } finally {
      backgroundSyncingRef.current = false;
    }
  }, [detailLoading, hasPendingActions, loading, refreshSelected]);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      const shouldStaySilent = ordersRef.current.length > 0;
      try {
        const meta = await fetchOrdersMeta();
        if (disposed) return;
        latestOrdersVersionRef.current = String(meta.dataVersion || "").trim();
        await loadOrders({
          knownVersion: meta.dataVersion,
          silent: shouldStaySilent,
        });
      } catch (error) {
        if (disposed) return;
        await loadOrders({ silent: shouldStaySilent });
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
  }, [loadOrders]);

  useEffect(() => {
    if (!modalOpen) return;
    if (!selectedOrderId) {
      setDetail(null);
      return;
    }
    const cachedDetail = detailCacheRef.current[selectedOrderId] || null;
    if (cachedDetail) {
      hydrateDetailView(cachedDetail, { resetForms: true });
      setDetailLoading(false);
    }
    void loadDetail(selectedOrderId, {
      silent: !!cachedDetail,
      force: !cachedDetail,
      resetForms: !cachedDetail,
    });
  }, [hydrateDetailView, loadDetail, modalOpen, selectedOrderId]);

  useEffect(() => {
    if (!ordersReady) return;

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
      }, ORDERS_META_POLL_MS);
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
  }, [ordersReady, syncOrdersByVersion]);

  const filteredOrders = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.orderStatus !== statusFilter)
        return false;
      if (!keyword) return true;
      return (
        order.orderId.toLowerCase().includes(keyword) ||
        order.customerName.toLowerCase().includes(keyword) ||
        order.customerEmail.toLowerCase().includes(keyword) ||
        order.customerPhone.toLowerCase().includes(keyword) ||
        formatOrderAddressSnapshot(order.addressSnapshot)
          .toLowerCase()
          .includes(keyword) ||
        String(order.addressSnapshot.recipientName || "")
          .toLowerCase()
          .includes(keyword) ||
        String(order.addressSnapshot.recipientPhone || "")
          .toLowerCase()
          .includes(keyword) ||
        String(order.deliveryInfo.address || "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [orders, searchTerm, statusFilter]);

  const totalOrdersPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ORDERS_ITEMS_PER_PAGE),
  );

  const paginatedOrders = useMemo(() => {
    const startIndex = (ordersPage - 1) * ORDERS_ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ORDERS_ITEMS_PER_PAGE);
  }, [filteredOrders, ordersPage]);

  useEffect(() => {
    setOrdersPage((prev) => Math.min(prev, totalOrdersPages));
  }, [totalOrdersPages]);

  useEffect(() => {
    setOrdersPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setOrdersPageInput(String(ordersPage));
  }, [ordersPage]);

  const handleOrdersPageInputChange = (value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, "");
    setOrdersPageInput(digitsOnly);

    if (!digitsOnly) return;

    const nextPage = Number(digitsOnly);
    if (!Number.isFinite(nextPage)) return;

    setOrdersPage(Math.min(totalOrdersPages, Math.max(1, nextPage)));
  };

  const stats = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.total += 1;
        if (order.orderStatus === "new") acc.newCount += 1;
        if (order.orderStatus === "confirmed") acc.confirmed += 1;
        if (order.orderStatus === "delivering") acc.deliveringCount += 1;
        if (order.orderStatus === "active") acc.activeCount += 1;
        if (order.remainingAmount > 0) acc.outstanding += order.remainingAmount;
        return acc;
      },
      {
        total: 0,
        newCount: 0,
        confirmed: 0,
        deliveringCount: 0,
        activeCount: 0,
        outstanding: 0,
      },
    );
  }, [orders]);

  const selectedSummary = useMemo(
    () => orders.find((item) => item.orderId === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  const detailOrder = detail?.order || null;
  const selectedOrderForActions = detailOrder || selectedSummary;
  const selectedPendingAction = selectedOrderForActions
    ? pendingActionsByOrderId[selectedOrderForActions.orderId] || null
    : null;

  const detailAddressText = useMemo(
    () =>
      formatOrderAddressSnapshot(detailOrder?.addressSnapshot) ||
      detailOrder?.deliveryInfo?.address ||
      "",
    [detailOrder?.addressSnapshot, detailOrder?.deliveryInfo?.address],
  );

  const detailMapUrl = useMemo(
    () =>
      buildOrderAddressMapUrl(
        detailOrder?.addressSnapshot,
        detailOrder?.deliveryInfo?.address,
      ),
    [detailOrder?.addressSnapshot, detailOrder?.deliveryInfo?.address],
  );

  const detailAddressTone = useMemo(
    () => getOrderAddressTone(detailOrder?.addressSnapshot),
    [detailOrder?.addressSnapshot],
  );

  const copyOrderAddress = React.useCallback(
    async (addressText: string, key: string) => {
      const safeText = String(addressText || "").trim();
      if (!safeText) {
        showToast("Không có địa chỉ để copy", "error");
        return;
      }

      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(safeText);
        } else if (typeof document !== "undefined") {
          const textarea = document.createElement("textarea");
          textarea.value = safeText;
          textarea.setAttribute("readonly", "readonly");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        } else {
          throw new Error("Clipboard unavailable");
        }

        setCopiedAddressKey(key);
        if (
          copiedAddressTimerRef.current != null &&
          typeof window !== "undefined"
        ) {
          window.clearTimeout(copiedAddressTimerRef.current);
        }
        if (typeof window !== "undefined") {
          copiedAddressTimerRef.current = window.setTimeout(() => {
            setCopiedAddressKey("");
          }, 1600);
        }
        showToast("Đã copy địa chỉ", "success");
      } catch (error) {
        console.error("Copy address failed:", error);
        showToast("Không copy được địa chỉ", "error");
      }
    },
    [showToast],
  );

  const allowedTransitions = useMemo(() => {
    if (!detail?.order) return [];
    return (
      detail.order.allowedTransitions ||
      getAllowedOrderTransitions(
        detail.order.orderStatus,
        detail.order.paymentStatus,
        detail.order.orderType,
      )
    );
  }, [detail?.order]);

  const deliveryInfoSavedSignature = useMemo(
    () => getDeliveryFormSignature(detail?.order?.deliveryInfo),
    [detail?.order?.deliveryInfo],
  );

  const deliveryInfoDraftSignature = useMemo(
    () => getDeliveryFormSignature(deliveryForm),
    [deliveryForm],
  );

  const deliveryInfoDirty =
    deliveryInfoDraftSignature !== deliveryInfoSavedSignature;

  const applyDeliveryInfoLocally = React.useCallback(
    (orderId: string, info: OrderDeliveryInfo) => {
      const safeOrderId = String(orderId || "").trim();
      if (!safeOrderId) return;

      const snapshot = getCurrentOrderSnapshot(safeOrderId);
      const baseOrder = snapshot.order;
      if (!baseOrder) {
        setDeliveryForm(info);
        return;
      }

      const nextOrder = attachDerivedOrderState({
        ...baseOrder,
        deliveryInfo: info,
        updatedAt:
          info.updatedAt || baseOrder.updatedAt || formatOptimisticDateTime(),
      });

      applyOrderSummaryLocally(nextOrder);
      setDeliveryForm(info);
    },
    [applyOrderSummaryLocally, getCurrentOrderSnapshot],
  );

  const persistDeliveryInfoIfNeeded = React.useCallback(
    async (orderId: string) => {
      const safeOrderId = String(orderId || "").trim();
      if (!safeOrderId) {
        return {
          didSave: false,
          updatedOrder: null as OrderSummary | null,
        };
      }

      const snapshot = {
        ...getCurrentOrderSnapshot(safeOrderId),
        deliveryForm:
          selectedOrderIdRef.current === safeOrderId
            ? normalizeDeliveryForm(deliveryForm)
            : undefined,
      };
      const baseOrder = snapshot.order;
      if (!baseOrder) {
        throw new Error("Không tìm thấy dữ liệu đơn để lưu giao hàng");
      }

      const normalizedForm = normalizeDeliveryForm(deliveryForm);
      const currentSignature = getDeliveryFormSignature(baseOrder.deliveryInfo);
      const nextSignature = getDeliveryFormSignature(normalizedForm);

      if (currentSignature === nextSignature) {
        return {
          didSave: false,
          updatedOrder: baseOrder,
        };
      }

      const optimisticInfo = normalizeDeliveryForm({
        ...normalizedForm,
        updatedAt: formatOptimisticDateTime(),
      });
      applyDeliveryInfoLocally(safeOrderId, optimisticInfo);

      try {
        const response = await updateOrderDelivery({
          orderId: safeOrderId,
          deliveryInfo: normalizedForm,
        });
        const savedInfo = normalizeDeliveryForm(
          response.deliveryInfo ||
            response.updatedOrder?.deliveryInfo ||
            normalizedForm,
        );
        const resolvedOrder = attachDerivedOrderState(
          response.updatedOrder
            ? {
                ...response.updatedOrder,
                deliveryInfo: savedInfo,
              }
            : {
                ...baseOrder,
                deliveryInfo: savedInfo,
                updatedAt:
                  savedInfo.updatedAt ||
                  optimisticInfo.updatedAt ||
                  baseOrder.updatedAt,
              },
        );

        applyOrderSummaryLocally(resolvedOrder, {
          dataVersion: response.dataVersion,
        });
        setDeliveryForm(savedInfo);

        return {
          didSave: true,
          updatedOrder: resolvedOrder,
        };
      } catch (error) {
        restoreOrderSnapshot(snapshot);
        throw error;
      }
    },
    [
      applyDeliveryInfoLocally,
      applyOrderSummaryLocally,
      deliveryForm,
      getCurrentOrderSnapshot,
      restoreOrderSnapshot,
    ],
  );

  const handleOpenDetail = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setModalOpen(true);
  };

  const handleAddPayment = async () => {
    if (!detail?.order) return;
    const orderId = String(detail.order.orderId || "").trim();
    const amount = Number(paymentAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Nhập số tiền hợp lệ", "error");
      return;
    }

    const snapshot = {
      ...getCurrentOrderSnapshot(orderId),
      deliveryForm: normalizeDeliveryForm(deliveryForm),
    };
    const baseOrder = snapshot.order;
    if (!baseOrder) {
      showToast("Không tìm thấy dữ liệu đơn để ghi nhận thanh toán", "error");
      return;
    }

    const optimisticTime = formatOptimisticDateTime();
    const optimisticPaidAmount = baseOrder.paidAmount + amount;
    const optimisticDepositAmount =
      paymentKind === "deposit"
        ? Math.min(baseOrder.totalAmount, baseOrder.depositAmount + amount)
        : baseOrder.depositAmount;
    const optimisticRemainingAmount = Math.max(
      0,
      baseOrder.totalAmount - optimisticPaidAmount,
    );
    const optimisticPaymentStatus = derivePaymentStatus({
      totalAmount: baseOrder.totalAmount,
      paidAmount: optimisticPaidAmount,
      depositAmount: optimisticDepositAmount,
    });
    const optimisticOrder = attachDerivedOrderState({
      ...baseOrder,
      depositAmount: optimisticDepositAmount,
      paidAmount: optimisticPaidAmount,
      remainingAmount: optimisticRemainingAmount,
      paymentStatus: optimisticPaymentStatus,
      updatedAt: optimisticTime,
    });
    const optimisticPayment = {
      paymentId: `temp-${orderId}-${Date.now()}`,
      orderId,
      createdAt: optimisticTime,
      amount,
      method: String(paymentMethod || "cash")
        .trim()
        .toLowerCase(),
      note: String(paymentNote || "").trim(),
      createdBy: String(authUser?.email || "admin").trim(),
    };

    setPendingAction(orderId, {
      actionKey: "payment:add",
      label: "Đang lưu thanh toán...",
      kind: "payment",
      startedAt: Date.now(),
    });

    try {
      if (snapshot.detail) {
        applyDetailSnapshot(
          {
            ...snapshot.detail,
            order: optimisticOrder,
            payments: [...snapshot.detail.payments, optimisticPayment],
          },
          { resetForms: false },
        );
      } else {
        applyOrderSummaryLocally(optimisticOrder);
      }

      const response = await addPayment({
        orderId,
        amount,
        method: paymentMethod,
        note: paymentNote,
        paymentKind,
      });

      const resolvedOrder = attachDerivedOrderState(
        response.updatedOrder
          ? response.updatedOrder
          : {
              ...optimisticOrder,
              paidAmount: response.paidAmount ?? optimisticPaidAmount,
              remainingAmount:
                response.remainingAmount ?? optimisticRemainingAmount,
              paymentStatus: response.paymentStatus || optimisticPaymentStatus,
            },
      );
      const currentDetail = detailCacheRef.current[orderId] || snapshot.detail;
      if (currentDetail) {
        const confirmedPayment = response.createdPayment || optimisticPayment;
        const mergedPayments = [
          ...currentDetail.payments.filter(
            (item) => item.paymentId !== optimisticPayment.paymentId,
          ),
          confirmedPayment,
        ];

        applyDetailSnapshot(
          {
            ...currentDetail,
            order: resolvedOrder,
            payments: mergedPayments,
          },
          {
            dataVersion: response.dataVersion,
            resetForms: false,
          },
        );
      } else {
        applyOrderSummaryLocally(resolvedOrder, {
          dataVersion: response.dataVersion,
        });
      }

      setPaymentAmount("");
      setPaymentNote("");
      setPaymentKind(resolvedOrder.paidAmount > 0 ? "partial" : "deposit");
      showToast("Đã ghi nhận thanh toán", "success");
      revalidateOrderInBackground(orderId);
    } catch (error) {
      restoreOrderSnapshot(snapshot);
      showToast(
        String(
          (error as any)?.message || error || "Không thêm được thanh toán",
        ),
        "error",
      );
    } finally {
      clearPendingAction(orderId);
    }
  };

  const handleSaveDeliveryInfo = async () => {
    if (!detail?.order) return;
    const orderId = String(detail.order.orderId || "").trim();

    setPendingAction(orderId, {
      actionKey: "delivery:save",
      label: "Đang lưu thông tin giao hàng...",
      kind: "delivery",
      startedAt: Date.now(),
    });

    try {
      const result = await persistDeliveryInfoIfNeeded(orderId);
      if (!result.didSave) {
        showToast("Thông tin giao hàng không thay đổi", "success");
        return;
      }
      showToast("Đã lưu thông tin giao hàng", "success");
      revalidateOrderInBackground(orderId);
    } catch (error) {
      showToast(
        String(
          (error as any)?.message ||
            error ||
            "Không lưu được thông tin giao hàng",
        ),
        "error",
      );
    } finally {
      clearPendingAction(orderId);
    }
  };

  const performChangeStatus = React.useCallback(
    async (
      orderId: string,
      status: OrderStatus,
      options?: {
        reason?: string;
        pendingLabel?: string;
        preservePending?: boolean;
      },
    ) => {
      const safeOrderId = String(orderId || "").trim();
      if (!safeOrderId) {
        throw new Error("Thiếu mã đơn hàng");
      }

      const snapshot = {
        ...getCurrentOrderSnapshot(safeOrderId),
        deliveryForm:
          selectedOrderIdRef.current === safeOrderId
            ? normalizeDeliveryForm(deliveryForm)
            : undefined,
      };
      const baseOrder = snapshot.order;
      if (!baseOrder) {
        throw new Error("Không tìm thấy dữ liệu đơn để cập nhật trạng thái");
      }

      const shouldOwnPending = !options?.preservePending;
      if (shouldOwnPending) {
        setPendingAction(safeOrderId, {
          actionKey: `status:${status}`,
          label:
            options?.pendingLabel || getStatusPendingLabel(baseOrder, status),
          kind: "status",
          startedAt: Date.now(),
        });
      }

      const optimisticOrder = attachDerivedOrderState({
        ...baseOrder,
        orderStatus: status,
        updatedAt: formatOptimisticDateTime(),
      });
      applyOrderSummaryLocally(optimisticOrder);

      try {
        const response = await updateOrderStatus({
          orderId: safeOrderId,
          status,
          reason: String(options?.reason || "").trim(),
        });
        const resolvedOrder = attachDerivedOrderState(
          response.updatedOrder
            ? response.updatedOrder
            : {
                ...optimisticOrder,
                orderStatus: response.orderStatus || status,
                paymentStatus:
                  response.paymentStatus || optimisticOrder.paymentStatus,
              },
        );

        applyOrderSummaryLocally(resolvedOrder, {
          dataVersion: response.dataVersion,
        });
        revalidateOrderInBackground(safeOrderId);
        return resolvedOrder;
      } catch (error) {
        restoreOrderSnapshot(snapshot);
        throw error;
      } finally {
        if (shouldOwnPending) {
          clearPendingAction(safeOrderId);
        }
      }
    },
    [
      applyOrderSummaryLocally,
      clearPendingAction,
      deliveryForm,
      getCurrentOrderSnapshot,
      restoreOrderSnapshot,
      revalidateOrderInBackground,
      setPendingAction,
    ],
  );

  const handleChangeStatus = async (status: OrderStatus) => {
    if (!detail?.order) return;
    const orderId = String(detail.order.orderId || "").trim();
    const pendingLabel = getStatusPendingLabel(detail.order, status);

    const safeDelivery = normalizeDeliveryForm(deliveryForm);
    if (
      detail.order.orderType === "buy" &&
      status === "delivering" &&
      !safeDelivery.address
    ) {
      showToast(
        "Đơn bán cần có địa chỉ giao hàng trước khi chuyển sang delivering",
        "error",
      );
      return;
    }

    setPendingAction(orderId, {
      actionKey: `status:${status}`,
      label: pendingLabel,
      kind: "status",
      startedAt: Date.now(),
    });

    try {
      if (status === "delivering" || status === "active") {
        await persistDeliveryInfoIfNeeded(orderId);
      }
      await performChangeStatus(orderId, status, {
        reason: status === "cancelled" ? cancelReason : "",
        pendingLabel,
        preservePending: true,
      });
      showToast("Đã cập nhật trạng thái đơn", "success");
    } catch (error) {
      showToast(
        String(
          (error as any)?.message || error || "Không cập nhật được trạng thái",
        ),
        "error",
      );
    } finally {
      clearPendingAction(orderId);
    }
  };

  const handleQuickTransition = async (
    order: OrderSummary,
    nextStatus: OrderStatus,
  ) => {
    if (
      nextStatus === "delivering" &&
      order.orderType === "buy" &&
      !normalizeDeliveryForm(order.deliveryInfo).address
    ) {
      showToast(
        "Đơn bán cần có địa chỉ giao hàng trước khi chuyển sang delivering",
        "error",
      );
      await handleOpenDetail(order.orderId);
      return;
    }

    try {
      await performChangeStatus(order.orderId, nextStatus, {
        pendingLabel: getStatusPendingLabel(order, nextStatus),
      });
      showToast("Đã cập nhật trạng thái đơn", "success");
    } catch (error) {
      showToast(
        String(
          (error as any)?.message || error || "Không cập nhật được trạng thái",
        ),
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <StatCard
          title="Tổng đơn"
          value={String(stats.total)}
          note="Orders sheet"
        />
        <StatCard
          title="Đơn mới"
          value={String(stats.newCount)}
          note="Chờ xác nhận"
        />
        <StatCard
          title="Đơn confirmed"
          value={String(stats.confirmed)}
          note="Đang giữ cây"
        />
        <StatCard
          title="Đơn delivering"
          value={String(stats.deliveringCount)}
          note="Đang giao hàng"
        />
        <StatCard
          title="Đơn active"
          value={String(stats.activeCount)}
          note="Đang cho thuê"
        />
        <StatCard
          title="Công nợ còn lại"
          value={formatCurrencyVnd(stats.outstanding)}
          note="Tổng remainingAmount"
          valueClassName="text-[clamp(1.5rem,1.8vw,2rem)]"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Danh sách đơn hàng
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý vòng đời đơn hàng, thanh toán và trạng thái khóa cây.
            </p>
            <p
              className={`mt-1 text-xs ${listRefreshing ? "text-amber-600" : "text-emerald-600"}`}
            >
              {listRefreshing
                ? "Đang đồng bộ danh sách đơn ở nền..."
                : "chờ ~2.5 giây."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã đơn / tên / email / điện thoại / địa chỉ"
              className="h-11 rounded-xl border border-slate-300 px-4 outline-none focus:ring-2 focus:ring-amber-400"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  (e.target.value || "all") as OrderStatus | "all",
                )
              }
              className="h-11 rounded-xl border border-slate-300 px-4 outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="new">new</option>
              <option value="confirmed">confirmed</option>
              <option value="delivering">delivering</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
            <button
              type="button"
              onClick={() => void refreshSelected()}
              disabled={loading || listRefreshing}
              className="h-11 whitespace-nowrap rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading || listRefreshing ? "Đang làm mới..." : "Làm mới"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left">
                <Th>STT</Th>
                <Th>Mã đơn</Th>
                <Th>Khách hàng</Th>
                <Th>Loại đơn</Th>
                <Th>Trạng thái đơn</Th>
                <Th>Trạng thái tiền</Th>
                <Th>Tổng / Còn lại</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <Td colSpan={8}>Đang tải dữ liệu...</Td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <Td colSpan={8}>Không có đơn hàng phù hợp.</Td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  const rowTransitions =
                    order.allowedTransitions ||
                    getAllowedOrderTransitions(
                      order.orderStatus,
                      order.paymentStatus,
                      order.orderType,
                    );
                  const rowPendingAction =
                    pendingActionsByOrderId[order.orderId] || null;
                  const rowIsPending = !!rowPendingAction;
                  return (
                    <tr key={order.orderId}>
                      <Td>
                        {(ordersPage - 1) * ORDERS_ITEMS_PER_PAGE + index + 1}
                      </Td>
                      <Td>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {order.orderId}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDateTimeVN(order.createdAt)}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {(() => {
                          const rowAddressText = getCopyableOrderAddressText(
                            order.addressSnapshot,
                            order.deliveryInfo.address,
                          );
                          const rowMapUrl = buildOrderAddressMapUrl(
                            order.addressSnapshot,
                            order.deliveryInfo.address,
                          );
                          const rowTone = getOrderAddressTone(
                            order.addressSnapshot,
                          );
                          const rowCopyKey = `row:${order.orderId}`;

                          return (
                            <div>
                              <div className="font-medium text-slate-900">
                                {order.customerName}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {order.customerEmail}
                              </div>
                              {rowAddressText && (
                                <div
                                  className={`mt-3 rounded-xl border p-3 ${rowTone.containerClass}`}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${rowTone.badgeClass}`}
                                    >
                                      <span>{rowTone.icon}</span>
                                      <span>{rowTone.accuracyLabel}</span>
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                      {rowTone.mapLabel}
                                    </span>
                                  </div>
                                  {rowMapUrl ? (
                                    <a
                                      href={rowMapUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`mt-2 block whitespace-pre-line text-xs leading-relaxed ${rowTone.linkClass}`}
                                    >
                                      {rowAddressText}
                                    </a>
                                  ) : (
                                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                                      {rowAddressText}
                                    </p>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {rowMapUrl && (
                                      <a
                                        href={rowMapUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${rowTone.actionClass}`}
                                      >
                                        Mở map ↗
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void copyOrderAddress(
                                          rowAddressText,
                                          rowCopyKey,
                                        )
                                      }
                                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${rowTone.actionClass}`}
                                    >
                                      {copiedAddressKey === rowCopyKey
                                        ? "Đã copy"
                                        : "Copy địa chỉ"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </Td>
                      <Td>{formatTransactionTypeLabel(order.orderType)}</Td>
                      <Td>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClassName(order.orderStatus)}`}
                        >
                          {formatOrderStatusLabel(order.orderStatus)}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusClassName(order.paymentStatus)}`}
                        >
                          {formatPaymentStatusLabel(order.paymentStatus)}
                        </span>
                      </Td>
                      <Td>
                        <div className="font-semibold text-slate-900">
                          {formatCurrencyVnd(order.totalAmount)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Còn: {formatCurrencyVnd(order.remainingAmount)}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {rowPendingAction && (
                            <span className="mr-1 text-xs font-semibold text-amber-600">
                              {rowPendingAction.label}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleOpenDetail(order.orderId)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Xem
                          </button>
                          {rowTransitions.includes("confirmed") && (
                            <button
                              type="button"
                              disabled={rowIsPending}
                              onClick={() =>
                                void handleQuickTransition(order, "confirmed")
                              }
                              className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {rowPendingAction?.actionKey ===
                              "status:confirmed"
                                ? rowPendingAction.label
                                : getStatusActionLabel(order, "confirmed")}
                            </button>
                          )}
                          {rowTransitions.includes("delivering") && (
                            <button
                              type="button"
                              disabled={rowIsPending}
                              onClick={() =>
                                void handleQuickTransition(order, "delivering")
                              }
                              className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {rowPendingAction?.actionKey ===
                              "status:delivering"
                                ? rowPendingAction.label
                                : getStatusActionLabel(order, "delivering")}
                            </button>
                          )}
                          {rowTransitions.includes("active") && (
                            <button
                              type="button"
                              disabled={rowIsPending}
                              onClick={() =>
                                void handleQuickTransition(order, "active")
                              }
                              className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {rowPendingAction?.actionKey === "status:active"
                                ? rowPendingAction.label
                                : getStatusActionLabel(order, "active")}
                            </button>
                          )}
                          {rowTransitions.includes("completed") && (
                            <button
                              type="button"
                              disabled={rowIsPending}
                              onClick={() =>
                                void handleQuickTransition(order, "completed")
                              }
                              className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {rowPendingAction?.actionKey ===
                              "status:completed"
                                ? rowPendingAction.label
                                : getStatusActionLabel(order, "completed")}
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
            disabled={ordersPage === 1}
            className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
          >
            ←
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2">
            Trang
            <input
              type="number"
              value={ordersPageInput}
              onChange={(e) => handleOrdersPageInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  let page = Number(ordersPageInput);
                  if (!page || page < 1) page = 1;
                  if (page > totalOrdersPages) page = totalOrdersPages;
                  setOrdersPage(page);
                }
              }}
              className="w-16 rounded border px-2 py-1 text-center outline-none"
            />
            / {totalOrdersPages}
          </div>
          <button
            type="button"
            onClick={() =>
              setOrdersPage((p) => Math.min(totalOrdersPages, p + 1))
            }
            disabled={ordersPage === totalOrdersPages}
            className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </section>

      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[92vh] overflow-y-auto pr-2">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 rounded-t-3xl">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Chi tiết đơn
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">
                      {detail?.order.orderId ||
                        selectedSummary?.orderId ||
                        "Đơn hàng"}
                    </h2>
                    <p
                      className={`mt-1 text-xs ${detailRefreshing ? "text-amber-600" : "text-slate-500"}`}
                    >
                      {detailRefreshing
                        ? "Đang đồng bộ chi tiết mới nhất ở nền..."
                        : "Mở lại đơn đã xem sẽ ưu tiên data cache trước, rồi refresh nền nếu cần."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Đóng
                  </button>
                </div>

                {detailLoading || !detail ? (
                  <div className="p-8 text-center text-slate-500">
                    Đang tải chi tiết đơn hàng...
                  </div>
                ) : (
                  <div className="space-y-6 p-6">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                      <section className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm text-slate-500">
                              Trạng thái đơn
                            </p>
                            <div
                              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClassName(detail.order.orderStatus)}`}
                            >
                              {formatOrderStatusLabel(detail.order.orderStatus)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm text-slate-500">
                              Trạng thái tiền
                            </p>
                            <div
                              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusClassName(detail.order.paymentStatus)}`}
                            >
                              {formatPaymentStatusLabel(
                                detail.order.paymentStatus,
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm text-slate-500">Tổng đơn</p>
                            <p className="mt-2 text-xl font-bold text-slate-900">
                              {formatCurrencyVnd(detail.order.totalAmount)}
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
                            Thông tin khách hàng
                          </h3>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-sm text-slate-500">
                                Khách hàng
                              </p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {detail.order.customerName}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-500">
                                Điện thoại
                              </p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {detail.order.customerPhone || "--"}
                              </p>
                            </div>
                            <div className="sm:col-span-2">
                              <p className="text-sm text-slate-500">Email</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {detail.order.customerEmail}
                              </p>
                            </div>
                            {detail.order.note && (
                              <div className="sm:col-span-2">
                                <p className="text-sm text-slate-500">
                                  Ghi chú đơn hàng
                                </p>
                                <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">
                                  {detail.order.note}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">
                                Thông tin giao hàng / bàn giao
                              </h3>
                              <p className="mt-1 text-sm text-slate-500">
                                Lưu trong metadata của đơn để không phải đổi
                                schema sheet.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {detailMapUrl && (
                                <a
                                  href={detailMapUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                                >
                                  Mở Google Maps ↗
                                </a>
                              )}
                              <button
                                type="button"
                                disabled={acting || !deliveryInfoDirty}
                                onClick={() => void handleSaveDeliveryInfo()}
                                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {selectedPendingAction?.actionKey ===
                                "delivery:save"
                                  ? selectedPendingAction.label
                                  : "Lưu thông tin giao hàng"}
                              </button>
                            </div>
                          </div>

                          {(hasOrderAddressSnapshot(
                            detail.order.addressSnapshot,
                          ) ||
                            detailAddressText) && (
                            <div
                              className={`mt-4 rounded-2xl border p-4 ${detailAddressTone.containerClass}`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  Địa chỉ snapshot lúc khách đặt đơn
                                </p>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${detailAddressTone.badgeClass}`}
                                >
                                  <span>{detailAddressTone.icon}</span>
                                  <span>{detailAddressTone.accuracyLabel}</span>
                                </span>
                                <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  {detailAddressTone.mapLabel}
                                </span>
                                {hasOrderAddressSnapshot(
                                  detail.order.addressSnapshot,
                                ) && (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    {getOrderAddressSnapshotSourceLabel(
                                      detail.order.addressSnapshot,
                                    )}
                                  </span>
                                )}
                                {detail.order.addressSnapshot.label && (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    {detail.order.addressSnapshot.label}
                                  </span>
                                )}
                                {detail.order.addressSnapshot.isDefault && (
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    Từng là mặc định
                                  </span>
                                )}
                              </div>
                              <p
                                className={`mt-2 ${detailAddressTone.hintClass}`}
                              >
                                {detailAddressTone.hintText}
                              </p>
                              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                <div>
                                  <p className="text-sm text-slate-500">
                                    Người nhận
                                  </p>
                                  <p className="mt-1 font-semibold text-slate-900">
                                    {detail.order.addressSnapshot
                                      .recipientName ||
                                      detail.order.customerName ||
                                      "--"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-slate-500">
                                    Điện thoại nhận
                                  </p>
                                  <p className="mt-1 font-semibold text-slate-900">
                                    {detail.order.addressSnapshot
                                      .recipientPhone ||
                                      detail.order.customerPhone ||
                                      "--"}
                                  </p>
                                </div>
                                <div className="sm:col-span-2">
                                  <p className="text-sm text-slate-500">
                                    Địa chỉ đã chốt lúc checkout
                                  </p>
                                  {detailMapUrl ? (
                                    <div className="mt-1 space-y-2">
                                      <a
                                        href={detailMapUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`inline whitespace-pre-line leading-relaxed ${detailAddressTone.linkClass}`}
                                      >
                                        {detailAddressText || "--"}
                                      </a>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <a
                                          href={detailMapUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${detailAddressTone.actionClass}`}
                                        >
                                          Mở Google Maps ↗
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void copyOrderAddress(
                                              detailAddressText,
                                              `detail:${detail.order.orderId}`,
                                            )
                                          }
                                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${detailAddressTone.actionClass}`}
                                        >
                                          {copiedAddressKey ===
                                          `detail:${detail.order.orderId}`
                                            ? "Đã copy"
                                            : "Copy địa chỉ"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-1 space-y-2">
                                      <p className="whitespace-pre-line leading-relaxed text-slate-700">
                                        {detailAddressText || "--"}
                                      </p>
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void copyOrderAddress(
                                              detailAddressText,
                                              `detail:${detail.order.orderId}`,
                                            )
                                          }
                                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${detailAddressTone.actionClass}`}
                                        >
                                          {copiedAddressKey ===
                                          `detail:${detail.order.orderId}`
                                            ? "Đã copy"
                                            : "Copy địa chỉ"}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {detail.order.addressSnapshot.note && (
                                  <div className="sm:col-span-2">
                                    <p className="text-sm text-slate-500">
                                      Ghi chú snapshot
                                    </p>
                                    <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">
                                      {detail.order.addressSnapshot.note}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className="block sm:col-span-2">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Địa chỉ giao / bàn giao cây
                              </span>
                              <textarea
                                value={deliveryForm.address}
                                onChange={(e) =>
                                  setDeliveryForm((prev) => ({
                                    ...prev,
                                    address: e.target.value,
                                  }))
                                }
                                className="min-h-[96px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                placeholder="Nhập địa chỉ giao hàng hoặc điểm bàn giao cây"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Thời gian giao dự kiến
                              </span>
                              <input
                                type="datetime-local"
                                value={toDateTimeLocalValue(
                                  deliveryForm.scheduledAt,
                                )}
                                onChange={(e) =>
                                  setDeliveryForm((prev) => ({
                                    ...prev,
                                    scheduledAt: e.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-2xl border border-slate-300 px-4 outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Cập nhật lần cuối
                              </span>
                              <div className="flex h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600">
                                {detail.order.deliveryInfo.updatedAt
                                  ? formatDateTimeVN(
                                      detail.order.deliveryInfo.updatedAt,
                                    )
                                  : "Chưa có cập nhật"}
                              </div>
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Ghi chú giao hàng
                              </span>
                              <textarea
                                value={deliveryForm.note}
                                onChange={(e) =>
                                  setDeliveryForm((prev) => ({
                                    ...prev,
                                    note: e.target.value,
                                  }))
                                }
                                className="min-h-[96px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                placeholder="Ví dụ: giao trước 17h, gọi trước 30 phút, có xe nâng..."
                              />
                            </label>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5">
                          <h3 className="text-lg font-bold text-slate-900">
                            Nhật ký lifecycle
                          </h3>
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            {!detail.order.auditTrail ||
                            detail.order.auditTrail.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                Chưa có dòng audit nào trong note metadata.
                              </p>
                            ) : (
                              <ul className="space-y-2 text-sm text-slate-700">
                                {detail.order.auditTrail.map((line, index) => (
                                  <li
                                    key={`${line}-${index}`}
                                    className="rounded-xl bg-white px-3 py-2 shadow-sm"
                                  >
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5">
                          <h3 className="text-lg font-bold text-slate-900">
                            Cây trong đơn
                          </h3>
                          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                            <table className="min-w-full border-separate border-spacing-0">
                              <thead>
                                <tr className="bg-slate-50 text-left text-sm text-slate-600">
                                  <th className="px-4 py-3 font-semibold">
                                    Mã cây
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Loại giao dịch
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Giá
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Ghi chú snapshot
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.items.map((item) => (
                                  <tr key={item.orderItemId}>
                                    <td className="border-t border-slate-100 px-4 py-3 font-semibold text-slate-900">
                                      {item.productCode}
                                    </td>
                                    <td className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                                      {formatTransactionTypeLabel(
                                        item.transactionType,
                                      )}
                                    </td>
                                    <td className="border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
                                      {formatCurrencyVnd(item.lineTotal)}
                                    </td>
                                    <td className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                                      {item.snapshotNote || "--"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-5">
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
                                  <th className="px-4 py-3 font-semibold">
                                    Số tiền
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Phương thức
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Ghi chú
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.payments.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="px-4 py-5 text-center text-sm text-slate-500"
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
                                      <td className="border-t border-slate-100 px-4 py-3 text-sm uppercase text-slate-600">
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
                      </section>

                      <aside className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">
                            Thao tác nhanh
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-slate-500">
                            {getLifecycleHelpText(selectedOrderForActions)}
                          </p>
                          {selectedPendingAction && (
                            <p className="mt-2 text-sm font-semibold text-amber-600">
                              {selectedPendingAction.label}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                              Lý do hủy đơn
                            </span>
                            <textarea
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              className="min-h-[90px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                              placeholder="Chỉ cần nhập khi hủy đơn"
                            />
                          </label>

                          <div className="grid gap-3 sm:grid-cols-4">
                            <button
                              type="button"
                              disabled={
                                acting ||
                                !allowedTransitions.includes("confirmed")
                              }
                              onClick={() =>
                                void handleChangeStatus("confirmed")
                              }
                              className="rounded-2xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {selectedPendingAction?.actionKey ===
                              "status:confirmed"
                                ? selectedPendingAction.label
                                : getStatusActionLabel(
                                    selectedOrderForActions,
                                    "confirmed",
                                  )}
                            </button>
                            <button
                              type="button"
                              disabled={
                                acting ||
                                !allowedTransitions.includes("delivering")
                              }
                              onClick={() =>
                                void handleChangeStatus("delivering")
                              }
                              className="rounded-2xl border border-orange-300 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {selectedPendingAction?.actionKey ===
                              "status:delivering"
                                ? selectedPendingAction.label
                                : getStatusActionLabel(
                                    selectedOrderForActions,
                                    "delivering",
                                  )}
                            </button>
                            <button
                              type="button"
                              disabled={
                                acting || !allowedTransitions.includes("active")
                              }
                              onClick={() => void handleChangeStatus("active")}
                              className="rounded-2xl border border-violet-300 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {selectedPendingAction?.actionKey ===
                              "status:active"
                                ? selectedPendingAction.label
                                : getStatusActionLabel(
                                    selectedOrderForActions,
                                    "active",
                                  )}
                            </button>
                            <button
                              type="button"
                              disabled={
                                acting ||
                                !allowedTransitions.includes("completed")
                              }
                              onClick={() =>
                                void handleChangeStatus("completed")
                              }
                              className="rounded-2xl border border-green-300 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {selectedPendingAction?.actionKey ===
                              "status:completed"
                                ? selectedPendingAction.label
                                : getStatusActionLabel(
                                    selectedOrderForActions,
                                    "completed",
                                  )}
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={
                              acting ||
                              !allowedTransitions.includes("cancelled")
                            }
                            onClick={() => void handleChangeStatus("cancelled")}
                            className="w-full rounded-2xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {selectedPendingAction?.actionKey ===
                            "status:cancelled"
                              ? selectedPendingAction.label
                              : "Hủy đơn"}
                          </button>
                        </div>

                        <div className="border-t border-slate-200 pt-5">
                          <h4 className="text-base font-bold text-slate-900">
                            Ghi nhận thanh toán
                          </h4>
                          <div className="mt-4 space-y-3">
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Số tiền
                              </span>
                              <input
                                value={paymentAmount}
                                onChange={(e) =>
                                  setPaymentAmount(
                                    e.target.value.replace(/[^\d]/g, ""),
                                  )
                                }
                                className="h-11 w-full rounded-2xl border border-slate-300 px-4 outline-none focus:ring-2 focus:ring-amber-400"
                                placeholder="5000000"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Loại ghi nhận
                              </span>
                              <select
                                value={paymentKind}
                                onChange={(e) =>
                                  setPaymentKind(
                                    (e.target.value || "deposit") as
                                      | "deposit"
                                      | "partial"
                                      | "final",
                                  )
                                }
                                className="h-11 w-full rounded-2xl border border-slate-300 px-4 outline-none focus:ring-2 focus:ring-amber-400"
                              >
                                <option value="deposit">Tiền cọc</option>
                                <option value="partial">Thanh toán thêm</option>
                                <option value="final">
                                  Thanh toán chốt đơn
                                </option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Phương thức
                              </span>
                              <select
                                value={paymentMethod}
                                onChange={(e) =>
                                  setPaymentMethod(e.target.value)
                                }
                                className="h-11 w-full rounded-2xl border border-slate-300 px-4 outline-none focus:ring-2 focus:ring-amber-400"
                              >
                                <option value="cash">cash</option>
                                <option value="bank">bank</option>
                                <option value="transfer">transfer</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Ghi chú
                              </span>
                              <textarea
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                                className="min-h-[90px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                placeholder="Ví dụ: cọc lần 1, chuyển khoản đủ tiền..."
                              />
                            </label>
                            <button
                              type="button"
                              disabled={
                                acting || detail.order.paymentStatus === "paid"
                              }
                              onClick={() => void handleAddPayment()}
                              className="w-full rounded-2xl bg-amber-400 px-5 py-3 font-bold text-amber-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {selectedPendingAction?.actionKey ===
                              "payment:add"
                                ? selectedPendingAction.label
                                : "Thêm thanh toán"}
                            </button>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default OrdersTab;
