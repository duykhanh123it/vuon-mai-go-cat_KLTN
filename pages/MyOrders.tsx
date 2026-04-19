import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../components/Toast";
import type { AuthUser, OrderDetailResponse, OrderSummary } from "../types";
import { fetchMyOrders, fetchOrderDetail } from "../utils/ordersApi";
import {
  formatCurrencyVnd,
  formatDateTimeValue,
  getOrderStatusMeta,
  getTransactionTypeLabel,
} from "../utils/shopFormat";

interface MyOrdersPageProps {
  authUser: AuthUser | null;
  highlightedOrderId?: string;
  onRequestLogin: () => void;
  onGoProducts: () => void;
  onOpenProduct?: (productId: string) => void;
}

const MyOrdersPage: React.FC<MyOrdersPageProps> = ({
  authUser,
  highlightedOrderId,
  onRequestLogin,
  onGoProducts,
  onOpenProduct,
}) => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, OrderDetailResponse>>(
    {},
  );
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!authUser?.email) return;

    try {
      setLoading(true);
      const result = await fetchMyOrders(authUser.email);
      setOrders(result);
    } catch (error) {
      showToast(
        String((error as any)?.message || error || "Không thể tải đơn hàng"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [authUser?.email, showToast]);

  const loadDetail = useCallback(
    async (orderId: string) => {
      if (!orderId) return;
      if (detailMap[orderId]) return;

      try {
        setLoadingDetailId(orderId);
        const detail = await fetchOrderDetail(orderId);
        setDetailMap((prev) => ({
          ...prev,
          [orderId]: detail,
        }));
      } catch (error) {
        showToast(
          String(
            (error as any)?.message || error || "Không thể tải chi tiết đơn hàng",
          ),
          "error",
        );
      } finally {
        setLoadingDetailId((current) => (current === orderId ? null : current));
      }
    },
    [detailMap, showToast],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!highlightedOrderId) return;
    if (!orders.some((order) => order.orderId === highlightedOrderId)) return;

    setExpandedOrderId(highlightedOrderId);
    void loadDetail(highlightedOrderId);
  }, [highlightedOrderId, loadDetail, orders]);

  const summary = useMemo(() => {
    const totalOrders = orders.length;
    const outstandingOrders = orders.filter((order) => order.remainingAmount > 0).length;
    const totalOutstanding = orders.reduce(
      (sum, order) => sum + order.remainingAmount,
      0,
    );

    return {
      totalOrders,
      outstandingOrders,
      totalOutstanding,
    };
  }, [orders]);

  if (!authUser) {
    return (
      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
            <div className="mb-4 text-6xl">🔐</div>
            <h1 className="mb-3 text-3xl font-extrabold text-slate-900">
              Bạn cần đăng nhập để xem đơn hàng
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-500">
              Hãy đăng nhập bằng đúng email đã dùng khi tạo đơn để xem lịch sử
              thanh toán và công nợ của mình.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onRequestLogin}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
              >
                Đăng nhập ngay
              </button>
              <button
                type="button"
                onClick={onGoProducts}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Quay lại xem sản phẩm
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              My Orders
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Đơn hàng của tôi
            </h1>
            <p className="mt-3 max-w-2xl text-slate-500">
              Đang hiển thị đơn của tài khoản{' '}
              <span className="font-bold text-slate-900">{authUser.email}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onGoProducts}
            className="self-start rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Tiếp tục xem sản phẩm
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tổng số đơn
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {summary.totalOrders}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Đơn còn công nợ
            </p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {summary.outstandingOrders}
            </p>
          </div>

          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Tổng còn phải thanh toán
            </p>
            <p className="mt-2 text-3xl font-extrabold text-amber-900">
              {formatCurrencyVnd(summary.totalOutstanding)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            <p className="font-semibold text-slate-700">Đang tải đơn hàng...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mb-4 text-6xl">📭</div>
            <h2 className="mb-3 text-2xl font-extrabold text-slate-900">
              Bạn chưa có đơn hàng nào
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-500">
              Khi bạn hoàn tất checkout, đơn hàng sẽ xuất hiện tại đây cùng với
              tình trạng thanh toán và công nợ.
            </p>
            <button
              type="button"
              onClick={onGoProducts}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
            >
              Bắt đầu chọn cây
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const detail = detailMap[order.orderId];
              const statusMeta = getOrderStatusMeta(order.orderStatus);
              const expanded = expandedOrderId === order.orderId;

              return (
                <div
                  key={order.orderId}
                  className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const nextExpanded = expanded ? null : order.orderId;
                      setExpandedOrderId(nextExpanded);
                      if (nextExpanded) {
                        void loadDetail(nextExpanded);
                      }
                    }}
                    className="w-full px-5 py-5 text-left transition hover:bg-slate-50 sm:px-6"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Mã đơn hàng
                        </p>
                        <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
                          {order.orderId}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                          Tạo lúc: {formatDateTimeValue(order.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {getTransactionTypeLabel(order.orderType)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Tổng đơn
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {formatCurrencyVnd(order.totalAmount)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Đã thanh toán
                        </p>
                        <p className="mt-1 text-xl font-bold text-emerald-700">
                          {formatCurrencyVnd(order.paidAmount)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-amber-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Còn phải trả
                        </p>
                        <p className="mt-1 text-xl font-bold text-amber-900">
                          {formatCurrencyVnd(order.remainingAmount)}
                        </p>
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-200 px-5 py-5 sm:px-6">
                      {loadingDetailId === order.orderId && !detail ? (
                        <div className="py-6 text-center">
                          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
                          <p className="text-sm font-medium text-slate-500">
                            Đang tải chi tiết đơn hàng...
                          </p>
                        </div>
                      ) : detail ? (
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="space-y-6">
                            <div>
                              <h3 className="mb-3 text-lg font-extrabold text-slate-900">
                                Sản phẩm trong đơn
                              </h3>
                              <div className="space-y-3">
                                {detail.items.map((item) => (
                                  <div
                                    key={item.orderItemId}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <div className="mb-2 flex flex-wrap gap-2">
                                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                                            {item.productType || "Sản phẩm"}
                                          </span>
                                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                                            {getTransactionTypeLabel(item.transactionType)}
                                          </span>
                                        </div>

                                        <p className="text-lg font-bold text-slate-900">
                                          {item.productCode}
                                        </p>

                                        {item.snapshotNote ? (
                                          <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                            {item.snapshotNote}
                                          </p>
                                        ) : null}

                                        {onOpenProduct ? (
                                          <button
                                            type="button"
                                            onClick={() => onOpenProduct(item.productCode)}
                                            className="mt-3 text-sm font-bold text-amber-700 transition hover:text-amber-800"
                                          >
                                            Xem lại cây này →
                                          </button>
                                        ) : null}
                                      </div>

                                      <div className="grid gap-2 text-right">
                                        <div>
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Số lượng
                                          </p>
                                          <p className="font-bold text-slate-900">{item.quantity}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Thành tiền
                                          </p>
                                          <p className="font-bold text-amber-700">
                                            {formatCurrencyVnd(item.lineTotal)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h3 className="mb-3 text-lg font-extrabold text-slate-900">
                                Lịch sử thanh toán
                              </h3>
                              {detail.payments.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                  Đơn hàng này chưa có lần thanh toán nào được ghi nhận.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {detail.payments.map((payment) => (
                                    <div
                                      key={payment.paymentId}
                                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                                    >
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                          <p className="font-bold text-slate-900">
                                            {formatCurrencyVnd(payment.amount)}
                                          </p>
                                          <p className="mt-1 text-sm text-slate-500">
                                            {formatDateTimeValue(payment.paidAt)}
                                          </p>
                                        </div>
                                        <div className="text-sm text-slate-500 sm:text-right">
                                          <p className="font-semibold text-slate-700">
                                            {payment.method || "Không rõ phương thức"}
                                          </p>
                                          {payment.note ? <p>{payment.note}</p> : null}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <aside className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Khách hàng
                              </p>
                              <p className="mt-2 text-lg font-bold text-slate-900">
                                {detail.order.customerName}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {detail.order.customerPhone || "--"}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {detail.order.customerEmail || "--"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Công nợ hiện tại
                              </p>
                              <div className="mt-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-slate-600">Tổng đơn</span>
                                  <span className="font-bold text-slate-900">
                                    {formatCurrencyVnd(detail.order.totalAmount)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-slate-600">Đã thanh toán</span>
                                  <span className="font-bold text-emerald-700">
                                    {formatCurrencyVnd(detail.order.paidAmount)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 border-t border-amber-200 pt-3">
                                  <span className="text-slate-700">Còn phải trả</span>
                                  <span className="text-xl font-extrabold text-amber-900">
                                    {formatCurrencyVnd(detail.order.remainingAmount)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {detail.order.note ? (
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Ghi chú đơn hàng
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                  {detail.order.note}
                                </p>
                              </div>
                            ) : null}
                          </aside>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                          Không có dữ liệu chi tiết cho đơn hàng này.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default MyOrdersPage;
