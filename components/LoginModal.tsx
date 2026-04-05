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

  // ✅ Function decode JWT
  function parseJwt(token: string) {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  }

  const handleSubmit = async () => {
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(API_URL, {
          method: "POST",
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
          return;
        }

        setOtpSent(true);
        setOtpCountdown(60);

        setLoading(false);
        return;
      }

      if (!otp.trim()) {
        setError("Vui lòng nhập mã OTP");
        setLoading(false);
        return;
      }

      // ✅ CALL 1 API DUY NHẤT
      const res = await fetch(API_URL, {
        method: "POST",
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
        return;
      }

      onLogin(data.user);

      setLoading(false);
    } catch (err: any) {
      console.error("ERROR:", err);
      if (err.name === "AbortError") {
        setError("Server phản hồi quá lâu, vui lòng thử lại");
      } else {
        setError("Không thể kết nối server hoặc bị chặn CORS");
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl px-5 py-4 w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Title */}
        <div className="shrink-0 pb-3 mb-2 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-amber-900">
            {mode === "login" ? "ĐĂNG NHẬP" : "ĐĂNG KÝ"}
          </h2>

          {/* Description */}
          <p className="text-sm md:text-base text-slate-600 text-center mb-6">
            {mode === "login"
              ? "Quý khách vui lòng đăng nhập để đặt hàng"
              : "Tạo tài khoản để đặt hàng nhanh hơn"}
          </p>
        </div>

        {/* Scroll Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
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
                className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

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
              className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
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
              className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                className="w-full h-12 rounded-xl bg-slate-100 px-4 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                          setError(data.error || "Không gửi lại được OTP");
                          setLoading(false);
                          return;
                        }

                        setOtp("");
                        setOtpCountdown(60);

                        setLoading(false);
                      } catch (err) {
                        console.error("ERROR:", err);
                        if (err.name === "AbortError") {
                          setError("Server phản hồi quá lâu, vui lòng thử lại");
                        } else {
                          setError(
                            "Không thể kết nối server hoặc bị chặn CORS",
                          );
                        }
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

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-300" />
            <span className="text-xs text-slate-400">hoặc</span>
            <div className="flex-1 h-px bg-slate-300" />
          </div>

          <button
            onClick={() => {
              const client = (window as any).google?.accounts?.oauth2;

              if (!client) {
                alert("Google SDK chưa load");
                return;
              }

              const tokenClient = client.initTokenClient({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                scope: "profile email",
                callback: async (response: any) => {
                  try {
                    if (!response.credential) {
                      throw new Error("No credential");
                    }

                    // ✅ decode token
                    const user = parseJwt(response.credential);

                    console.log("Google user:", user);

                    const apiRes = await fetch(API_URL, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        api: "googleLogin",
                        email: user.email,
                        name: user.name,
                        avatarUrl: user.picture,
                      }),
                    });

                    const text = await apiRes.text();
                    console.log("RAW RESPONSE:", text);

                    let data;
                    try {
                      data = JSON.parse(text);
                    } catch (e) {
                      console.error("JSON parse error:", e);
                      throw new Error("API trả về không phải JSON");
                    }

                    console.log("PARSED DATA:", data);

                    if (!data.ok) {
                      throw new Error(data.error);
                    }

                    localStorage.setItem("user", JSON.stringify(data.user));

                    onLogin(data.user);
                    onClose();
                  } catch (err) {
                    console.error(err);
                    alert("Google login lỗi");
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

        {/* Button - Không bị trôi */}
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
                : otpSent
                  ? "Xác nhận OTP"
                  : "Gửi mã OTP"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
