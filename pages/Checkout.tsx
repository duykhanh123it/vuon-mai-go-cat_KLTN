import React, { useEffect, useMemo, useState } from "react";
import {
  formatOrderAddressSnapshot,
  getOrderAddressSnapshotSourceLabel,
  hasOrderAddressSnapshot,
  normalizeOrderAddressSnapshot,
} from "../types";
import type {
  AuthUser,
  CartItem,
  OrderAddressSnapshot,
  OrderCustomer,
  OrderDeliveryInfo,
  UserAddress,
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

type AddressMode = "saved" | "manual";

type ManualAddressForm = {
  label: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  ward: string;
  line1: string;
};

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

const buildManualAddressDraft = (
  customer?: Partial<OrderCustomer> | null,
): ManualAddressForm => ({
  label: "",
  recipientName: String(customer?.name || "").trim(),
  recipientPhone: String(customer?.phone || "").trim(),
  province: "",
  ward: "",
  line1: "",
});

const validateCustomer = (customer: OrderCustomer) => {
  if (!customer.name.trim()) return "Vui lòng nhập họ và tên.";
  if (!customer.email.trim()) return "Vui lòng nhập email.";
  if (!/^\S+@\S+\.\S+$/.test(customer.email.trim())) {
    return "Email chưa đúng định dạng.";
  }
  if (!customer.phone.trim()) return "Vui lòng nhập số điện thoại.";
  return "";
};

const buildSnapshotFromSavedAddress = (
  address: UserAddress,
  customer: OrderCustomer,
  note: string,
): OrderAddressSnapshot =>
  normalizeOrderAddressSnapshot({
    id: address.id,
    label: address.label,
    recipientName: address.recipientName || customer.name,
    recipientPhone: address.recipientPhone || customer.phone,
    province: address.province,
    ward: address.ward,
    line1: address.line1,
    note,
    isDefault: address.isDefault,
    source: "saved_address",
  });

const buildSnapshotFromManualAddress = (
  manualAddress: ManualAddressForm,
  customer: OrderCustomer,
  note: string,
): OrderAddressSnapshot =>
  normalizeOrderAddressSnapshot({
    label: manualAddress.label,
    recipientName: manualAddress.recipientName || customer.name,
    recipientPhone: manualAddress.recipientPhone || customer.phone,
    province: manualAddress.province,
    ward: manualAddress.ward,
    line1: manualAddress.line1,
    note,
    isDefault: false,
    source: "manual_input",
  });

const validateAddressSnapshot = (address: OrderAddressSnapshot) => {
  if (!address.recipientName.trim()) return "Vui lòng nhập tên người nhận.";
  if (!address.recipientPhone.trim()) {
    return "Vui lòng nhập số điện thoại người nhận.";
  }
  if (!address.province.trim()) {
    return "Vui lòng nhập Tỉnh / Thành phố trực thuộc Trung ương.";
  }
  if (!address.ward.trim()) {
    return "Vui lòng nhập Xã / Phường / Đặc khu.";
  }
  if (!address.line1.trim()) {
    return "Vui lòng nhập số nhà + tên đường/thôn/xóm/ấp.";
  }
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
  const savedAddresses = useMemo(
    () => (Array.isArray(authUser?.addressBook) ? authUser.addressBook : []),
    [authUser?.addressBook],
  );

  const [customer, setCustomer] = useState<OrderCustomer>(DEFAULT_CUSTOMER);
  const [deliveryInfo, setDeliveryInfo] = useState<OrderDeliveryInfo>(
    DEFAULT_DELIVERY_INFO,
  );
  const [manualAddress, setManualAddress] = useState<ManualAddressForm>(() =>
    buildManualAddressDraft(authUser),
  );
  const [addressMode, setAddressMode] = useState<AddressMode>(
    savedAddresses.length ? "saved" : "manual",
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("");
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

  useEffect(() => {
    if (!savedAddresses.length) {
      setAddressMode("manual");
      setSelectedSavedAddressId("");
      return;
    }

    setAddressMode((prev) => {
      if (prev === "saved") return prev;

      const hasManualDraft = Boolean(
        [
          manualAddress.label,
          manualAddress.line1,
          manualAddress.ward,
          manualAddress.province,
        ]
          .join("")
          .trim(),
      );

      return hasManualDraft ? prev : "saved";
    });

    setSelectedSavedAddressId((prev) => {
      if (prev && savedAddresses.some((item) => item.id === prev)) {
        return prev;
      }
      return (
        savedAddresses.find((item) => item.isDefault)?.id ||
        savedAddresses[0]?.id ||
        ""
      );
    });
  }, [
    manualAddress.label,
    manualAddress.line1,
    manualAddress.province,
    manualAddress.ward,
    savedAddresses,
  ]);

  useEffect(() => {
    setManualAddress((prev) => ({
      ...prev,
      recipientName: prev.recipientName || customer.name || authUser?.name || "",
      recipientPhone:
        prev.recipientPhone || customer.phone || authUser?.phone || "",
    }));
  }, [authUser?.name, authUser?.phone, customer.name, customer.phone]);

  const selectedSavedAddress = useMemo(
    () =>
      savedAddresses.find((item) => item.id === selectedSavedAddressId) ||
      savedAddresses.find((item) => item.isDefault) ||
      savedAddresses[0] ||
      null,
    [savedAddresses, selectedSavedAddressId],
  );

  const resolvedAddressSnapshot = useMemo(() => {
    if (addressMode === "saved" && selectedSavedAddress) {
      return buildSnapshotFromSavedAddress(
        selectedSavedAddress,
        customer,
        deliveryInfo.note.trim(),
      );
    }

    return buildSnapshotFromManualAddress(
      manualAddress,
      customer,
      deliveryInfo.note.trim(),
    );
  }, [
    addressMode,
    customer,
    deliveryInfo.note,
    manualAddress,
    selectedSavedAddress,
  ]);

  const resolvedAddressText = useMemo(
    () => formatOrderAddressSnapshot(resolvedAddressSnapshot),
    [resolvedAddressSnapshot],
  );

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
    const customerError = validateCustomer(customer);
    if (customerError) {
      showToast(customerError, "error");
      return;
    }

    if (addressMode === "saved" && !selectedSavedAddress) {
      showToast("Vui lòng chọn một địa chỉ đã lưu hoặc chuyển sang nhập mới.", "error");
      return;
    }

    const addressError = validateAddressSnapshot(resolvedAddressSnapshot);
    if (addressError) {
      showToast(addressError, "error");
      return;
    }

    try {
      setSubmitting(true);
      const response = await createOrder({
        customer,
        items,
        note,
        addressSnapshot: resolvedAddressSnapshot,
        deliveryInfo: {
          address: resolvedAddressText,
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
                  Địa chỉ được snapshot vào đơn tại thời điểm checkout để đơn cũ
                  không bị đổi theo Address Book sau này.
                </p>
              </div>

              <div className="mt-4 space-y-4">
                {savedAddresses.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setAddressMode("saved")}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          addressMode === "saved"
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Dùng địa chỉ đã lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddressMode("manual")}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          addressMode === "manual"
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Nhập địa chỉ mới
                      </button>
                    </div>

                    {addressMode === "saved" ? (
                      <div className="grid gap-3">
                        {savedAddresses.map((address) => {
                          const isActive = address.id === selectedSavedAddress?.id;
                          const addressText = formatOrderAddressSnapshot(address);
                          return (
                            <button
                              key={address.id}
                              type="button"
                              onClick={() => setSelectedSavedAddressId(address.id)}
                              className={`rounded-2xl border px-4 py-4 text-left transition ${
                                isActive
                                  ? "border-amber-300 bg-amber-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">
                                  {address.label || "Địa chỉ giao hàng"}
                                </p>
                                {address.isDefault && (
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    Mặc định
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {address.recipientName || customer.name || "Người nhận"}
                                {address.recipientPhone
                                  ? ` • ${address.recipientPhone}`
                                  : ""}
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                {addressText || "Chưa đủ địa chỉ"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Tài khoản này chưa có địa chỉ đã lưu. Bạn có thể nhập trực tiếp
                    bên dưới, hoặc thêm vào hồ sơ ở phần tài khoản sau.
                  </div>
                )}

                {(addressMode === "manual" || !savedAddresses.length) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Tên gợi nhớ địa chỉ
                      </span>
                      <input
                        value={manualAddress.label}
                        onChange={(e) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            label: e.target.value,
                          }))
                        }
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="Ví dụ: Nhà riêng, Shop, Nhà ba mẹ"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Người nhận
                      </span>
                      <input
                        value={manualAddress.recipientName}
                        onChange={(e) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            recipientName: e.target.value,
                          }))
                        }
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="Nguyễn Văn A"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Số điện thoại người nhận
                      </span>
                      <input
                        value={manualAddress.recipientPhone}
                        onChange={(e) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            recipientPhone: e.target.value,
                          }))
                        }
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="09xx xxx xxx"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Tỉnh / Thành phố trực thuộc Trung ương
                      </span>
                      <input
                        value={manualAddress.province}
                        onChange={(e) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            province: e.target.value,
                          }))
                        }
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="TP.HCM"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Xã / Phường / Đặc khu
                      </span>
                      <input
                        value={manualAddress.ward}
                        onChange={(e) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            ward: e.target.value,
                          }))
                        }
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="Phường Bến Thành"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Số nhà + đường / thôn / xóm / ấp
                      </span>
                      <textarea
                        value={manualAddress.line1}
                        onChange={(e) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            line1: e.target.value,
                          }))
                        }
                        className="min-h-[96px] w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder={
                          mode === "rent"
                            ? "Ví dụ: số 12, đường số 3, tổ 4, khu dân cư..., có cổng rộng cho xe tải nhỏ"
                            : "Ví dụ: 123 Nguyễn Trãi, hẻm 45, tầng trệt"
                        }
                      />
                    </label>
                  </div>
                )}

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    <span>Snapshot địa chỉ</span>
                    {hasOrderAddressSnapshot(resolvedAddressSnapshot) && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600">
                        {getOrderAddressSnapshotSourceLabel(
                          resolvedAddressSnapshot,
                        )}
                      </span>
                    )}
                    {resolvedAddressSnapshot.label && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600">
                        {resolvedAddressSnapshot.label}
                      </span>
                    )}
                  </div>

                  {hasOrderAddressSnapshot(resolvedAddressSnapshot) ? (
                    <div className="mt-3 space-y-2">
                      <p className="font-semibold text-slate-900">
                        {resolvedAddressSnapshot.recipientName || customer.name}
                        {resolvedAddressSnapshot.recipientPhone
                          ? ` • ${resolvedAddressSnapshot.recipientPhone}`
                          : ""}
                      </p>
                      <p className="whitespace-pre-line leading-relaxed text-slate-700">
                        {resolvedAddressText}
                      </p>
                      {resolvedAddressSnapshot.note && (
                        <p className="text-sm text-slate-500">
                          Ghi chú địa chỉ: {resolvedAddressSnapshot.note}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Chọn một địa chỉ đã lưu hoặc nhập địa chỉ mới để hệ thống
                      snapshot vào đơn hàng.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <p className="font-semibold text-slate-700">
                    {deliveryAddressLabel}
                  </p>
                  <p className="mt-2 leading-relaxed text-slate-600">
                    {resolvedAddressText || "Địa chỉ đầy đủ sẽ hiện ở đây sau khi bạn chọn hoặc nhập xong."}
                  </p>
                </div>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Ghi chú giao hàng / bàn giao
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
