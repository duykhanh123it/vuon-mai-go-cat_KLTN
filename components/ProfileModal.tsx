import React, { useEffect, useState } from "react";
import { AuthUser } from "../types";
import { useToast } from "./Toast";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyWjdVL_xW3h1ViUc7yUwe4AT6leoCH_fMF_DvZsHns16m0T5OLh_mS2slxPROdnbvH/exec";

interface ProfileModalProps {
  user: AuthUser;
  onClose: () => void;
  onUpdateUser: (user: AuthUser) => void;
  showPasswordSection?: boolean; // 👈 THÊM
}

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
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("nam");

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const currentAvatar =
    previewAvatar || user.avatarUrl || "/no_avatar_fallback.png";
  const isUsingDefaultAvatar = !previewAvatar && !user.avatarUrl;

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
      } catch (err) {
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

  const handleSelectAvatar = async (file: File) => {
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64 = reader.result as string;

      // preview ngay
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

        // update UI + local
        onUpdateUser({
          ...user,
          avatarUrl: data.avatarUrl,
        });

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

      // ✅ VALIDATE PASSWORD
      if (newPassword || confirmPassword || currentPassword) {
        if (!currentPassword) {
          showToast("Vui lòng nhập mật khẩu hiện tại", "error");
          setSaving(false);
          return;
        }

        if (newPassword.length < 6) {
          showToast("Mật khẩu mới tối thiểu 6 ký tự", "error");
          setSaving(false);
          return;
        }

        if (newPassword !== confirmPassword) {
          showToast("Xác nhận mật khẩu không khớp", "error");
          setSaving(false);
          return;
        }

        // 🔐 CALL API đổi mật khẩu
        const resPass = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "changePassword",
            email: user.email,
            oldPassword: currentPassword,
            newPassword: newPassword,
          }),
        });

        const dataPass = await resPass.json();

        if (!dataPass.ok) {
          showToast(dataPass.error || "Đổi mật khẩu thất bại", "error");
          setSaving(false);
          return;
        }
      }

      // 📌 UPDATE PROFILE
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

      onUpdateUser(data.user);

      // reset password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      showToast("Cập nhật thành công", "success");
      setSaving(false);
      onClose();
    } catch (err) {
      showToast("Không thể kết nối server", "error");
      setSaving(false);
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
            {/* Avatar */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-md bg-slate-200 border-[3px] border-slate-300">
              <img
                src={currentAvatar}
                alt="avatar"
                className={`w-full h-full object-cover ${
                  isUsingDefaultAvatar ? "opacity-70" : ""
                }`}
              />
            </div>

            {/* Nút camera góc phải dưới: luôn là nơi bấm đổi ảnh */}
            <label
              htmlFor="avatarInput"
              className="
    absolute 
    bottom-2 right-1.5
    w-9 h-9
    rounded-full
    bg-slate-700 text-white
    border-2 border-white
    shadow-md
    flex items-center justify-center
    cursor-pointer
    hover:scale-105 active:scale-95
    transition
  "
              style={{
                transform: "translate(12%, 5%)",
              }}
            >
              <span className="text-[14px] leading-none">📷</span>
            </label>
          </div>
        </div>

        {/* Input file ẩn */}
        <input
          type="file"
          accept="image/*"
          id="avatarInput"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleSelectAvatar(file);
              e.target.value = ""; // 🔥 reset để chọn lại cùng ảnh vẫn chạy
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
              onChange={(e) => setEmail(e.target.value)}
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

          {/* SECTION ĐỔI MẬT KHẨU */}
          {showPasswordSection && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              <h3 className="text-base font-semibold text-slate-800 mb-4">
                Đổi mật khẩu
              </h3>

              <div className="space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mật khẩu hiện tại"
                  className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                />

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
                  placeholder="Xác nhận mật khẩu"
                  className="w-full h-11 rounded-xl bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          )}

          <div className="mt-6 shrink-0">
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
    </div>
  );
};

export default ProfileModal;
