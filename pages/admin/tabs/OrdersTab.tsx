import React, { useEffect, useMemo, useState } from "react";
import {
  formatOrderAddressSnapshot,
  getOrderAddressSnapshotSourceLabel,
  hasOrderAddressSnapshot,
} from "../../../types";
import type {
  AuthUser,
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
import { getPaymentStatusClassName } from "../../../utils/paymentStatus";
import {
  formatCurrencyVnd,
  formatDateTimeVN,
  formatOrderStatusLabel,
  formatPaymentStatusLabel,
  formatTransactionTypeLabel,
} from "../../../utils/shopFormat";
import { useToast } from "../../../components/Toast";
import { StatCard, Th, Td } from "../shared";

interface OrdersTabProps {
  authUser?: AuthUser | null;
}

const ORDERS_META_POLL_MS = 2_500;

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

const OrdersTab: React.FC<OrdersTabProps> = ({ authUser }) => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
  const [deliveryForm, setDeliveryForm] =
    useState<OrderDeliveryInfo>(EMPTY_DELIVERY_INFO);
  const [acting, setActing] = useState(false);
  const [ordersReady, setOrdersReady] = useState(false);

  const latestOrdersVersionRef = React.useRef("");
  const selectedOrderIdRef = React.useRef("");
  const modalOpenRef = React.useRef(false);
  const backgroundSyncingRef = React.useRef(false);

  useEffect(() => {
    selectedOrderIdRef.current = selectedOrderId;
  }, [selectedOrderId]);

  useEffect(() => {
    modalOpenRef.current = modalOpen;
  }, [modalOpen]);

  const loadOrders = React.useCallback(
    async (options?: {
      focusOrderId?: string;
      silent?: boolean;
      knownVersion?: string;
    }) => {
      const focusOrderId = String(options?.focusOrderId || "").trim();
      const silent = !!options?.silent;

      try {
        if (!silent) {
          setLoading(true);
        }

        const data = await fetchOrders();
        const sorted = [...data].sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
        );
        setOrders(sorted);

        if (options?.knownVersion) {
          latestOrdersVersionRef.current = String(
            options.knownVersion || "",
          ).trim();
        }

        const nextOrderId =
          sorted.find((item) => item.orderId === focusOrderId)?.orderId ||
          focusOrderId ||
          sorted[0]?.orderId ||
          "";

        if (nextOrderId) {
          if (nextOrderId !== selectedOrderIdRef.current) {
            setSelectedOrderId(nextOrderId);
          }
        } else {
          setSelectedOrderId("");
          setDetail(null);
        }

        return nextOrderId;
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
        }
      }
    },
    [showToast],
  );

  const loadDetail = React.useCallback(
    async (orderId: string, options?: { silent?: boolean }) => {
      const safeOrderId = String(orderId || "").trim();
      const silent = !!options?.silent;

      if (!safeOrderId) {
        setDetail(null);
        return null;
      }

      try {
        if (!silent) {
          setDetailLoading(true);
        }
        const data = await fetchOrderDetail(safeOrderId);
        setDetail(data);

        if (!silent) {
          setPaymentAmount("");
          setPaymentMethod("cash");
          setPaymentKind(data.order.paidAmount > 0 ? "partial" : "deposit");
          setPaymentNote("");
          setCancelReason("");
          setDeliveryForm(normalizeDeliveryForm(data.order.deliveryInfo));
        }

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
        return null;
      } finally {
        if (!silent) {
          setDetailLoading(false);
        }
      }
    },
    [showToast],
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
    if (backgroundSyncingRef.current || acting || loading || detailLoading)
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
  }, [acting, detailLoading, loading, refreshSelected]);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      try {
        const meta = await fetchOrdersMeta();
        if (disposed) return;
        await loadOrders({ knownVersion: meta.dataVersion });
      } catch (error) {
        if (disposed) return;
        await loadOrders();
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
    void loadDetail(selectedOrderId);
  }, [loadDetail, modalOpen, selectedOrderId]);

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
        formatOrderAddressSnapshot(order.addressSnapshot).toLowerCase().includes(keyword) ||
        String(order.addressSnapshot.recipientName || "").toLowerCase().includes(keyword) ||
        String(order.addressSnapshot.recipientPhone || "").toLowerCase().includes(keyword) ||
        String(order.deliveryInfo.address || "").toLowerCase().includes(keyword)
      );
    });
  }, [orders, searchTerm, statusFilter]);

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
      setOrders((prev) =>
        prev.map((item) =>
          item.orderId === orderId ? { ...item, deliveryInfo: info } : item,
        ),
      );
      setDetail((prev) =>
        prev && prev.order.orderId === orderId
          ? {
              ...prev,
              order: {
                ...prev.order,
                deliveryInfo: info,
              },
            }
          : prev,
      );
      setDeliveryForm(info);
    },
    [],
  );

  const persistDeliveryInfoIfNeeded = React.useCallback(
    async (orderId: string) => {
      if (!orderId) return false;

      const normalizedForm = normalizeDeliveryForm(deliveryForm);
      const currentSignature = getDeliveryFormSignature(
        detail?.order?.deliveryInfo,
      );
      const nextSignature = getDeliveryFormSignature(normalizedForm);

      if (currentSignature === nextSignature) {
        return false;
      }

      const response = await updateOrderDelivery({
        orderId,
        deliveryInfo: normalizedForm,
      });
      const savedInfo = normalizeDeliveryForm(
        response.deliveryInfo || normalizedForm,
      );
      applyDeliveryInfoLocally(orderId, savedInfo);
      return true;
    },
    [applyDeliveryInfoLocally, deliveryForm, detail?.order?.deliveryInfo],
  );

  const handleOpenDetail = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setModalOpen(true);
  };

  const handleAddPayment = async () => {
    if (!detail?.order) return;
    const amount = Number(paymentAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Nhập số tiền hợp lệ", "error");
      return;
    }

    try {
      setActing(true);
      await addPayment({
        orderId: detail.order.orderId,
        amount,
        method: paymentMethod,
        note: paymentNote,
        paymentKind,
      });
      showToast("Đã ghi nhận thanh toán", "success");
      await refreshSelected(detail.order.orderId);
    } catch (error) {
      showToast(
        String(
          (error as any)?.message || error || "Không thêm được thanh toán",
        ),
        "error",
      );
    } finally {
      setActing(false);
    }
  };

  const handleSaveDeliveryInfo = async () => {
    if (!detail?.order) return;

    try {
      setActing(true);
      const didSave = await persistDeliveryInfoIfNeeded(detail.order.orderId);
      if (!didSave) {
        showToast("Thông tin giao hàng không thay đổi", "success");
        return;
      }
      showToast("Đã lưu thông tin giao hàng", "success");
      await refreshSelected(detail.order.orderId);
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
      setActing(false);
    }
  };

  const performChangeStatus = async (
    orderId: string,
    status: OrderStatus,
    reason?: string,
  ) => {
    try {
      setActing(true);
      await updateOrderStatus({
        orderId,
        status,
        reason: String(reason || "").trim(),
      });
      showToast("Đã cập nhật trạng thái đơn", "success");
      await refreshSelected(orderId);
    } catch (error) {
      showToast(
        String(
          (error as any)?.message || error || "Không cập nhật được trạng thái",
        ),
        "error",
      );
    } finally {
      setActing(false);
    }
  };

  const handleChangeStatus = async (status: OrderStatus) => {
    if (!detail?.order) return;

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

    try {
      if (status === "delivering" || status === "active") {
        await persistDeliveryInfoIfNeeded(detail.order.orderId);
      }
      await performChangeStatus(
        detail.order.orderId,
        status,
        status === "cancelled" ? cancelReason : "",
      );
    } catch (error) {
      showToast(
        String(
          (error as any)?.message || error || "Không cập nhật được trạng thái",
        ),
        "error",
      );
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

    await performChangeStatus(order.orderId, nextStatus);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
            <p className="mt-1 text-xs text-emerald-600">
              Tự đồng bộ gần real-time mỗi ~2.5 giây bằng version check nhẹ khi
              tab đang mở.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã đơn / tên / email / điện thoại"
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
              className="h-11 rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Làm mới
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left">
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
                  <Td colSpan={7}>Đang tải dữ liệu...</Td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <Td colSpan={7}>Không có đơn hàng phù hợp.</Td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const rowTransitions =
                    order.allowedTransitions ||
                    getAllowedOrderTransitions(
                      order.orderStatus,
                      order.paymentStatus,
                      order.orderType,
                    );
                  return (
                    <tr key={order.orderId}>
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
                        <div>
                          <div className="font-medium text-slate-900">
                            {order.customerName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {order.customerEmail}
                          </div>
                        </div>
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
                              onClick={() =>
                                void handleQuickTransition(order, "confirmed")
                              }
                              className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                            >
                              {getStatusActionLabel(order, "confirmed")}
                            </button>
                          )}
                          {rowTransitions.includes("delivering") && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleQuickTransition(order, "delivering")
                              }
                              className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
                            >
                              {getStatusActionLabel(order, "delivering")}
                            </button>
                          )}
                          {rowTransitions.includes("active") && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleQuickTransition(order, "active")
                              }
                              className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-50"
                            >
                              {getStatusActionLabel(order, "active")}
                            </button>
                          )}
                          {rowTransitions.includes("completed") && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleQuickTransition(order, "completed")
                              }
                              className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50"
                            >
                              {getStatusActionLabel(order, "completed")}
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
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Chi tiết đơn
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {detail?.order.orderId ||
                    selectedSummary?.orderId ||
                    "Đơn hàng"}
                </h2>
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
                        <p className="text-sm text-slate-500">Trạng thái đơn</p>
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
                          {formatPaymentStatusLabel(detail.order.paymentStatus)}
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
                          <p className="text-sm text-slate-500">Khách hàng</p>
                          <p className="mt-1 font-semibold text-slate-900">
                            {detail.order.customerName}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Điện thoại</p>
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
                            Lưu trong metadata của đơn để không phải đổi schema
                            sheet.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={acting || !deliveryInfoDirty}
                          onClick={() => void handleSaveDeliveryInfo()}
                          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Lưu thông tin giao hàng
                        </button>
                      </div>

                      {hasOrderAddressSnapshot(detail.order.addressSnapshot) && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-amber-900">
                              Địa chỉ snapshot lúc khách đặt đơn
                            </p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {getOrderAddressSnapshotSourceLabel(
                                detail.order.addressSnapshot,
                              )}
                            </span>
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
                          <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-sm text-slate-500">
                                Người nhận
                              </p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {detail.order.addressSnapshot.recipientName ||
                                  detail.order.customerName ||
                                  "--"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-500">
                                Điện thoại nhận
                              </p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {detail.order.addressSnapshot.recipientPhone ||
                                  detail.order.customerPhone ||
                                  "--"}
                              </p>
                            </div>
                            <div className="sm:col-span-2">
                              <p className="text-sm text-slate-500">
                                Địa chỉ đã chốt lúc checkout
                              </p>
                              <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">
                                {formatOrderAddressSnapshot(
                                  detail.order.addressSnapshot,
                                ) || "--"}
                              </p>
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
                              <th className="px-4 py-3 font-semibold">Giá</th>
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
                            acting || !allowedTransitions.includes("confirmed")
                          }
                          onClick={() => void handleChangeStatus("confirmed")}
                          className="rounded-2xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {getStatusActionLabel(
                            selectedOrderForActions,
                            "confirmed",
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={
                            acting || !allowedTransitions.includes("delivering")
                          }
                          onClick={() => void handleChangeStatus("delivering")}
                          className="rounded-2xl border border-orange-300 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {getStatusActionLabel(
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
                          {getStatusActionLabel(
                            selectedOrderForActions,
                            "active",
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={
                            acting || !allowedTransitions.includes("completed")
                          }
                          onClick={() => void handleChangeStatus("completed")}
                          className="rounded-2xl border border-green-300 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {getStatusActionLabel(
                            selectedOrderForActions,
                            "completed",
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={
                          acting || !allowedTransitions.includes("cancelled")
                        }
                        onClick={() => void handleChangeStatus("cancelled")}
                        className="w-full rounded-2xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Hủy đơn
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
                            <option value="final">Thanh toán chốt đơn</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">
                            Phương thức
                          </span>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
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
                          Thêm thanh toán
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
