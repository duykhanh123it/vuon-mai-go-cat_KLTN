import React, { useState, useEffect } from "react";
import { AuthUser } from "../types";
import { useToast } from "./Toast";
const API_URL = import.meta.env.VITE_PRODUCTS_API_BASE;
interface Props {
  user: AuthUser;
  onClose: () => void;
  onForgotPassword?: () => void;
}
const ChangePasswordModal: React.FC<Props> = ({
  user,
  onClose,
  onForgotPassword,
}) => {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"change_password" | "forgot_password">(
    "change_password",
  );
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const isGoogleUser = !user.hasPassword;
  useEffect(() => {
    if (!otpSent || otpCountdown <= 0) return;
    const timer = setTimeout(() => {
      setOtpCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [otpSent, otpCountdown]);
  const handleChangePassword = async () => {
    if (mode === "forgot_password") {
      if (!otp || !newPassword || !confirmNewPassword) {
        showToast("Nhập đầy đủ thông tin", "error");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showToast("Xác nhận mật khẩu không khớp", "error");
        return;
      }

      if (newPassword.length < 8) {
        showToast("Mật khẩu mới phải có ít nhất 8 ký tự", "error");
        return;
      }
      if (!/[A-Z]/.test(newPassword)) {
        showToast("Mật khẩu mới phải có ít nhất 1 chữ in hoa", "error");
        return;
      }
      if (!/[a-z]/.test(newPassword)) {
        showToast("Mật khẩu mới phải có ít nhất 1 chữ thường", "error");
        return;
      }
      if (!/[0-9]/.test(newPassword)) {
        showToast("Mật khẩu mới phải có ít nhất 1 chữ số", "error");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(newPassword)) {
        showToast("Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt", "error");
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
            api: "resetPasswordWithOtp",
            email: user.email,
            otp,
            newPassword,
          }),
        });
        const data = await res.json();

        if (!data.ok) {
          showToast(data.error || "Reset thất bại", "error");
          setLoading(false);
          return;
        }

        setLoading(false);
        showToast("Đổi mật khẩu thành công, vui lòng đăng nhập lại", "success");

        localStorage.removeItem("vmgc_user");
        sessionStorage.removeItem("vmgc_user");

        setOtp("");
        setNewPassword("");
        setConfirmNewPassword("");
        setCurrentPassword("");
        setOtpSent(false);
        onClose();

        setTimeout(() => {
          window.location.reload();
        }, 1200);

        return;
      } catch {
        showToast("Lỗi server", "error");
        setLoading(false);
      }
      return;
    }
    if (
      (!isGoogleUser && !currentPassword) ||
      !newPassword ||
      !confirmNewPassword
    ) {
      showToast("Vui lòng nhập đầy đủ thông tin", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast("Mật khẩu mới phải có ít nhất 8 ký tự", "error");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showToast("Mật khẩu mới phải có ít nhất 1 chữ in hoa", "error");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      showToast("Mật khẩu mới phải có ít nhất 1 chữ thường", "error");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showToast("Mật khẩu mới phải có ít nhất 1 chữ số", "error");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      showToast("Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt", "error");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast("Xác nhận mật khẩu không khớp", "error");
      return;
    }
    if (!isGoogleUser && newPassword === currentPassword) {
      showToast("Mật khẩu mới không được trùng mật khẩu cũ", "error");
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
          currentPassword: isGoogleUser ? "" : currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showToast(data.error || "Đổi mật khẩu thất bại", "error");
        setLoading(false);
        return;
      }
      setLoading(false);
      showToast("Đổi mật khẩu thành công, vui lòng đăng nhập lại", "success");
      localStorage.removeItem("vmgc_user");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch {
      showToast("Không thể kết nối server", "error");
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md max-h-[90vh] rounded-3xl bg-white px-5 py-4 shadow-2xl flex flex-col">
        <h2 className="text-xl font-bold mb-4 text-amber-900">
          {isGoogleUser ? "Thiết lập mật khẩu" : "Đổi mật khẩu"}
        </h2>
        <form
          className="space-y-4 overflow-y-auto pr-1 flex-1"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
        >
          <input
            type="text"
            name="fake_username"
            autoComplete="username"
            className="hidden"
            tabIndex={-1}
          />
          <input
            type="password"
            name="fake_password"
            autoComplete="current-password"
            className="hidden"
            tabIndex={-1}
          />

          {mode === "change_password" && (
            <>
              {!isGoogleUser && (
                <input
                  type="password"
                  name="current_password_modal"
                  autoComplete="current-password"
                  placeholder="Mật khẩu hiện tại"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base"
                />
              )}

              <input
                type="password"
                name="new_password_modal"
                autoComplete="new-password"
                placeholder="Mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base"
              />

              <input
                type="password"
                name="confirm_new_password_modal"
                autoComplete="new-password"
                placeholder="Xác nhận mật khẩu mới"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base"
              />
            </>
          )}

          {mode === "forgot_password" && (
            <>
              <input
                type="text"
                name="otp_code"
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="Nhập mã OTP 6 số"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-100 px-4"
              />

              <input
                type="password"
                name="new_password_modal"
                autoComplete="new-password"
                placeholder="Mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-100 px-4"
              />

              <input
                type="password"
                name="confirm_new_password_modal"
                autoComplete="new-password"
                placeholder="Xác nhận mật khẩu mới"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-100 px-4"
              />
            </>
          )}

          <div className="pt-1 text-right">
            {mode === "change_password" && !isGoogleUser && (
              <button
                type="button"
                onClick={async () => {
                  setMode("forgot_password");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setOtp("");
                  setOtpSent(false);

                  setLoading(true);

                  try {
                    const res = await fetch(API_URL, {
                      method: "POST",
                      headers: {
                        "Content-Type": "text/plain;charset=utf-8",
                      },
                      body: JSON.stringify({
                        api: "sendResetOtp",
                        email: user.email,
                      }),
                    });

                    const data = await res.json();

                    if (!data.ok) {
                      showToast(data.error || "Không gửi được OTP", "error");
                      setMode("change_password");
                      setLoading(false);
                      return;
                    }

                    setOtpSent(true);
                    setOtpCountdown(60);
                    showToast("Đã gửi mã OTP về email", "success");
                  } catch {
                    showToast("Lỗi gửi OTP", "error");
                    setMode("change_password");
                  }

                  setLoading(false);
                }}
                className="text-sm font-semibold text-amber-700 hover:underline"
              >
                Quên mật khẩu?
              </button>
            )}
          </div>
        </form>
        <div className="mt-6 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={handleChangePassword}
            className="w-full h-12 rounded-xl bg-amber-400 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Đang xử lý..." : "Đổi mật khẩu"}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ChangePasswordModal;
