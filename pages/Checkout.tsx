import React, { useEffect, useMemo, useState } from "react";
import type {
  AuthUser,
  CartItem,
  OrderCustomer,
  OrderDeliveryInfo,
} from "../types";
import { createOrder } from "../utils/ordersApi";
import { getCartMode, getCartTotal } from "../utils/cart";
import {
  formatCurrencyVnd,
  formatTransactionTypeLabel,
} from "../utils/shopFormat";
import { useToast } from "../components/Toast";

interface CheckoutPageProps {
  authUser?: AuthUser | null;
  items: CartItem[];
  onBackToCart: () => void;
  onContinueShopping: () => void;
  onOrderCreated: (orderId: string, customerEmail: string) => void;
  onRequestLogin: () => void;
}

const DEFAULT_CUSTOMER: OrderCustomer = {
  name: "",
  email: "",
  phone: "",
};

const DEFAULT_DELIVERY_INFO: OrderDeliveryInfo = {
  address: "",
  scheduledAt: "",
  note: "",
  updatedAt: "",
};

const validateCustomer = (customer: OrderCustomer) => {
  if (!customer.name.trim()) return "Vui lòng nhập họ và tên.";
  if (!customer.email.trim()) return "Vui lòng nhập email.";
  if (!/^\S+@\S+\.\S+$/.test(customer.email.trim())) {
    return "Email chưa đúng định dạng.";
  }
  if (!customer.phone.trim()) return "Vui lòng nhập số điện thoại.";
  return "";
};

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  authUser,
  items,
  onBackToCart,
  onContinueShopping,
  onOrderCreated,
  onRequestLogin,
}) => {
  const { showToast } = useToast();
  const [customer, setCustomer] = useState<OrderCustomer>(DEFAULT_CUSTOMER);
  const [deliveryInfo, setDeliveryInfo] = useState<OrderDeliveryInfo>(
    DEFAULT_DELIVERY_INFO,
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const mode = useMemo(() => getCartMode(items), [items]);
  const totalAmount = useMemo(() => getCartTotal(items), [items]);

  useEffect(() => {
    setCustomer((prev) => ({
      ...prev,
      name: authUser?.name || prev.name,
      email: authUser?.email || prev.email,
      phone: authUser?.phone || prev.phone,
    }));
  }, [authUser?.email, authUser?.name, authUser?.phone]);

  if (!authUser?.email) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            🔐
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Đăng nhập để tạo đơn hàng
          </h1>
          <p className="mt-3 leading-relaxed text-slate-500">
            Đơn mua hoặc thuê chỉ được tạo bằng tài khoản đã đăng nhập để bảo vệ
            vòng đời đơn và tránh giả mạo thao tác trên hệ thống.
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

  if (!items.length) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
            📦
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Chưa có gì để thanh toán
          </h1>
          <p className="mt-3 leading-relaxed text-slate-500">
            Giỏ hàng đang trống. Hãy chọn cây trước khi tạo đơn.
          </p>
          <button
            type="button"
            onClick={onContinueShopping}
            className="mt-8 inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500"
          >
            Xem sản phẩm
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateCustomer(customer);
    if (error) {
      showToast(error, "error");
      return;
    }

    try {
      setSubmitting(true);
      const response = await createOrder({
        customer,
        items,
        note,
        deliveryInfo: {
          address: deliveryInfo.address,
          scheduledAt: deliveryInfo.scheduledAt,
          note: deliveryInfo.note,
        },
      });
      onOrderCreated(response.orderId, customer.email.trim().toLowerCase());
    } catch (error) {
      showToast(
        String((error as any)?.message || error || "Không thể tạo đơn hàng"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deliveryAddressLabel =
    mode === "rent" ? "Địa điểm bàn giao cây" : "Địa chỉ giao cây";

  return (
    <div className="bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
              Checkout
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Hoàn tất thông tin để tạo đơn
            </h1>
            <p className="mt-2 text-slate-500">
              Tạo đơn chỉ ghi nhận nhu cầu ban đầu. Cây chỉ được giữ khi admin
              xác nhận đơn ở trạng thái <strong>confirmed</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToCart}
            className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← Quay lại giỏ hàng
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Thông tin khách hàng
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Email này sẽ là đầu mối để tra cứu lịch sử đơn hàng của bạn.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Họ và tên
                </span>
                <input
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="Nguyễn Văn A"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Số điện thoại
                </span>
                <input
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="09xx xxx xxx"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </span>
                <input
                  value={customer.email}
                  readOnly
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="ban@email.com"
                />
                <span className="mt-2 block text-xs text-slate-500">
                  Đơn sẽ gắn với email tài khoản đang đăng nhập để truy vết đúng
                  người tạo đơn.
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Thông tin giao / bàn giao cây
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Phần này chưa bắt buộc, nhưng nên điền sớm để admin chuẩn bị
                  giao cây và chuyển đơn sang bước <strong>delivering</strong>{" "}
                  đúng nghiệp vụ.
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    {deliveryAddressLabel}
                  </span>
                  <textarea
                    value={deliveryInfo.address}
                    onChange={(e) =>
                      setDeliveryInfo((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    className="min-h-[96px] w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    placeholder={
                      mode === "rent"
                        ? "Ví dụ: giao tại sân nhà khách ở Gò Vấp, cần gọi trước 30 phút..."
                        : "Ví dụ: 123 Nguyễn Trãi, P. Bến Thành, Q.1, TP.HCM"
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Thời gian giao dự kiến
                  </span>
                  <input
                    type="datetime-local"
                    value={deliveryInfo.scheduledAt}
                    onChange={(e) =>
                      setDeliveryInfo((prev) => ({
                        ...prev,
                        scheduledAt: e.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Ghi chú giao hàng
                  </span>
                  <textarea
                    value={deliveryInfo.note}
                    onChange={(e) =>
                      setDeliveryInfo((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    className="min-h-[96px] w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    placeholder="Ví dụ: giao giờ hành chính, xe tải nhỏ vào hẻm được, cần liên hệ trước khi đến..."
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Ghi chú cho đơn hàng
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[120px] w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="Ví dụ: cần tư vấn thêm về dáng cây, khách muốn trao đổi lại giá, cần xuất hóa đơn..."
                />
              </label>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-900">
                Luồng vận hành sau khi tạo đơn
              </p>
              <ul className="mt-2 space-y-2">
                <li>
                  • Đơn mới tạo ở trạng thái <strong>new</strong>.
                </li>
                <li>
                  • Đơn mới chỉ ghi nhận nhu cầu và chờ admin kiểm tra thực tế.
                </li>
                <li>
                  • Chỉ khi admin xác nhận <strong>confirmed</strong>, cây mới
                  chuyển sang trạng thái giữ chỗ <strong>reserved</strong>.
                </li>
                <li>
                  • Với đơn bán, admin sẽ cập nhật thông tin giao hàng rồi
                  chuyển đơn sang <strong>delivering</strong> trước khi hoàn tất
                  giao.
                </li>
                <li>
                  • Với đơn thuê, sau khi bàn giao cây, admin sẽ chuyển đơn sang
                  <strong>active</strong> và cây chuyển thành
                  <strong>rented_out</strong>.
                </li>
                <li>
                  • Khi khách trả cây và admin xác nhận hoàn tất đơn thuê,
                  inventory sẽ tự mở lại về <strong>available</strong> để cây có
                  thể được đặt cho giao dịch mới.
                </li>
                <li>
                  • Nếu đơn <strong>confirmed</strong> không được hoàn tất trong
                  khoảng <strong>30 phút</strong>, lock giữ cây sẽ tự hết hiệu
                  lực. Riêng đơn <strong>delivering</strong> sẽ tiếp tục khóa
                  cây cho tới khi giao xong hoặc trả về{" "}
                  <strong>confirmed</strong>.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onBackToCart}
                className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Quay lại giỏ hàng
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Đang tạo đơn..." : "Tạo đơn ngay"}
              </button>
            </div>
          </form>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-xl font-bold text-slate-900">Tóm tắt đơn</h2>
            <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Loại đơn: {mode ? formatTransactionTypeLabel(mode) : "--"}
            </div>
            <div className="mt-5 space-y-4">
              {items.map((item) => (
                <div
                  key={item.cartKey}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                        {item.productId} • {item.productCategory}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-amber-600">
                      {formatCurrencyVnd(item.lineTotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Số cây</span>
                <span>{items.length}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-base font-semibold text-slate-900">
                <span>Tổng tiền</span>
                <span className="text-2xl font-bold text-amber-600">
                  {formatCurrencyVnd(totalAmount)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
