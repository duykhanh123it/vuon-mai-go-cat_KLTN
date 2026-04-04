import React, { useEffect, useState } from "react";
import { AuthUser } from "../types";
import { useToast } from "./Toast";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyWjdVL_xW3h1ViUc7yUwe4AT6leoCH_fMF_DvZsHns16m0T5OLh_mS2slxPROdnbvH/exec";

interface ProfileModalProps {
  user: AuthUser;
  onClose: () => void;
  onUpdateUser: (user: AuthUser) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  onClose,
  onUpdateUser,
}) => {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("nam");

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleUpdate = async () => {
    try {
      setSaving(true);

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
      showToast("Cập nhật thành công", "success");
      setSaving(false);
      onClose();
    } catch (err) {
      showToast("Không thể kết nối server", "error");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl max-h-[90vh] rounded-3xl bg-white px-8 py-6 shadow-2xl flex flex-col">
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
          <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center text-5xl text-slate-400">
            🖼️
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto pr-2">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

          {/* Đã tách đổi mật khẩu sang modal riêng */}

          <div className="sticky bottom-0 bg-white pt-4">
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
