import React, { useEffect, useRef, useState } from "react";

import { AuthUser, normalizeAuthUser } from "../types";
const API_URL = import.meta.env.VITE_PRODUCTS_API_BASE;

interface LoginModalProps {
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
  initialMode?: "login" | "register" | "forgot_password";
}

const LoginModal: React.FC<LoginModalProps> = ({
  onClose,
  onLogin,
  initialMode,
}) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot_password">(
    initialMode || "login",
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // === Validate realtime ===
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    otp: "",
  });

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    newPassword: false,
    confirmNewPassword: false,
    otp: false,
  });

  const formBodyRef = useRef<HTMLDivElement | null>(null);
  const otpSectionRef = useRef<HTMLDivElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Password rules
  const passwordRules = {
    minLength: 8,
    hasUppercase: /[A-Z]/,
    hasLowercase: /[a-z]/,
    hasNumber: /\d/,
    hasSpecial: /[^A-Za-z0-9]/,
  };

  // Validate functions
  const validateEmail = (value: string) => {
    if (!value.trim()) return "Vui lòng nhập email";
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return ok ? "" : "Email không đúng định dạng";
  };

  const validateName = (value: string) => {
    if (!value.trim()) return "Vui lòng nhập họ tên";
    if (value.trim().length < 2) return "Họ tên quá ngắn";
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) return "Vui lòng nhập mật khẩu";
    if (value.length < passwordRules.minLength) {
      return "Mật khẩu phải có ít nhất 8 ký tự";
    }
    if (!passwordRules.hasUppercase.test(value)) {
      return "Mật khẩu phải có ít nhất 1 chữ in hoa";
    }
    if (!passwordRules.hasLowercase.test(value)) {
      return "Mật khẩu phải có ít nhất 1 chữ thường";
    }
    if (!passwordRules.hasNumber.test(value)) {
      return "Mật khẩu phải có ít nhất 1 chữ số";
    }
    if (!passwordRules.hasSpecial.test(value)) {
      return "Mật khẩu phải có ít nhất 1 ký tự đặc biệt";
    }
    return "";
  };

  const validateConfirmPassword = (value: string, pwd: string) => {
    if (!value.trim()) return "Vui lòng xác nhận mật khẩu";
    return value === pwd ? "" : "Mật khẩu xác nhận không khớp";
  };

  const validateConfirmNewPassword = (value: string, pwd: string) => {
    if (!value.trim()) return "Vui lòng xác nhận mật khẩu mới";
    return value === pwd ? "" : "Mật khẩu xác nhận không khớp";
  };

  const validateOtp = (value: string) => {
    if (!value.trim()) return "Vui lòng nhập mã OTP";
    return /^\d{6}$/.test(value) ? "" : "Mã OTP phải gồm đúng 6 chữ số";
  };

  // ESC để đóng modal
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

  // SYNC mode khi initialMode thay đổi (mở lại modal với mode khác)
  useEffect(() => {
    if (initialMode) {
      resetFormState();
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (!otpSent || otpCountdown <= 0) return;

    const timer = window.setTimeout(() => {
      setOtpCountdown((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpSent, otpCountdown]);

  // ✅ Function lấy thông tin user từ Google qua access token
  async function fetchGoogleUserInfo(accessToken: string) {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      throw new Error("Không lấy được thông tin người dùng từ Google");
    }
    return await res.json();
  }

  const resetOtpFlow = () => {
    setOtpSent(false);
    setOtp("");
    setOtpCountdown(60);
    setError("");
    setFieldErrors((prev) => ({ ...prev, otp: "" }));
    setTouched((prev) => ({ ...prev, otp: false }));
  };

  const scrollToOtpSection = () => {
    requestAnimationFrame(() => {
      otpSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 250);
    });
  };

  const resetFormState = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setName("");
    setOtp("");
    setOtpSent(false);
    setOtpCountdown(60);
    setError("");
    setLoading(false);
    setLoadingText("");
    setFieldErrors({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      newPassword: "",
      confirmNewPassword: "",
      otp: "",
    });
    setTouched({
      name: false,
      email: false,
      password: false,
      confirmPassword: false,
      newPassword: false,
      confirmNewPassword: false,
      otp: false,
    });
  };

  // Validate toàn bộ trước khi submit
  const validateBeforeSubmit = () => {
    const nextErrors = {
      name: mode === "register" ? validateName(name) : "",
      email: validateEmail(email),
      password:
        mode === "register"
          ? validatePassword(password)
          : mode === "login"
            ? !password.trim()
              ? "Vui lòng nhập mật khẩu"
              : ""
            : "",
      confirmPassword:
        mode === "register"
          ? validateConfirmPassword(confirmPassword, password)
          : "",
      newPassword:
        mode === "forgot_password" && otpSent
          ? validatePassword(newPassword)
          : "",
      confirmNewPassword:
        mode === "forgot_password" && otpSent
          ? validateConfirmNewPassword(confirmNewPassword, newPassword)
          : "",
      otp:
        (mode === "register" || mode === "forgot_password") && otpSent
          ? validateOtp(otp)
          : "",
    };

    setFieldErrors(nextErrors);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      newPassword: true,
      confirmNewPassword: true,
      otp: true,
    });

    const hasErrors = Object.values(nextErrors).some(Boolean);
    return !hasErrors;
  };

  const handleSubmit = async () => {
    setError("");

    if (!validateBeforeSubmit()) {
      return;
    }

    try {
      if (mode === "login") {
        setLoading(true);
        setLoadingText("Đang đăng nhập...");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

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
          signal: controller.signal,
        });

        clearTimeout(timeout);

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Server không trả JSON hợp lệ");
        }

        if (!data.ok) {
          setError(data.error || "Có lỗi xảy ra");
          setLoading(false);
          setLoadingText("");
          return;
        }

        onLogin(normalizeAuthUser(data.user));
        setLoading(false);
        setLoadingText("");
        return;
      }

      if (mode === "register") {
        if (!otpSent) {
          setLoading(true);
          setLoadingText("Đang gửi mã OTP...");

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

          let data;
          try {
            data = await res.json();
          } catch {
            throw new Error("Server không trả JSON hợp lệ");
          }

          if (!data.ok) {
            setError(data.error || "Không gửi được OTP");
            setLoading(false);
            setLoadingText("");
            return;
          }

          setOtpSent(true);
          setOtpCountdown(60);
          scrollToOtpSection();

          setLoading(false);
          setLoadingText("");
          return;
        }

        setLoading(true);
        setLoadingText("Đang xác nhận OTP...");

        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "registerWithOtp",
            email,
            password,
            name,
            otp,
          }),
        });

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Server không trả JSON hợp lệ");
        }

        if (!data.ok) {
          setError(data.error || "Đăng ký thất bại");
          setLoading(false);
          setLoadingText("");
          return;
        }

        onLogin(normalizeAuthUser(data.user));
        setLoading(false);
        setLoadingText("");
        return;
      }

      if (mode === "forgot_password") {
        if (!otpSent) {
          setLoading(true);
          setLoadingText("Đang gửi mã OTP khôi phục...");

          const res = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({
              api: "sendResetOtp",
              email,
            }),
          });

          let data;
          try {
            data = await res.json();
          } catch {
            throw new Error("Server không trả JSON hợp lệ");
          }

          if (!data.ok) {
            setError(data.error || "Không gửi được OTP khôi phục");
            setLoading(false);
            setLoadingText("");
            return;
          }

          setOtpSent(true);
          setOtpCountdown(60);
          scrollToOtpSection();

          setLoading(false);
          setLoadingText("");
          return;
        }

        setLoading(true);
        setLoadingText("Đang đặt lại mật khẩu...");

        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            api: "resetPasswordWithOtp",
            email,
            otp,
            newPassword,
          }),
        });

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Server không trả JSON hợp lệ");
        }

        if (!data.ok) {
          setError(data.error || "Đặt lại mật khẩu thất bại");
          setLoading(false);
          setLoadingText("");
          return;
        }

        setLoading(false);
        setLoadingText("");
        setMode("login");
        setOtpSent(false);
        setOtp("");
        setPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setError("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
        return;
      }
    } catch (err: any) {
      console.error("ERROR:", err);
      if (err?.name === "AbortError") {
        setError("Server phản hồi quá lâu, vui lòng thử lại");
      } else {
        setError(err?.message || "Có lỗi xảy ra, vui lòng thử lại");
      }
      setLoading(false);
      setLoadingText("");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl px-5 py-4 w-full max-w-md max-h-[90vh] flex flex-col">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-3xl">
            <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium text-amber-900">
              {loadingText || "Đang xử lý..."}
            </p>
          </div>
        )}

        {/* Title */}
        <div className="shrink-0 pb-3 mb-2 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">
            {mode === "login"
              ? "ĐĂNG NHẬP"
              : mode === "register"
                ? "ĐĂNG KÝ"
                : "QUÊN MẬT KHẨU"}
          </h2>

          <p className="text-sm md:text-base text-slate-600 text-center mb-6">
            {mode === "login"
              ? "Quý khách vui lòng đăng nhập để đặt hàng"
              : mode === "register"
                ? "Tạo tài khoản để đặt hàng nhanh hơn"
                : "Nhập email để nhận mã OTP khôi phục mật khẩu"}
          </p>
        </div>

        {/* Scroll Body */}
        <div
          ref={formBodyRef}
          className="space-y-4 overflow-y-auto pr-1 flex-1"
        >
          {/* Name (register only) */}
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Họ và tên (*)
              </label>
              <input
                type="text"
                placeholder="Nhập họ tên..."
                value={name}
                onChange={(e) => {
                  const value = e.target.value;
                  setName(value);
                  if (touched.name) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      name: validateName(value),
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, name: true }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    name: validateName(name),
                  }));
                }}
                className={`w-full h-12 rounded-xl px-4 text-base focus:outline-none focus:ring-2 ${
                  touched.name && fieldErrors.name
                    ? "bg-red-50 border border-red-300 focus:ring-red-300"
                    : "bg-slate-100 focus:ring-amber-400"
                }`}
              />
              {touched.name && fieldErrors.name && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">
              Email (*)
            </label>
            <input
              type="email"
              placeholder="Nhập email..."
              value={email}
              onChange={(e) => {
                const value = e.target.value;
                setEmail(value);
                if (touched.email) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    email: validateEmail(value),
                  }));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, email: true }));
                setFieldErrors((prev) => ({
                  ...prev,
                  email: validateEmail(email),
                }));
              }}
              className={`w-full h-12 rounded-xl px-4 text-base focus:outline-none focus:ring-2 ${
                touched.email && fieldErrors.email
                  ? "bg-red-50 border border-red-300 focus:ring-red-300"
                  : "bg-slate-100 focus:ring-amber-400"
              }`}
            />
            {touched.email && fieldErrors.email && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          {mode !== "forgot_password" && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Mật khẩu (*)
              </label>
              <input
                type="password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  if (touched.password) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      password:
                        mode === "register"
                          ? validatePassword(value)
                          : !value.trim()
                            ? "Vui lòng nhập mật khẩu"
                            : "",
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, password: true }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    password:
                      mode === "register"
                        ? validatePassword(password)
                        : !password.trim()
                          ? "Vui lòng nhập mật khẩu"
                          : "",
                  }));
                }}
                className={`w-full h-12 rounded-xl px-4 text-base focus:outline-none focus:ring-2 ${
                  touched.password && fieldErrors.password
                    ? "bg-red-50 border border-red-300 focus:ring-red-300"
                    : "bg-slate-100 focus:ring-amber-400"
                }`}
              />
              {touched.password && fieldErrors.password && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {fieldErrors.password}
                </p>
              )}

              {mode === "register" && (
                <div className="mt-3 space-y-1 text-xs">
                  <p
                    className={
                      password.length >= 8 ? "text-green-600" : "text-slate-500"
                    }
                  >
                    • Ít nhất 8 ký tự
                  </p>
                  <p
                    className={
                      /[A-Z]/.test(password)
                        ? "text-green-600"
                        : "text-slate-500"
                    }
                  >
                    • Có ít nhất 1 chữ in hoa
                  </p>
                  <p
                    className={
                      /[a-z]/.test(password)
                        ? "text-green-600"
                        : "text-slate-500"
                    }
                  >
                    • Có ít nhất 1 chữ thường
                  </p>
                  <p
                    className={
                      /\d/.test(password) ? "text-green-600" : "text-slate-500"
                    }
                  >
                    • Có ít nhất 1 chữ số
                  </p>
                  <p
                    className={
                      /[^A-Za-z0-9]/.test(password)
                        ? "text-green-600"
                        : "text-slate-500"
                    }
                  >
                    • Có ít nhất 1 ký tự đặc biệt
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Confirm Password (register only) */}
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Xác nhận mật khẩu (*)
              </label>
              <input
                type="password"
                placeholder="Nhập lại mật khẩu..."
                value={confirmPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setConfirmPassword(value);
                  if (touched.confirmPassword) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      confirmPassword: validateConfirmPassword(value, password),
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, confirmPassword: true }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    confirmPassword: validateConfirmPassword(
                      confirmPassword,
                      password,
                    ),
                  }));
                }}
                className={`w-full h-12 rounded-xl px-4 text-base focus:outline-none focus:ring-2 ${
                  touched.confirmPassword && fieldErrors.confirmPassword
                    ? "bg-red-50 border border-red-300 focus:ring-red-300"
                    : "bg-slate-100 focus:ring-amber-400"
                }`}
              />
              {touched.confirmPassword && fieldErrors.confirmPassword && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* New Password & Confirm New Password for forgot_password */}
          {mode === "forgot_password" && otpSent && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Mật khẩu mới (*)
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewPassword(value);
                    if (touched.newPassword) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        newPassword: validatePassword(value),
                      }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, newPassword: true }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      newPassword: validatePassword(newPassword),
                    }));
                  }}
                  className={`w-full h-12 rounded-xl px-4 text-base focus:outline-none focus:ring-2 ${
                    touched.newPassword && fieldErrors.newPassword
                      ? "bg-red-50 border border-red-300 focus:ring-red-300"
                      : "bg-slate-100 focus:ring-amber-400"
                  }`}
                />
                {touched.newPassword && fieldErrors.newPassword && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {fieldErrors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Xác nhận mật khẩu mới (*)
                </label>
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmNewPassword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setConfirmNewPassword(value);
                    if (touched.confirmNewPassword) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        confirmNewPassword: validateConfirmNewPassword(
                          value,
                          newPassword,
                        ),
                      }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({
                      ...prev,
                      confirmNewPassword: true,
                    }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      confirmNewPassword: validateConfirmNewPassword(
                        confirmNewPassword,
                        newPassword,
                      ),
                    }));
                  }}
                  className={`w-full h-12 rounded-xl px-4 text-base focus:outline-none focus:ring-2 ${
                    touched.confirmNewPassword && fieldErrors.confirmNewPassword
                      ? "bg-red-50 border border-red-300 focus:ring-red-300"
                      : "bg-slate-100 focus:ring-amber-400"
                  }`}
                />
                {touched.confirmNewPassword &&
                  fieldErrors.confirmNewPassword && (
                    <p className="mt-2 text-sm font-medium text-red-600">
                      {fieldErrors.confirmNewPassword}
                    </p>
                  )}
              </div>
            </>
          )}

          {/* Khối OTP */}
          {(mode === "register" || mode === "forgot_password") && otpSent && (
            <div
              ref={otpSectionRef}
              className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
            >
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Mã OTP (*)
              </label>

              <p className="text-sm text-amber-900 font-medium mb-3">
                {mode === "register"
                  ? "Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư và nhập mã để hoàn tất đăng ký."
                  : "Mã OTP khôi phục đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư và nhập mã để đặt lại mật khẩu."}
              </p>

              <input
                ref={otpInputRef}
                type="text"
                placeholder="Nhập mã OTP gồm 6 số..."
                value={otp}
                onChange={(e) => {
                  const value = e.target.value;
                  setOtp(value);
                  if (touched.otp) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      otp: validateOtp(value),
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, otp: true }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    otp: validateOtp(otp),
                  }));
                }}
                className={`w-full h-12 rounded-xl bg-white px-4 text-base border border-amber-200 focus:outline-none focus:ring-2 ${
                  touched.otp && fieldErrors.otp
                    ? "border-red-300 focus:ring-red-300"
                    : "focus:ring-amber-400"
                }`}
              />

              {touched.otp && fieldErrors.otp && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {fieldErrors.otp}
                </p>
              )}

              <div className="mt-4 flex gap-3">
                {otpCountdown > 0 ? (
                  <div className="flex-1 rounded-xl bg-white border border-slate-200 px-4 py-3 text-center text-sm text-slate-500">
                    Gửi lại OTP sau {otpCountdown}s
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setError("");
                      setLoading(true);
                      setLoadingText("Đang gửi lại mã OTP...");

                      try {
                        const res = await fetch(API_URL, {
                          method: "POST",
                          headers: {
                            "Content-Type": "text/plain;charset=utf-8",
                          },
                          body: JSON.stringify({
                            api:
                              mode === "register" ? "sendOtp" : "sendResetOtp",
                            email,
                          }),
                        });

                        let data = await res.json();

                        if (!data.ok) {
                          setError(data.error || "Không gửi lại được OTP");
                          setLoading(false);
                          setLoadingText("");
                          return;
                        }

                        setOtp("");
                        setOtpCountdown(60);
                        scrollToOtpSection();

                        setLoading(false);
                        setLoadingText("");
                      } catch (err: any) {
                        setError("Không thể gửi lại OTP. Vui lòng thử lại.");
                        setLoading(false);
                        setLoadingText("");
                      }
                    }}
                    className="flex-1 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition"
                  >
                    Gửi lại mã OTP
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetOtpFlow}
                  className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  {mode === "register" ? "Hủy đăng ký" : "Hủy khôi phục"}
                </button>
              </div>
            </div>
          )}

          {/* Thông báo lỗi chung */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-red-700 text-sm md:text-base font-semibold text-center">
                {error}
              </p>
            </div>
          )}

          {/* Link Quên mật khẩu */}
          {mode === "login" && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  resetFormState();
                  setMode("forgot_password");
                }}
                className="text-sm font-semibold text-amber-700 hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-300" />
            <span className="text-xs text-slate-400">hoặc</span>
            <div className="flex-1 h-px bg-slate-300" />
          </div>

          {/* Google Login Button */}
          <button
            disabled={loading}
            onClick={() => {
              setError("");
              setLoading(true);
              setLoadingText("Đang đăng nhập với Google...");

              const oauth2 = (window as any).google?.accounts?.oauth2;
              if (!oauth2) {
                setError("Google SDK chưa load");
                setLoading(false);
                setLoadingText("");
                return;
              }

              const tokenClient = oauth2.initTokenClient({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                scope: "openid email profile",
                callback: async (response: any) => {
                  try {
                    if (!response?.access_token) {
                      throw new Error("Không nhận được access token từ Google");
                    }
                    const googleUser = await fetchGoogleUserInfo(
                      response.access_token,
                    );

                    const apiRes = await fetch(API_URL, {
                      method: "POST",
                      headers: {
                        "Content-Type": "text/plain;charset=utf-8",
                      },
                      body: JSON.stringify({
                        api: "googleLogin",
                        email: googleUser.email,
                        name: googleUser.name,
                        avatarUrl: googleUser.picture,
                      }),
                    });

                    const text = await apiRes.text();
                    let data = JSON.parse(text);

                    if (!data.ok) {
                      throw new Error(data.error || "Google login thất bại");
                    }

                    onLogin(
                      normalizeAuthUser({
                        ...data.user,
                        avatarUrl:
                          data.user?.avatarUrl || googleUser.picture || "",
                      }),
                    );
                    setLoading(false);
                    setLoadingText("");
                    onClose();
                  } catch (err: any) {
                    setError(err?.message || "Google login lỗi");
                    setLoading(false);
                    setLoadingText("");
                  }
                },
              });
              tokenClient.requestAccessToken();
            }}
            className="w-full border rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-gray-50"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
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
                    resetFormState();
                    setMode("register");
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
                    resetFormState();
                    setMode("login");
                  }}
                  className="text-amber-600 font-semibold hover:underline"
                >
                  Đăng nhập
                </button>
              </>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-full font-bold text-base text-black bg-amber-400 hover:bg-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? "Đang xử lý..."
              : mode === "login"
                ? "Đăng nhập"
                : mode === "register"
                  ? otpSent
                    ? "Xác nhận OTP"
                    : "Gửi mã OTP"
                  : otpSent
                    ? "Đặt lại mật khẩu"
                    : "Gửi mã OTP khôi phục"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
