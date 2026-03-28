import React, { useState } from "react";
import { AuthUser } from "../types";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyWjdVL_xW3h1ViUc7yUwe4AT6leoCH_fMF_DvZsHns16m0T5OLh_mS2slxPROdnbvH/exec";

interface Props {
  user: AuthUser;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<Props> = ({ user, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    // ✅ validate password mạnh hơn
    if (newPassword.length < 6) {
      alert("Mật khẩu mới phải ít nhất 6 ký tự");
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      alert("Mật khẩu phải có ít nhất 1 chữ hoa và 1 số");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert("Xác nhận mật khẩu không khớp");
      return;
    }

    // ✅ chặn trùng mật khẩu cũ
    if (newPassword === currentPassword) {
      alert("Mật khẩu mới không được trùng mật khẩu cũ");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          api: "changePassword",
          email: user.email,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || "Đổi mật khẩu thất bại");
        setLoading(false);
        return;
      }

      alert("Đổi mật khẩu thành công, vui lòng đăng nhập lại");
      setLoading(false);

      // ✅ xoá user local
      localStorage.removeItem("authUser");

      // reload để reset toàn bộ state
      window.location.reload();
    } catch {
      alert("Không thể kết nối server");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-amber-900">Đổi mật khẩu</h2>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Mật khẩu hiện tại"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full h-12 rounded-xl bg-slate-100 px-4"
          />

          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-12 rounded-xl bg-slate-100 px-4"
          />

          <input
            type="password"
            placeholder="Xác nhận mật khẩu mới"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="w-full h-12 rounded-xl bg-slate-100 px-4"
          />
        </div>

        <button
          onClick={handleChangePassword}
          disabled={loading}
          className="mt-6 w-full h-12 rounded-xl bg-amber-400 font-bold"
        >
          {loading ? "Đang xử lý..." : "Đổi mật khẩu"}
        </button>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
