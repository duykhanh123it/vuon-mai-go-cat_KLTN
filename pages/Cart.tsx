import React, { useMemo } from "react";
import type { CartItem } from "../types";
import {
  formatCurrencyVnd,
  formatTransactionTypeLabel,
} from "../utils/shopFormat";
import { getCartMode, getCartTotal } from "../utils/cart";
import { buildPolicyHref, getMinimumRentalDeposit } from "../utils/policy";

interface CartPageProps {
  items: CartItem[];
  onUpdateQuantity: (cartKey: string, quantity: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onClearCart: () => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
  onOpenProduct: (productId: string) => void;
}

const CartPage: React.FC<CartPageProps> = ({
  items,
  onRemoveItem,
  onClearCart,
  onContinueShopping,
  onCheckout,
  onOpenProduct,
}) => {
  const mode = useMemo(() => getCartMode(items), [items]);
  const totalAmount = useMemo(() => getCartTotal(items), [items]);
  const rentDepositMinimum = useMemo(
    () => (mode === "rent" ? getMinimumRentalDeposit(totalAmount) : 0),
    [mode, totalAmount],
  );

  if (!items.length) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            🛒
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Giỏ hàng đang trống
          </h1>
          <p className="mt-3 text-slate-500 leading-relaxed">
            Hãy chọn cây phù hợp rồi thêm vào giỏ để tạo đơn thuê hoặc đơn bán.
          </p>
          <button
            type="button"
            onClick={onContinueShopping}
            className="mt-8 inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
          >
            Xem danh sách sản phẩm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
              Giỏ hàng
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {mode
                ? `Đơn ${formatTransactionTypeLabel(mode).toLowerCase()}`
                : "Giỏ hàng"}
            </h1>
            <p className="mt-2 text-slate-500">
              Mỗi cây là một tài sản riêng biệt nên số lượng trong giỏ được giữ
              cố định là 1.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onContinueShopping}
              className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              ← Tiếp tục xem cây
            </button>
            <button
              type="button"
              onClick={onClearCart}
              className="rounded-2xl border border-red-200 px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50"
            >
              Xóa toàn bộ giỏ
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            {items.map((item) => (
              <article
                key={item.cartKey}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onOpenProduct(item.productId)}
                    className="h-28 w-full overflow-hidden rounded-2xl bg-slate-100 sm:w-36"
                  >
                    <img
                      src={item.image || "/notimg.jpg"}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => onOpenProduct(item.productId)}
                          className="text-left text-xl font-bold text-slate-900 hover:text-amber-700"
                        >
                          {item.productName}
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {item.productCategory}
                          </span>
                          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            {formatTransactionTypeLabel(item.transactionType)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Đơn giá</p>
                        <p className="text-xl font-bold text-amber-600">
                          {formatCurrencyVnd(item.unitPrice)}
                        </p>
                      </div>
                    </div>

                    {item.snapshotNote && (
                      <p className="mt-4 text-sm leading-relaxed text-slate-500">
                        {item.snapshotNote}
                      </p>
                    )}

                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-500">
                        Số lượng:{" "}
                        <span className="font-semibold text-slate-700">
                          1 cây
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                          Thành tiền: {formatCurrencyVnd(item.lineTotal)}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.cartKey)}
                          className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-xl font-bold text-slate-900">
              Tóm tắt đơn hàng
            </h2>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Số cây trong giỏ</span>
                <span className="font-semibold text-slate-900">
                  {items.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Loại giao dịch</span>
                <span className="font-semibold text-slate-900">
                  {mode ? formatTransactionTypeLabel(mode) : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-base">
                <span className="font-semibold text-slate-900">Tổng cộng</span>
                <span className="text-2xl font-bold text-amber-600">
                  {formatCurrencyVnd(totalAmount)}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              <p className="font-semibold text-amber-950">{mode === "rent" ? "Chính sách thuê đang áp dụng" : "Chính sách mua đang áp dụng"}</p>
              <p className="mt-2">
                {mode === "rent"
                  ? `Đơn thuê chỉ được giữ cây khi admin xác nhận và đã thu tối thiểu ${formatCurrencyVnd(rentDepositMinimum)} tiền cọc. Giá thuê niêm yết áp dụng cho 1 chu kỳ 5 - 10 ngày.`
                  : "Đơn mua tạo xong vẫn ở trạng thái new. Cây chỉ được giữ khi admin xác nhận và đơn chỉ hoàn tất khi giao xong, thanh toán đủ."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={buildPolicyHref(mode === "rent" ? "rent" : "buy")} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">Đọc chi tiết ↗</a>
                <a href={buildPolicyHref()} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">Xem trang chính sách ↗</a>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-500">
              Khi tạo đơn, hệ thống sẽ kiểm tra lại tình trạng cây ở backend
              trước khi nhận đơn để tránh trùng lặp.
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
            >
              Tiếp tục sang thanh toán
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
