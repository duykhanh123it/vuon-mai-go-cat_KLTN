import React from "react";
import type { CartItem } from "../types";
import { formatCurrencyVnd, getTransactionTypeLabel } from "../utils/shopFormat";
import { getCartMode, getCartSubtotal, getCartTotal } from "../utils/cart";

interface CartPageProps {
  items: CartItem[];
  onUpdateQuantity: (cartKey: string, quantity: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onClearCart: () => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
  onOpenProduct?: (productId: string) => void;
}

const CartPage: React.FC<CartPageProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onContinueShopping,
  onCheckout,
  onOpenProduct,
}) => {
  const cartMode = getCartMode(items);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = getCartTotal(items);

  if (!items.length) {
    return (
      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
            <div className="mb-4 text-6xl">🛒</div>
            <h1 className="mb-3 text-3xl font-extrabold text-slate-900">
              Giỏ hàng đang trống
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-500">
              Bạn chưa thêm cây mai nào vào giỏ. Hãy quay lại danh sách sản phẩm
              để chọn cây phù hợp rồi tiến hành thanh toán.
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

  return (
    <section className="bg-slate-50 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Cart / Giỏ hàng
            </p>
            <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Giỏ hàng của bạn
            </h1>
            <p className="mt-3 max-w-2xl text-slate-500">
              Bạn đang có <span className="font-bold text-slate-900">{totalQuantity}</span>{" "}
              sản phẩm trong giỏ.
              {cartMode ? (
                <>
                  {" "}Đơn hiện tại đang ở chế độ
                  <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                    {getTransactionTypeLabel(cartMode)}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onContinueShopping}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Tiếp tục chọn cây
            </button>
            <button
              type="button"
              onClick={onClearCart}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Xóa toàn bộ giỏ hàng
            </button>
          </div>
        </div>

        {cartMode === null && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
            Giỏ hàng đang chứa nhiều loại giao dịch khác nhau. Backend hiện tại chỉ
            hỗ trợ mỗi đơn một loại thuê hoặc mua. Vui lòng xóa giỏ hàng và thêm
            lại theo đúng loại giao dịch.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.cartKey}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onOpenProduct?.(item.productId)}
                    className="h-32 w-full overflow-hidden rounded-2xl bg-slate-100 sm:h-36 sm:w-40"
                  >
                    <img
                      src={item.image || "/notimg.jpg"}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </button>

                  <div className="flex flex-1 flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {item.category}
                          </span>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                            {getTransactionTypeLabel(item.transactionType)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenProduct?.(item.productId)}
                          className="text-left text-2xl font-extrabold text-slate-900 transition hover:text-amber-700"
                        >
                          {item.name}
                        </button>

                        <p className="mt-1 text-sm text-slate-500">
                          Mã cây: {item.productId}
                        </p>

                        {item.snapshotNote ? (
                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
                            {item.snapshotNote}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.cartKey)}
                        className="self-start rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Xóa
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Đơn giá
                        </p>
                        <p className="text-lg font-bold text-slate-900">
                          {formatCurrencyVnd(item.unitPrice)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Số lượng
                        </p>
                        <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(item.cartKey, Math.max(1, item.quantity - 1))
                            }
                            className="h-10 w-10 text-lg font-bold text-slate-700 transition hover:bg-slate-100"
                          >
                            −
                          </button>
                          <div className="grid h-10 min-w-[52px] place-items-center border-x border-slate-200 px-3 font-bold text-slate-900">
                            {item.quantity}
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.cartKey, item.quantity + 1)}
                            className="h-10 w-10 text-lg font-bold text-slate-700 transition hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Thành tiền
                        </p>
                        <p className="text-lg font-bold text-amber-700">
                          {formatCurrencyVnd(getCartSubtotal(item))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-extrabold text-slate-900">
                Tóm tắt đơn hàng
              </h2>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Số sản phẩm
                  </p>
                  <p className="text-xl font-bold text-slate-900">{totalQuantity}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Loại giao dịch
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {cartMode ? getTransactionTypeLabel(cartMode) : "Không hợp lệ"}
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 px-4 py-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Tổng tạm tính
                  </p>
                  <p className="text-3xl font-extrabold text-amber-900">
                    {formatCurrencyVnd(totalAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={onCheckout}
                  disabled={cartMode === null}
                  className="w-full rounded-2xl bg-amber-400 px-5 py-3.5 font-bold text-amber-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tiến hành thanh toán
                </button>

                <button
                  type="button"
                  onClick={onContinueShopping}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Quay lại xem sản phẩm
                </button>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Hệ thống hiện tạo một đơn cho một loại giao dịch. Nếu bạn muốn vừa
                thuê vừa mua, hãy hoàn tất đơn hiện tại rồi tạo đơn tiếp theo.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default CartPage;
