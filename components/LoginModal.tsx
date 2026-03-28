import React, { useEffect, useState } from "react";

import { AuthUser } from "../types";
const API_URL =
  "https://script.google.com/macros/s/AKfycbyWjdVL_xW3h1ViUc7yUwe4AT6leoCH_fMF_DvZsHns16m0T5OLh_mS2slxPROdnbvH/exec";

interface LoginModalProps {
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLogin }) => {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ESC để đóng modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);

    const scrollBarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    // ✅ CHỈ áp dụng padding nếu có scrollbar (desktop)
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
    if (!otpSent || otpCountdown <= 0) return;

    const timer = window.setTimeout(() => {
      setOtpCountdown((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpSent, otpCountdown]);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu");
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu");
      setLoading(false);
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Vui lòng nhập họ tên");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Mật khẩu xác nhận không khớp");
        setLoading(false);
        return;
      }
    }

    try {
      if (mode === "login") {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "login",
            email,
            password,
          }),
        });

        const data = await res.json();

        if (!data.ok) {
          setError(data.error || "Có lỗi xảy ra");
          setLoading(false);
          return;
        }

        onLogin(data.user);
        setLoading(false);
        return;
      }

      // register - bước 1: gửi OTP
      if (!otpSent) {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "sendOtp",
            email,
          }),
        });

        const data = await res.json();

        if (!data.ok) {
          setError(data.error || "Không gửi được OTP");
          setLoading(false);
          return;
        }

        setOtpSent(true);
        setOtpCountdown(60);
        setLoading(false);
        return;
      }

      // register - bước 2: verify OTP
      if (!otp.trim()) {
        setError("Vui lòng nhập mã OTP");
        setLoading(false);
        return;
      }

      const verifyRes = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          api: "verifyOtp",
          email,
          otp,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.ok) {
        setError(verifyData.error || "OTP không hợp lệ");
        setLoading(false);
        return;
      }

      const registerRes = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          api: "register",
          email,
          password,
          name,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerData.ok) {
        setError(registerData.error || "Đăng ký thất bại");
        setLoading(false);
        return;
      }

      onLogin(registerData.user);
      setLoading(false);
    } catch (err: any) {
      setError("Không thể kết nối server");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="
          relative z-10
          w-[90%] max-w-md
          bg-white rounded-2xl
          p-6 md:p-8
          shadow-2xl
          animate-fadeIn
        "
      >
        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-amber-900 mb-4">
          {mode === "login" ? "ĐĂNG NHẬP" : "ĐĂNG KÝ"}
        </h2>

        {/* Description */}
        <p className="text-sm md:text-base text-slate-600 text-center mb-6">
          {mode === "login"
            ? "Quý khách vui lòng đăng nhập để đặt hàng"
            : "Tạo tài khoản để đặt hàng nhanh hơn"}
        </p>

        {/* Name (register only) */}
        {mode === "register" && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-slate-700">
              Họ và tên (*)
            </label>
            <input
              type="text"
              placeholder="Nhập họ tên..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            />
          </div>
        )}

        {/* Phone */}
        {/* Email */}
        {/* Email */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-slate-700">
            Email (*)
          </label>
          <input
            type="email"
            placeholder="Nhập email..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-slate-700">
            Mật khẩu (*)
          </label>
          <input
            type="password"
            placeholder="Nhập mật khẩu..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
          />
        </div>

        {/* Confirm Password (register only) */}
        {mode === "register" && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-slate-700">
              Xác nhận mật khẩu (*)
            </label>
            <input
              type="password"
              placeholder="Nhập lại mật khẩu..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            />
          </div>
        )}

        {mode === "register" && otpSent && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-slate-700">
              Mã OTP (*)
            </label>
            <input
              type="text"
              placeholder="Nhập mã OTP gồm 6 số..."
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            />

            <div className="mt-3 text-center">
              {otpCountdown > 0 ? (
                <span className="text-sm text-slate-500">
                  Gửi lại OTP sau {otpCountdown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setError("");
                    setLoading(true);

                    try {
                      const res = await fetch(API_URL, {
                        method: "POST",
                        headers: {
                          "Content-Type": "text/plain;charset=utf-8",
                        },
                        body: JSON.stringify({
                          api: "sendOtp",
                          email,
                        }),
                      });

                      const data = await res.json();

                      if (!data.ok) {
                        setError(data.error || "Không gửi lại được OTP");
                        setLoading(false);
                        return;
                      }

                      setOtp("");
                      setOtpCountdown(60);
                      setLoading(false);
                    } catch (err) {
                      setError("Không thể kết nối server");
                      setLoading(false);
                    }
                  }}
                  className="text-sm font-semibold text-amber-600 hover:underline"
                >
                  Gửi lại mã OTP
                </button>
              )}
            </div>
          </div>
        )}

        {/* Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-full font-bold text-base text-black bg-amber-400 hover:bg-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading
            ? "Đang xử lý..."
            : mode === "login"
              ? "Đăng nhập"
              : otpSent
                ? "Xác nhận OTP"
                : "Gửi mã OTP"}
        </button>
        {error && (
          <p className="text-red-600 text-sm text-center mb-3">{error}</p>
        )}
        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-300" />
          <span className="text-xs text-slate-400">hoặc</span>
          <div className="flex-1 h-px bg-slate-300" />
        </div>

        <button
          type="button"
          className="
        w-full
        py-3
        rounded-full
        border border-slate-300
        flex items-center justify-center gap-2
        text-sm font-medium
        hover:bg-slate-100
        transition
    "
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="google"
            className="w-5 h-5"
          />
          Tiếp tục với Google
        </button>

        <div className="mt-4 text-center text-sm">
          {mode === "login" ? (
            <>
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-amber-600 font-semibold hover:underline"
              >
                Đăng ký
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-amber-600 font-semibold hover:underline"
              >
                Đăng nhập
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
