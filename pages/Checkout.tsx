import React, { useEffect, useMemo, useState } from "react";
import {
  formatOrderAddressSnapshot,
  getLocationDisplayInfo,
  getOrderAddressSnapshotSourceLabel,
  hasOrderAddressSnapshot,
  normalizeOrderAddressSnapshot,
} from "../types";
import type {
  AuthUser,
  CartItem,
  LocationConfidence,
  LocationSource,
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
import MapPinPicker from "../components/MapPinPicker";
import SearchableCombobox, {
  type ComboboxOption,
} from "../components/SearchableCombobox";
import {
  findProvinceMatch,
  getProvinceSuggestions,
  getWardSuggestions,
} from "../utils/vnAdministrative";
import {
  getUserOrdersCacheScope,
  putOrdersInteractionDetail,
} from "../utils/ordersInteractionCache";
import {
  SHOP_POLICY_VERSION,
  buildPolicyHref,
  getMinimumRentalDeposit,
  getPolicyAgreementLabel,
} from "../utils/policy";

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
  lat: number | null;
  lng: number | null;
  locationSource: LocationSource;
  locationConfidence: LocationConfidence;
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
  lat: null,
  lng: null,
  locationSource: "text_only",
  locationConfidence: "low",
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
    lat: address.lat ?? null,
    lng: address.lng ?? null,
    locationSource: address.locationSource,
    locationConfidence: address.locationConfidence,
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
    lat: manualAddress.lat ?? null,
    lng: manualAddress.lng ?? null,
    locationSource: manualAddress.locationSource,
    locationConfidence: manualAddress.locationConfidence,
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

const hasPinnedCoordinates = (value: {
  lat?: number | null;
  lng?: number | null;
}) =>
  typeof value.lat === "number" &&
  Number.isFinite(value.lat) &&
  typeof value.lng === "number" &&
  Number.isFinite(value.lng);

const formatPinnedCoordinates = (value: {
  lat?: number | null;
  lng?: number | null;
}) =>
  hasPinnedCoordinates(value)
    ? `${value.lat!.toFixed(6)}, ${value.lng!.toFixed(6)}`
    : "";

const getLocationBadgeClassName = (confidence: "high" | "medium" | "low") => {
  if (confidence === "high") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (confidence === "medium") {
    return "bg-sky-100 text-sky-800";
  }
  return "bg-slate-200 text-slate-700";
};

const getLocationPanelClassName = (confidence: "high" | "medium" | "low") => {
  if (confidence === "high") {
    return "border-emerald-200 bg-emerald-50";
  }
  if (confidence === "medium") {
    return "border-sky-200 bg-sky-50";
  }
  return "border-slate-200 bg-slate-50";
};

const toComboboxOptions = <T extends { code: string; fullName: string; type?: string }>(
  items: T[],
): ComboboxOption[] =>
  items.map((item) => ({
    key: item.code,
    value: item.fullName,
    label: item.fullName,
    description: item.type,
  }));

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
  const [isManualMapPickerOpen, setIsManualMapPickerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

  const mode = useMemo(() => getCartMode(items), [items]);
  const totalAmount = useMemo(() => getCartTotal(items), [items]);
  const policyDetailHref = useMemo(
    () => buildPolicyHref(mode === "rent" ? "rent" : "buy"),
    [mode],
  );
  const minimumRentalDeposit = useMemo(
    () => (mode === "rent" ? getMinimumRentalDeposit(totalAmount) : 0),
    [mode, totalAmount],
  );

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
      recipientName:
        prev.recipientName || customer.name || authUser?.name || "",
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
  const manualLocationInfo = useMemo(
    () => getLocationDisplayInfo(manualAddress),
    [manualAddress],
  );
  const resolvedLocationInfo = useMemo(
    () => getLocationDisplayInfo(resolvedAddressSnapshot),
    [resolvedAddressSnapshot],
  );
  const matchedProvince = useMemo(
    () => findProvinceMatch(manualAddress.province),
    [manualAddress.province],
  );

  const manualProvinceBrowseOptions = useMemo(
    () => toComboboxOptions(getProvinceSuggestions("", 40)),
    [],
  );

  const manualProvinceFilteredOptions = useMemo(
    () => toComboboxOptions(getProvinceSuggestions(manualAddress.province, 40)),
    [manualAddress.province],
  );

  const manualWardBrowseOptions = useMemo(() => {
    if (!matchedProvince) return [];
    return toComboboxOptions(getWardSuggestions(matchedProvince.fullName, "", 120));
  }, [matchedProvince]);

  const manualWardFilteredOptions = useMemo(() => {
    if (!matchedProvince) return [];
    return toComboboxOptions(
      getWardSuggestions(matchedProvince.fullName, manualAddress.ward, 120),
    );
  }, [manualAddress.ward, matchedProvince]);

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
      showToast(
        "Vui lòng chọn một địa chỉ đã lưu hoặc chuyển sang nhập mới.",
        "error",
      );
      return;
    }

    const addressError = validateAddressSnapshot(resolvedAddressSnapshot);
    if (addressError) {
      showToast(addressError, "error");
      return;
    }

    if (!mode) {
      showToast("Không xác định được loại giao dịch của đơn hàng.", "error");
      return;
    }

    if (!agreedToPolicy) {
      showToast("Bạn cần đọc và đồng ý Chính Sách Thuê & Mua trước khi tạo đơn.", "error");
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
        policyAcceptance: {
          accepted: true,
          version: SHOP_POLICY_VERSION,
          acceptedAt: new Date().toISOString(),
          scope: mode,
          source: "checkout",
        },
      });
      const normalizedCustomerEmail = customer.email.trim().toLowerCase();
      if (response.detail && normalizedCustomerEmail) {
        putOrdersInteractionDetail(
          getUserOrdersCacheScope(normalizedCustomerEmail),
          response.detail,
          {
            selectedOrderId: response.orderId,
            dataVersion: response.dataVersion,
          },
        );
      }
      onOrderCreated(response.orderId, normalizedCustomerEmail);
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
              Đơn được tạo ở trạng thái <strong>new</strong>. Cây chỉ được giữ
              khi admin xác nhận.
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
                Đơn hàng sẽ gắn với email tài khoản hiện tại.
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
                  Dùng email này để tra cứu đơn hàng về sau.
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Thông tin giao / bàn giao cây
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Địa chỉ này sẽ được lưu cố định theo đơn.
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
                          const isActive =
                            address.id === selectedSavedAddress?.id;
                          const addressText =
                            formatOrderAddressSnapshot(address);
                          const locationInfo = getLocationDisplayInfo(address);

                          return (
                            <button
                              key={address.id}
                              type="button"
                              onClick={() =>
                                setSelectedSavedAddressId(address.id)
                              }
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
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLocationBadgeClassName(
                                    locationInfo.confidence,
                                  )}`}
                                >
                                  {locationInfo.icon} {locationInfo.sourceLabel}
                                </span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                                  {locationInfo.confidenceLabel}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {address.recipientName ||
                                  customer.name ||
                                  "Người nhận"}
                                {address.recipientPhone
                                  ? ` • ${address.recipientPhone}`
                                  : ""}
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                {addressText || "Chưa đủ địa chỉ"}
                              </p>
                              {hasPinnedCoordinates(address) && (
                                <p className="mt-1 text-xs font-medium text-slate-700">
                                  Tọa độ: {formatPinnedCoordinates(address)}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Chưa có địa chỉ đã lưu. Bạn có thể nhập nhanh ngay bên dưới.
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
                      <SearchableCombobox
                        value={manualAddress.province}
                        onChange={(nextValue) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            province: nextValue,
                            ward: nextValue.trim() ? prev.ward : "",
                          }))
                        }
                        onSelect={(option) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            province: option.value,
                            ward:
                              prev.province.trim().toLowerCase() ===
                              option.value.trim().toLowerCase()
                                ? prev.ward
                                : "",
                          }))
                        }
                        allOptions={manualProvinceBrowseOptions}
                        filteredOptions={manualProvinceFilteredOptions}
                        placeholder="Chọn hoặc gõ để lọc tỉnh / thành"
                        emptyText="Không tìm thấy tỉnh / thành phù hợp."
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Xã / Phường / Đặc khu
                      </span>
                      <SearchableCombobox
                        value={manualAddress.ward}
                        onChange={(nextValue) =>
                          setManualAddress((prev) => ({
                            ...prev,
                            ward: nextValue,
                          }))
                        }
                        allOptions={manualWardBrowseOptions}
                        filteredOptions={manualWardFilteredOptions}
                        placeholder={
                          matchedProvince
                            ? "Chọn hoặc gõ để lọc xã / phường"
                            : "Chọn tỉnh / thành trước"
                        }
                        emptyText={
                          matchedProvince
                            ? "Không tìm thấy xã / phường phù hợp."
                            : "Chọn đúng tỉnh / thành trước để xem danh sách xã / phường."
                        }
                        disabled={!matchedProvince}
                      />
                    </label>
                    <div className="sm:col-span-2 -mt-1 text-xs text-slate-500">
                      Click để mở danh sách, hoặc gõ để lọc nhanh.
                    </div>

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

                    <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Ghim map (không bắt buộc)
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Có tọa độ thì admin mở đúng điểm giao hơn.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setIsManualMapPickerOpen((prev) => !prev)
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          {isManualMapPickerOpen
                            ? "Ẩn map"
                            : hasPinnedCoordinates(manualAddress)
                              ? "Xem / sửa map"
                              : "Mở map"}
                        </button>
                      </div>

                      {!isManualMapPickerOpen && (
                        <div
                          className={`mt-3 rounded-xl border px-3 py-3 text-sm ${getLocationPanelClassName(
                            manualLocationInfo.confidence,
                          )}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {manualLocationInfo.icon} {manualLocationInfo.statusLabel}
                            </span>
                            <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {manualLocationInfo.sourceLabel}
                            </span>
                            <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {manualLocationInfo.confidenceLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-600">
                            {hasPinnedCoordinates(manualAddress)
                              ? `Tọa độ: ${formatPinnedCoordinates(manualAddress)}`
                              : "Bạn có thể bỏ qua bước này và lưu bằng địa chỉ text."}
                          </p>
                        </div>
                      )}

                      {isManualMapPickerOpen && (
                        <div className="mt-4">
                          <MapPinPicker
                            lat={manualAddress.lat}
                            lng={manualAddress.lng}
                            locationSource={manualAddress.locationSource}
                            locationConfidence={manualAddress.locationConfidence}
                            province={manualAddress.province}
                            ward={manualAddress.ward}
                            onChange={({
                              lat,
                              lng,
                              locationSource,
                              locationConfidence,
                            }) =>
                              setManualAddress((prev) => ({
                                ...prev,
                                lat,
                                lng,
                                locationSource,
                                locationConfidence,
                              }))
                            }
                            mapHeightClassName="h-72"
                          />
                        </div>
                      )}
                    </div>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLocationBadgeClassName(
                            resolvedLocationInfo.confidence,
                          )}`}
                        >
                          {resolvedLocationInfo.icon} {resolvedLocationInfo.sourceLabel}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {resolvedLocationInfo.confidenceLabel}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {resolvedAddressSnapshot.recipientName || customer.name}
                        {resolvedAddressSnapshot.recipientPhone
                          ? ` • ${resolvedAddressSnapshot.recipientPhone}`
                          : ""}
                      </p>
                      <p className="whitespace-pre-line leading-relaxed text-slate-700">
                        {resolvedAddressText}
                      </p>
                      {hasPinnedCoordinates(resolvedAddressSnapshot) && (
                        <p className="text-xs font-medium text-slate-600">
                          Tọa độ: {formatPinnedCoordinates(resolvedAddressSnapshot)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Chọn địa chỉ để xem phần snapshot của đơn.
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
                    {resolvedAddressText ||
                      "Địa chỉ đầy đủ sẽ hiện ở đây sau khi bạn chọn hoặc nhập xong."}
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

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
              <p className="text-sm font-bold text-amber-950">Chính sách áp dụng cho đơn {mode === "rent" ? "thuê" : "mua"}</p>
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                {mode === "rent"
                  ? `Giá thuê niêm yết áp dụng cho 1 chu kỳ 5 - 10 ngày. Đơn chỉ được giữ khi admin xác nhận và đã thu tối thiểu ${formatCurrencyVnd(minimumRentalDeposit)} tiền cọc.`
                  : "Đơn mua được tạo ở trạng thái new. Cây chỉ được giữ khi admin xác nhận và chỉ hoàn tất khi giao xong, thanh toán đủ."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={policyDetailHref} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">Đọc chính sách chi tiết ↗</a>
                <a href={buildPolicyHref()} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100">Xem trang chính sách ↗</a>
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
                <input type="checkbox" checked={agreedToPolicy} onChange={(e) => setAgreedToPolicy(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-400" />
                <span>{getPolicyAgreementLabel(mode === "rent" ? "rent" : "buy")}</span>
              </label>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Đơn tạo xong ở trạng thái <strong>new</strong>. Admin xác nhận thì
              cây mới được giữ chỗ.
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
