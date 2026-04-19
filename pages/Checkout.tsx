import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "../components/Toast";
import type { AuthUser, CartItem } from "../types";
import { createOrder } from "../utils/ordersApi";
import { getCartMode, getCartSubtotal, getCartTotal } from "../utils/cart";
import { formatCurrencyVnd, getTransactionTypeLabel } from "../utils/shopFormat";

interface CheckoutPageProps {
  authUser: AuthUser | null;
  items: CartItem[];
  onBackToCart: () => void;
  onContinueShopping: () => void;
  onOrderCreated: (orderId: string, customerEmail: string) => void;
}

const validateEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  authUser,
  items,
  onBackToCart,
  onContinueShopping,
  onOrderCreated,
}) => {
  const { showToast } = useToast();
  const cartMode = getCartMode(items);
  const totalAmount = getCartTotal(items);

  const [customerName, setCustomerName] = useState(authUser?.name || "");
  const [customerEmail, setCustomerEmail] = useState(authUser?.email || "");
  const [customerPhone, setCustomerPhone] = useState(authUser?.phone || "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authUser?.name && !customerName.trim()) {
      setCustomerName(authUser.name);
    }
    if (authUser?.email && !customerEmail.trim()) {
      setCustomerEmail(authUser.email);
    }
    if (authUser?.phone && !customerPhone.trim()) {
      setCustomerPhone(authUser.phone);
    }
  }, [authUser, customerEmail, customerName, customerPhone]);

  const lineItems = useMemo(
    () =>
      items.map((item) => ({
        productCode: item.productId,
        productType: item.category,
        transactionType: item.transactionType,
        price: item.unitPrice,
        quantity: item.quantity,
        note: item.snapshotNote,
      })),
    [items],
  );

  if (!items.length) {
    return (
      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
            <div className="mb-4 text-6xl">📦</div>
            <h1 className="mb-3 text-3xl font-extrabold text-slate-900">
              Chưa có sản phẩm để thanh toán
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-500">
              Giỏ hàng của bạn đang trống. Hãy chọn cây mai trước khi tiến hành
              tạo đơn hàng.
            </p>
            <button
              type="button"
              onClick={onContinueShopping}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
            >
              Xem sản phẩm
            </button>
          </div>
        </div>
      </section>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!cartMode) {
      showToast(
        "Giỏ hàng đang trộn nhiều loại giao dịch. Vui lòng quay lại và kiểm tra lại giỏ hàng.",
        "error",
      );
      return;
    }

    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      showToast("Vui lòng nhập đủ họ tên, email và số điện thoại", "error");
      return;
    }

    if (!validateEmail(customerEmail)) {
      showToast("Email không đúng định dạng", "error");
      return;
    }

    try {
      setSubmitting(true);

      const result = await createOrder({
        customer: {
          email: customerEmail.trim().toLowerCase(),
          name: customerName.trim(),
          phone: customerPhone.trim(),
        },
        orderType: cartMode,
        note: note.trim(),
        items: lineItems,
      });

      onOrderCreated(result.orderId, customerEmail.trim().toLowerCase());
    } catch (error) {
      showToast(
        String((error as any)?.message || error || "Không thể tạo đơn hàng"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-slate-50 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Checkout
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Xác nhận đơn hàng
            </h1>
            <p className="mt-3 max-w-2xl text-slate-500">
              Kiểm tra lại thông tin khách hàng và danh sách cây trước khi gửi
              đơn lên hệ thống.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToCart}
            className="self-start rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Quay lại giỏ hàng
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-relaxed text-amber-900">
              {authUser ? (
                <>
                  Đơn hàng này sẽ gắn với tài khoản{' '}
                  <span className="font-bold">{authUser.email}</span>. Sau khi tạo
                  đơn, bạn có thể vào mục <span className="font-bold">Đơn hàng của tôi</span>{' '}
                  để xem công nợ và lịch sử thanh toán.
                </>
              ) : (
                <>
                  Bạn vẫn có thể tạo đơn mà không cần đăng nhập. Để xem lịch sử
                  đơn hàng sau này, hãy đăng nhập bằng đúng email dùng khi thanh
                  toán.
                </>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Họ và tên
                </span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>

              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Số điện thoại
                </span>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="0909 xxx xxx"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </span>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="ban@example.com"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Ghi chú cho đơn hàng
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={5}
                  placeholder="Ví dụ: cần giao vào sáng 28 Tết, cần tư vấn thêm cây tương tự..."
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={submitting || !cartMode}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3.5 font-bold text-amber-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Đang tạo đơn hàng..." : "Tạo đơn hàng"}
              </button>

              <button
                type="button"
                onClick={onBackToCart}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Quay lại giỏ hàng
              </button>
            </div>
          </form>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-extrabold text-slate-900">
                Tóm tắt thanh toán
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {cartMode ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                    {getTransactionTypeLabel(cartMode)}
                  </span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {items.length} dòng sản phẩm
                </span>
              </div>

              <div className="mt-6 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.cartKey}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.quantity} × {formatCurrencyVnd(item.unitPrice)}
                        </p>
                      </div>
                      <p className="font-bold text-amber-700">
                        {formatCurrencyVnd(getCartSubtotal(item))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Tổng giá trị đơn hàng
                </p>
                <p className="text-3xl font-extrabold text-amber-900">
                  {formatCurrencyVnd(totalAmount)}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default CheckoutPage;
