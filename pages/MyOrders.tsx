import React, { useEffect, useMemo, useState } from "react";
import type { AuthUser, OrderDetailResponse, OrderSummary } from "../types";
import { fetchOrderDetail, fetchOrders } from "../utils/ordersApi";
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
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!authUser?.email) return;
    let alive = true;

    const loadOrders = async () => {
      try {
        setLoading(true);
        const data = await fetchOrders({ customerEmail: authUser.email });
        if (!alive) return;
        const sorted = [...data].sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
        );
        setOrders(sorted);
        const nextSelected =
          sorted.find((item) => item.orderId === highlightedOrderId)?.orderId ||
          sorted[0]?.orderId ||
          "";
        setSelectedOrderId(nextSelected);
      } catch (error) {
        if (!alive) return;
        showToast(
          String((error as any)?.message || error || "Không tải được đơn hàng"),
          "error",
        );
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadOrders();
    return () => {
      alive = false;
    };
  }, [authUser?.email, highlightedOrderId, showToast]);

  useEffect(() => {
    if (!authUser?.email || !selectedOrderId) {
      setDetail(null);
      return;
    }

    let alive = true;
    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        const data = await fetchOrderDetail(selectedOrderId, {
          customerEmail: authUser.email,
        });
        if (!alive) return;
        setDetail(data);
      } catch (error) {
        if (!alive) return;
        showToast(
          String(
            (error as any)?.message || error || "Không tải được chi tiết đơn",
          ),
          "error",
        );
      } finally {
        if (alive) setDetailLoading(false);
      }
    };

    void loadDetail();
    return () => {
      alive = false;
    };
  }, [authUser?.email, selectedOrderId, showToast]);

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
                    onClick={() => setSelectedOrderId(order.orderId)}
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
