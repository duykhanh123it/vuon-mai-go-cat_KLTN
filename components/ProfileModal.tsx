import React, { useEffect, useMemo, useState } from "react";
import {
  AuthUser,
  UserAddress,
  getLocationDisplayInfo,
  normalizeAuthUser,
  normalizeUserAddress,
  type LocationConfidence,
  type LocationSource,
} from "../types";
import {
  deleteAddressBookEntry,
  fetchAddressBook,
  saveAddressBookEntry,
  setDefaultAddressBookEntry,
} from "../utils/productsApi";
import { useToast } from "./Toast";
import MapPinPicker from "./MapPinPicker";
import { getProvinceSuggestions, getWardSuggestions } from "../utils/vnAdministrative";

const API_URL = import.meta.env.VITE_PRODUCTS_API_BASE;

interface ProfileModalProps {
  user: AuthUser;
  onClose: () => void;
  onUpdateUser: (user: AuthUser) => void;
  showPasswordSection?: boolean;
}

type AddressDraft = {
  id: string;
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
  isDefault: boolean;
};

const formatAddressText = (address: Partial<UserAddress>) =>
  [address.line1, address.ward, address.province]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");

const hasPinnedCoordinates = (
  value:
    | Pick<Partial<UserAddress>, "lat" | "lng">
    | Pick<AddressDraft, "lat" | "lng">,
) =>
  typeof value.lat === "number" &&
  Number.isFinite(value.lat) &&
  typeof value.lng === "number" &&
  Number.isFinite(value.lng);

const formatPinnedCoordinates = (
  value:
    | Pick<Partial<UserAddress>, "lat" | "lng">
    | Pick<AddressDraft, "lat" | "lng">,
) =>
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

const buildEmptyAddressDraft = (options?: {
  name?: string;
  phone?: string;
  isDefault?: boolean;
}): AddressDraft => ({
  id: "",
  label: "",
  recipientName: String(options?.name || "").trim(),
  recipientPhone: String(options?.phone || "").trim(),
  province: "",
  ward: "",
  line1: "",
  lat: null,
  lng: null,
  locationSource: "text_only",
  locationConfidence: "low",
  isDefault: Boolean(options?.isDefault),
});

const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  onClose,
  onUpdateUser,
  showPasswordSection = true,
}) => {
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [birthDate, setBirthDate] = useState(user.birthDate || "");
  const [gender, setGender] = useState(user.gender || "nam");
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);

  const [addressBook, setAddressBook] = useState<UserAddress[]>(
    Array.isArray(user.addressBook) ? user.addressBook : [],
  );
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressSaving, setAddressSaving] = useState(false);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(() =>
    buildEmptyAddressDraft({
      name: user.name,
      phone: user.phone,
      isDefault: !user.addressBook?.length,
    }),
  );

  const isGoogleUser = !user.hasPassword;
  const currentAvatar =
    previewAvatar || user.avatarUrl || "/no_avatar_fallback.png";
  const isUsingDefaultAvatar = !previewAvatar && !user.avatarUrl;
  const hasAddresses = addressBook.length > 0;

  const draftAddressText = useMemo(
    () => formatAddressText(addressDraft),
    [addressDraft],
  );
  const draftLocationInfo = useMemo(
    () => getLocationDisplayInfo(addressDraft),
    [addressDraft],
  );

  const provinceSuggestions = useMemo(
    () => getProvinceSuggestions(addressDraft.province, 12),
    [addressDraft.province],
  );

  const wardSuggestions = useMemo(
    () => getWardSuggestions(addressDraft.province, addressDraft.ward, 18),
    [addressDraft.province, addressDraft.ward],
  );

  const resetAddressForm = (options?: {
    nextAddresses?: UserAddress[];
    keepOpen?: boolean;
  }) => {
    const nextAddresses = Array.isArray(options?.nextAddresses)
      ? options?.nextAddresses
      : addressBook;
    setEditingAddressId(null);
    setIsMapPickerOpen(false);
    setIsAddressFormOpen(Boolean(options?.keepOpen));
    setAddressDraft(
      buildEmptyAddressDraft({
        name: fullName || user.name,
        phone: phone || user.phone,
        isDefault: !nextAddresses.length,
      }),
    );
  };

  const syncAddressBookToUser = (addresses: UserAddress[]) => {
    const normalizedAddresses = Array.isArray(addresses)
      ? addresses.map((item) => normalizeUserAddress(item))
      : [];

    setAddressBook(normalizedAddresses);
    onUpdateUser(
      normalizeAuthUser({
        ...user,
        addressBook: normalizedAddresses,
      }),
    );
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    const scrollBarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = scrollBarWidth + "px";
    }

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "getProfile",
            email: user.email,
          }),
        });
        const data = await res.json();
        if (!data.ok || cancelled) {
          setProfileLoading(false);
          return;
        }

        setFullName(data.user?.name || "");
        setPhone(data.user?.phone || "");
        setEmail(data.user?.email || user.email || "");
        setBirthDate(data.user?.birthDate || "");
        setGender(data.user?.gender || "nam");
        setProfileLoading(false);
      } catch {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  useEffect(() => {
    let cancelled = false;

    const loadAddressBook = async () => {
      try {
        setAddressLoading(true);
        const addresses = await fetchAddressBook();
        if (cancelled) return;
        syncAddressBookToUser(addresses);
      } catch (err) {
        if (!cancelled) {
          setAddressBook(
            Array.isArray(user.addressBook) ? user.addressBook : [],
          );
        }
      } finally {
        if (!cancelled) {
          setAddressLoading(false);
        }
      }
    };

    loadAddressBook();
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  useEffect(() => {
    if (isAddressFormOpen) return;

    setIsMapPickerOpen(false);
    setAddressDraft(
      buildEmptyAddressDraft({
        name: fullName || user.name,
        phone: phone || user.phone,
        isDefault: !addressBook.length,
      }),
    );
  }, [
    addressBook.length,
    fullName,
    isAddressFormOpen,
    phone,
    user.name,
    user.phone,
  ]);

  const handleSelectAvatar = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setPreviewAvatar(base64);
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "uploadAvatar",
            email: user.email,
            fileName: file.name,
            fileData: base64,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          showToast("Upload avatar thất bại", "error");
          setPreviewAvatar(null);
          return;
        }
        onUpdateUser(
          normalizeAuthUser({
            ...user,
            avatarUrl: data.avatarUrl,
          }),
        );
        setPreviewAvatar(null);
      } catch {
        showToast("Lỗi upload avatar", "error");
        setPreviewAvatar(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);
      const isChangingPassword = isGoogleUser
        ? !!newPassword || !!confirmPassword
        : !!currentPassword || !!newPassword || !!confirmPassword;

      if (isChangingPassword) {
        if (
          (!isGoogleUser && !currentPassword) ||
          !newPassword ||
          !confirmPassword
        ) {
          showToast(
            isGoogleUser
              ? "Thiếu thông tin thiết lập mật khẩu"
              : "Thiếu thông tin đổi mật khẩu",
            "error",
          );
          setSaving(false);
          return;
        }

        if (newPassword.length < 8) {
          showToast("Mật khẩu mới phải có ít nhất 8 ký tự", "error");
          setSaving(false);
          return;
        }

        if (!/[A-Z]/.test(newPassword)) {
          showToast("Mật khẩu mới phải có ít nhất 1 chữ in hoa", "error");
          setSaving(false);
          return;
        }

        if (!/[a-z]/.test(newPassword)) {
          showToast("Mật khẩu mới phải có ít nhất 1 chữ thường", "error");
          setSaving(false);
          return;
        }

        if (!/[0-9]/.test(newPassword)) {
          showToast("Mật khẩu mới phải có ít nhất 1 chữ số", "error");
          setSaving(false);
          return;
        }

        if (!/[^A-Za-z0-9]/.test(newPassword)) {
          showToast("Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt", "error");
          setSaving(false);
          return;
        }

        if (newPassword !== confirmPassword) {
          showToast("Xác nhận mật khẩu không khớp", "error");
          setSaving(false);
          return;
        }

        if (!isGoogleUser && newPassword === currentPassword) {
          showToast("Mật khẩu mới không được trùng mật khẩu cũ", "error");
          setSaving(false);
          return;
        }

        const resPass = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "changePassword",
            email: user.email,
            currentPassword: isGoogleUser ? "" : currentPassword,
            newPassword: newPassword,
          }),
        });
        const dataPass = await resPass.json();
        if (!dataPass.ok) {
          showToast(dataPass.error || "Đổi mật khẩu thất bại", "error");
          setSaving(false);
          return;
        }

        showToast(
          isGoogleUser
            ? "Thiết lập mật khẩu thành công, vui lòng đăng nhập lại"
            : "Đổi mật khẩu thành công, vui lòng đăng nhập lại",
          "success",
        );

        localStorage.removeItem("vmgc_user");
        localStorage.removeItem("vmgc_session_token");

        setTimeout(() => {
          window.location.reload();
        }, 1200);

        setSaving(false);
        return;
      }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          api: "updateProfile",
          email: user.email,
          name: fullName,
          phone: phone,
          birthDate: birthDate,
          gender: gender,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showToast(data.error || "Lỗi cập nhật", "error");
        setSaving(false);
        return;
      }
      onUpdateUser(
        normalizeAuthUser({
          ...user,
          ...data.user,
          addressBook,
          birthDate,
          gender,
        }),
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Cập nhật thành công", "success");
      setSaving(false);
      onClose();
    } catch {
      showToast("Không thể kết nối server", "error");
      setSaving(false);
    }
  };

  const handleOpenCreateAddress = () => {
    setEditingAddressId(null);
    setIsMapPickerOpen(false);
    setIsAddressFormOpen(true);
    setAddressDraft(
      buildEmptyAddressDraft({
        name: fullName || user.name,
        phone: phone || user.phone,
        isDefault: !hasAddresses,
      }),
    );
  };

  const handleEditAddress = (address: UserAddress) => {
    const normalized = normalizeUserAddress(address);
    setEditingAddressId(normalized.id);
    setIsAddressFormOpen(true);
    setIsMapPickerOpen(hasPinnedCoordinates(normalized));
    setAddressDraft({
      id: normalized.id,
      label: normalized.label,
      recipientName: normalized.recipientName,
      recipientPhone: normalized.recipientPhone,
      province: normalized.province,
      ward: normalized.ward,
      line1: normalized.line1,
      lat: normalized.lat ?? null,
      lng: normalized.lng ?? null,
      locationSource: normalized.locationSource || "text_only",
      locationConfidence: normalized.locationConfidence || "low",
      isDefault: normalized.isDefault,
    });
  };

  const handleSaveAddress = async () => {
    try {
      setAddressSaving(true);
      const nextAddresses = await saveAddressBookEntry({
        id: editingAddressId || undefined,
        label: addressDraft.label,
        recipientName: addressDraft.recipientName || fullName || user.name,
        recipientPhone: addressDraft.recipientPhone || phone || user.phone,
        province: addressDraft.province,
        ward: addressDraft.ward,
        line1: addressDraft.line1,
        lat: addressDraft.lat,
        lng: addressDraft.lng,
        locationSource: addressDraft.locationSource,
        locationConfidence: addressDraft.locationConfidence,
        isDefault: Boolean(addressDraft.isDefault),
      });

      syncAddressBookToUser(nextAddresses);
      showToast(
        editingAddressId ? "Đã cập nhật địa chỉ" : "Đã thêm địa chỉ mới",
        "success",
      );
      resetAddressForm({ nextAddresses });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Không thể lưu địa chỉ",
        "error",
      );
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (address: UserAddress) => {
    const confirmed = window.confirm(
      `Xóa địa chỉ "${address.label || formatAddressText(address)}"?`,
    );
    if (!confirmed) return;

    try {
      setAddressSaving(true);
      const nextAddresses = await deleteAddressBookEntry(address.id);
      syncAddressBookToUser(nextAddresses);
      showToast("Đã xóa địa chỉ", "success");

      if (editingAddressId === address.id) {
        resetAddressForm({ nextAddresses });
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Không thể xóa địa chỉ",
        "error",
      );
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefaultAddress = async (address: UserAddress) => {
    try {
      setAddressSaving(true);
      const nextAddresses = await setDefaultAddressBookEntry(address.id);
      syncAddressBookToUser(nextAddresses);
      showToast("Đã cập nhật địa chỉ mặc định", "success");

      if (editingAddressId === address.id) {
        setAddressDraft((prev) => ({
          ...prev,
          isDefault: true,
        }));
      }
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật địa chỉ mặc định",
        "error",
      );
    } finally {
      setAddressSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-3xl px-5 py-4 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white z-10 pb-4 flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hồ sơ"
            className="text-3xl leading-none text-slate-700 hover:text-slate-900"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold text-amber-900">
            Thông tin tài khoản
          </h2>
        </div>

        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32">
            <button
              type="button"
              onClick={() => setIsAvatarViewerOpen(true)}
              aria-label="Xem ảnh đại diện"
              className="block w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-md bg-slate-200 border-[3px] border-slate-300 cursor-zoom-in"
            >
              <img
                src={currentAvatar}
                alt="avatar"
                className={`w-full h-full object-cover ${
                  isUsingDefaultAvatar ? "opacity-70" : ""
                }`}
              />
            </button>
            <label
              htmlFor="avatarInput"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2 right-1.5 w-9 h-9 rounded-full bg-slate-700 text-white border-2 border-white shadow-md flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition"
              style={{
                transform: "translate(12%, 5%)",
              }}
            >
              <span className="text-[14px] leading-none">📷</span>
            </label>
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          id="avatarInput"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleSelectAvatar(file);
              e.target.value = "";
            }
          }}
        />

        <div className="space-y-5 overflow-y-auto pr-1 flex-1">
          <div>
            {profileLoading && (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                Đang tải thông tin tài khoản...
              </div>
            )}
            <label className="block text-sm md:text-base font-medium text-slate-800 mb-2">
              Người đăng ký/Người đại diện (*)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên"
              className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm md:text-base font-medium text-slate-800 mb-2">
              Số điện thoại (*)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
              className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm md:text-base font-medium text-slate-800 mb-2">
              Email (*)
            </label>
            <input
              type="email"
              value={email}
              disabled
              readOnly
              placeholder="Điền email"
              className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm md:text-base font-medium text-slate-800 mb-2">
                Ngày sinh
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm md:text-base font-medium text-slate-800 mb-2">
                Giới tính
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="nam">nam</option>
                <option value="nữ">nữ</option>
                <option value="khác">khác</option>
              </select>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  Sổ địa chỉ giao hàng
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Lưu nhiều địa chỉ để dùng nhanh cho các đơn tiếp theo.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateAddress}
                className="shrink-0 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200 transition"
              >
                + Thêm địa chỉ
              </button>
            </div>

            {addressLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Đang tải sổ địa chỉ...
              </div>
            ) : hasAddresses ? (
              <div className="space-y-3">
                {addressBook.map((address) => (
                  <div
                    key={address.id}
                    className={`rounded-2xl border px-4 py-4 ${
                      address.isDefault
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        {(() => {
                          const locationInfo = getLocationDisplayInfo(address);

                          return (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-semibold text-slate-900 break-words">
                                  {address.label || "Địa chỉ giao hàng"}
                                </h4>
                                {address.isDefault && (
                                  <span className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-950">
                                    Mặc định
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getLocationBadgeClassName(
                                    locationInfo.confidence,
                                  )}`}
                                >
                                  {locationInfo.icon} {locationInfo.sourceLabel}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200">
                                  {locationInfo.confidenceLabel}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mt-2">
                                {address.recipientName || fullName || "Người nhận"}
                                {address.recipientPhone
                                  ? ` • ${address.recipientPhone}`
                                  : ""}
                              </p>
                              <p className="text-sm leading-6 text-slate-600 mt-1 break-words">
                                {formatAddressText(address)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {locationInfo.helperText}
                              </p>
                              {hasPinnedCoordinates(address) && (
                                <p className="mt-1 text-xs font-medium text-slate-700">
                                  Tọa độ: {formatPinnedCoordinates(address)}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {!address.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultAddress(address)}
                            disabled={addressSaving}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            Mặc định
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditAddress(address)}
                          disabled={addressSaving}
                          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(address)}
                          disabled={addressSaving}
                          className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Bạn chưa lưu địa chỉ nào. Hãy thêm địa chỉ đầu tiên để dùng lại
                nhanh khi đặt đơn.
              </div>
            )}

            {isAddressFormOpen && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-slate-900">
                    {editingAddressId ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => resetAddressForm()}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700"
                  >
                    Hủy
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-800 mb-2">
                      Tên gợi nhớ địa chỉ (*)
                    </label>
                    <input
                      type="text"
                      value={addressDraft.label}
                      onChange={(e) =>
                        setAddressDraft((prev) => ({
                          ...prev,
                          label: e.target.value,
                        }))
                      }
                      placeholder="Ví dụ: Nhà riêng, Công ty, Điểm sự kiện"
                      className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-2">
                      Người nhận (*)
                    </label>
                    <input
                      type="text"
                      value={addressDraft.recipientName}
                      onChange={(e) =>
                        setAddressDraft((prev) => ({
                          ...prev,
                          recipientName: e.target.value,
                        }))
                      }
                      placeholder="Nhập tên người nhận"
                      className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-2">
                      Số điện thoại nhận hàng (*)
                    </label>
                    <input
                      type="text"
                      value={addressDraft.recipientPhone}
                      onChange={(e) =>
                        setAddressDraft((prev) => ({
                          ...prev,
                          recipientPhone: e.target.value,
                        }))
                      }
                      placeholder="Nhập số điện thoại"
                      className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-2">
                      Tỉnh / Thành phố trực thuộc Trung ương (*)
                    </label>
                    <input
                      type="text"
                      list="vmgc-profile-province-suggestions"
                      value={addressDraft.province}
                      onChange={(e) =>
                        setAddressDraft((prev) => ({
                          ...prev,
                          province: e.target.value,
                        }))
                      }
                      placeholder="Nhập Tỉnh / Thành phố"
                      className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-2">
                      Xã / Phường / Đặc khu (*)
                    </label>
                    <input
                      type="text"
                      list="vmgc-profile-ward-suggestions"
                      value={addressDraft.ward}
                      onChange={(e) =>
                        setAddressDraft((prev) => ({
                          ...prev,
                          ward: e.target.value,
                        }))
                      }
                      placeholder="Nhập Xã / Phường / Đặc khu"
                      className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-2 -mt-1 text-xs leading-relaxed text-slate-500">
                    Gõ gần đúng tên Tỉnh / Thành phố hoặc Xã / Phường để xem gợi ý.
                    Khi mở map, hệ thống sẽ tự focus nhanh hơn theo địa chỉ hành chính bạn đã nhập.
                  </div>

                  <datalist id="vmgc-profile-province-suggestions">
                    {provinceSuggestions.map((province) => (
                      <option key={province.code} value={province.fullName} />
                    ))}
                  </datalist>

                  <datalist id="vmgc-profile-ward-suggestions">
                    {wardSuggestions.map((ward) => (
                      <option key={ward.code} value={ward.fullName} />
                    ))}
                  </datalist>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-800 mb-2">
                      Số nhà + tên đường/thôn/xóm/ấp (*)
                    </label>
                    <textarea
                      value={addressDraft.line1}
                      onChange={(e) =>
                        setAddressDraft((prev) => ({
                          ...prev,
                          line1: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Ví dụ: 12A Nguyễn Trãi, Ấp 3"
                      className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 resize-y"
                    />
                  </div>

                  <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Ghim vị trí trên map (không bắt buộc)
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">
                          Khi có tọa độ, đơn hàng và admin sẽ mở đúng vị trí
                          trên map thay vì tìm theo text.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen((prev) => !prev)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        {isMapPickerOpen
                          ? "Ẩn bản đồ"
                          : hasPinnedCoordinates(addressDraft)
                            ? "Chỉnh lại vị trí"
                            : "Ghim vị trí"}
                      </button>
                    </div>

                    <div
                      className={`mt-3 rounded-xl border px-3 py-3 text-sm ${getLocationPanelClassName(
                        draftLocationInfo.confidence,
                      )}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {draftLocationInfo.icon} {draftLocationInfo.statusLabel}
                        </span>
                        <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {draftLocationInfo.sourceLabel}
                        </span>
                        <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {draftLocationInfo.confidenceLabel}
                        </span>
                      </div>
                      <p className="mt-2 leading-relaxed text-slate-600">
                        {draftLocationInfo.helperText}
                      </p>
                      {hasPinnedCoordinates(addressDraft) && (
                        <p className="mt-2 text-xs font-medium text-slate-700">
                          Tọa độ: {formatPinnedCoordinates(addressDraft)}
                        </p>
                      )}
                    </div>

                    {isMapPickerOpen && (
                      <div className="mt-4">
                        <MapPinPicker
                          lat={addressDraft.lat}
                          lng={addressDraft.lng}
                          locationSource={addressDraft.locationSource}
                          locationConfidence={addressDraft.locationConfidence}
                          province={addressDraft.province}
                          ward={addressDraft.ward}
                          onChange={({
                            lat,
                            lng,
                            locationSource,
                            locationConfidence,
                          }) =>
                            setAddressDraft((prev) => ({
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

                <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600 leading-6">
                  <div className="font-medium text-slate-800 mb-1">
                    Xem nhanh địa chỉ
                  </div>
                  {draftAddressText ||
                    "Địa chỉ đầy đủ sẽ hiện ở đây khi bạn nhập xong."}
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={addressDraft.isDefault}
                    onChange={(e) =>
                      setAddressDraft((prev) => ({
                        ...prev,
                        isDefault: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  Đặt làm địa chỉ mặc định
                </label>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => resetAddressForm()}
                    disabled={addressSaving}
                    className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAddress}
                    disabled={addressSaving}
                    className="h-11 rounded-xl bg-amber-400 px-4 text-sm font-bold text-amber-950 hover:bg-amber-500 disabled:opacity-60"
                  >
                    {addressSaving
                      ? "Đang lưu..."
                      : editingAddressId
                        ? "Lưu cập nhật"
                        : "Lưu địa chỉ"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {showPasswordSection && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              <h3 className="text-base font-semibold text-slate-800 mb-4">
                {isGoogleUser ? "Thiết lập mật khẩu" : "Đổi mật khẩu"}
              </h3>

              <div className="space-y-3">
                {!isGoogleUser && (
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mật khẩu hiện tại"
                    className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                  />
                )}

                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới"
                  className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                />

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={
                    isGoogleUser ? "Xác nhận mật khẩu mới" : "Xác nhận mật khẩu"
                  }
                  className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          )}

          <div className="mt-6 shrink-0 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={profileLoading || saving}
              className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 text-base font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {profileLoading
                ? "Đang tải..."
                : saving
                  ? "Đang cập nhật..."
                  : "Cập nhật"}
            </button>
          </div>
        </div>
      </div>

      {isAvatarViewerOpen && (
        <div
          className="fixed inset-0 z-[130] bg-black/80 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsAvatarViewerOpen(false)}
        >
          <button
            type="button"
            aria-label="Đóng xem ảnh"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl leading-none flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setIsAvatarViewerOpen(false);
            }}
          >
            ✕
          </button>
          <img
            src={currentAvatar}
            alt="avatar full"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ProfileModal;
