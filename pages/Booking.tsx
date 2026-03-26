import React, { useMemo, useState, useEffect, useRef } from "react";

/**
 * Booking.tsx (Option B: Google Sheet via Apps Script Web App)
 *
 * Bạn chỉ cần:
 * 1) Tạo Google Sheet + Apps Script (mình gửi code ở chat)
 * 2) Deploy Web App => dán URL vào APPS_SCRIPT_WEBAPP_URL bên dưới
 *
 * Lưu ý CORS:
 * - Google Apps Script Web App thường chặn CORS với fetch trực tiếp.
 * - Vì vậy mình dùng fetch({ mode: "no-cors" }) để gửi dữ liệu "fire-and-forget".
 * - Nếu bạn muốn nhận lại "mã đặt lịch" từ server, mình sẽ đưa phương án iframe+postMessage.
 */

const APPS_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyK7xt7TfHzhpoqOQIl66232zcAEh-f3AUGvGiAXnOFoG4ngx36c-DCFHeT89c2hySh/exec"; // TODO: dán URL dạng https://script.google.com/macros/s/XXXX/exec

type BookingForm = {
  name: string;
  phone: string;
  email: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  note: string;
  // honeypot chống bot
  website: string;
};

type BookingHistoryItem = {
  name: string;
  phone: string;
  email: string;
  note: string;
  submittedAt: string; // ISO
};

const BOOKING_HISTORY_KEY = "vmgc_booking_history_v1";
const BOOKING_HISTORY_MAX = 20;

function loadBookingHistory(): BookingHistoryItem[] {
  try {
    const raw = localStorage.getItem(BOOKING_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(Boolean)
      .map((x) => ({
        name: String(x?.name ?? ""),
        phone: String(x?.phone ?? ""),
        email: String(x?.email ?? ""),
        note: String(x?.note ?? ""),
        submittedAt: String(x?.submittedAt ?? ""),
      }))
      .filter((x) => x.name || x.phone || x.email || x.note);
  } catch {
    return [];
  }
}

function saveBookingHistory(item: BookingHistoryItem) {
  try {
    const prev = loadBookingHistory();

    // dedupe theo phone + email + name (đủ “đúng logic” cho gợi ý)
    const keyOf = (x: BookingHistoryItem) =>
      `${x.phone.trim()}|${x.email.trim().toLowerCase()}|${x.name.trim().toLowerCase()}`;

    const next = [item, ...prev.filter((x) => keyOf(x) !== keyOf(item))].slice(
      0,
      BOOKING_HISTORY_MAX
    );

    localStorage.setItem(BOOKING_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

const phoneVN = (s: string) => {
  const p = s.replace(/\s/g, "");
  return /^(0|\+84)\d{9}$/.test(p);
};

const isFutureOrToday = (dateISO: string) => {
  if (!dateISO) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateISO + "T00:00:00");
  return d.getTime() >= today.getTime();
};

const isFutureOrNowDateTime = (dateISO: string, timeHHmm: string) => {
  if (!dateISO || !timeHHmm) return false;

  const [hhStr = "00", mmStr = "00"] = timeHHmm.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  // ghép datetime theo local time của máy khách
  const selected = new Date(dateISO + "T00:00:00");
  selected.setHours(hh, mm, 0, 0);

  return selected.getTime() >= Date.now();
};

const toVNPhone = (s: string) => s.replace(/\s/g, "");

const Booking: React.FC = () => {
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState("07:00");
  const formRef = useRef<HTMLFormElement | null>(null);

  const [isSubmitted, setIsSubmitted] = useState(false);

  // Ref để scroll tới khối bên phải (form / success)
  const successRef = useRef<HTMLDivElement | null>(null);

  // Khi submit thành công → tự scroll tới thông báo
  useEffect(() => {
    if (!isSubmitted) return;

    requestAnimationFrame(() => {
      const el = successRef.current;
      if (!el) return;

      const headerOffset = 96; // chỉnh số này nếu header cao hơn/thấp hơn
      const rect = el.getBoundingClientRect();

      const elementTop = rect.top + window.scrollY;
      const elementHeight = rect.height;
      const viewportHeight = window.innerHeight;

      // target: tâm element trùng tâm viewport (trừ đi header)
      const targetY =
        elementTop - headerOffset - (viewportHeight / 2 - elementHeight / 2);

      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: "smooth",
      });
    });
  }, [isSubmitted]);


  const [loading, setLoading] = useState(false);
  const [successCode, setSuccessCode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [timeError, setTimeError] = useState<string>("");

  const [formData, setFormData] = useState<BookingForm>({
    name: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    note: "",
    website: "",
  });

  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  useEffect(() => { setHistory(loadBookingHistory()); }, []);

  const unique = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

  const nameSuggestions = useMemo(() => unique(history.map((h) => h.name)), [history]);
  const phoneSuggestions = useMemo(() => unique(history.map((h) => h.phone)), [history]);
  const emailSuggestions = useMemo(() => unique(history.map((h) => h.email)), [history]);

  const canSubmit = useMemo(() => {
    return (
      formData.name.trim() &&
      phoneVN(formData.phone) &&
      formData.date &&
      formData.time &&
      isFutureOrNowDateTime(formData.date, formData.time)
    );
  }, [formData]);

  const setField =
    <K extends keyof BookingForm>(key: K) =>
      (value: BookingForm[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
      };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      date: "",
      time: "",
      note: "",
      website: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessCode("");
    setTimeError("");

    // Honeypot: bot hay điền field ẩn
    if (formData.website.trim()) return;

    if (!formData.name.trim()) return setError("Vui lòng nhập họ và tên.");
    if (!phoneVN(formData.phone)) return setError("Số điện thoại không hợp lệ (0xxxxxxxxx hoặc +84xxxxxxxxx).");
    if (!formData.date) return setError("Vui lòng chọn ngày tham quan.");
    if (!isFutureOrToday(formData.date)) return setError("Ngày tham quan phải từ hôm nay trở đi.");
    if (!formData.time) return setError("Vui lòng chọn giờ hẹn.");

    if (!isFutureOrNowDateTime(formData.date, formData.time)) {
      setTimeError("Giờ hẹn phải từ thời điểm hiện tại trở đi.");
      return;
    }


    if (!APPS_SCRIPT_WEBAPP_URL) {
      return setError("Chưa cấu hình APPS_SCRIPT_WEBAPP_URL. Bạn hãy dán URL Web App (Apps Script) vào Booking.tsx.");
    }

    const payload = {
      ...formData,
      phone: toVNPhone(formData.phone),
      createdAt: new Date().toISOString(),
      source: "vuonmaigocat_web",
    };

    // Code hiển thị cho người dùng (tạm thời) – vì no-cors không đọc được response
    const localCode = ("DL" + Date.now().toString().slice(-8)).toUpperCase();

    setLoading(true);

    // 1) Optimistic UI: cho “thành công” ngay (hoặc đợi 900ms cho tự nhiên)
    setSuccessCode(localCode);

    // Nếu bạn muốn có cảm giác chờ nhẹ 0.8–1.2s thì bật delay này:
    const MIN_SUCCESS_DELAY_MS = 900;

    setTimeout(() => {
      setIsSubmitted(true);
      resetForm();
      setLoading(false);
    }, MIN_SUCCESS_DELAY_MS);

    // 2) Gửi request NGẦM, không await
    void fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // no-cors: không đọc được response; lỗi network thật sự rất hiếm
      // Bạn có thể log để debug, hoặc bỏ qua hoàn toàn để giữ UX
    });

    // 3) Lưu lịch sử gợi ý ngay lập tức (vì UX ưu tiên khách)
    const saved: BookingHistoryItem = {
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      note: payload.note,
      submittedAt: new Date().toISOString(),
    };
    saveBookingHistory(saved);
    setHistory(loadBookingHistory());
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="py-16 bg-gradient-to-r from-[#2F5D3A] to-[#D4A017] text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Đặt Lịch Tham Quan</h1>
          <p className="text-white/90 text-lg">Hãy đến trực tiếp vườn để trải nghiệm và chọn lựa cây mai ưng ý</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left column */}
          <div className="space-y-8">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <img
                src="/img_appoinment.png"
                alt="Đặt lịch tham quan Vườn Mai Gò Cát"
                className="w-full h-[260px] md:h-[320px] lg:h-[360px] object-cover"
                loading="lazy"
              />
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-md">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-1.5 h-7 bg-amber-500 rounded-full" />
                Thông Tin Vườn
              </h3>

              <div className="space-y-6 text-slate-700">
                <div className="flex gap-4">
                  <div className="text-amber-500 font-bold">📍</div>
                  <div>
                    <p className="font-bold">Địa Chỉ</p>
                    <p className="text-slate-500 text-sm">
                      56 Đường 882, P. Long Trường, Thành phố Hồ Chí Minh
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-amber-500 font-bold">⏰</div>
                  <div>
                    <p className="font-bold">Giờ Làm Việc</p>
                    <p className="text-slate-500 text-sm">Hàng ngày: 7:00 - 18:00</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-8 rounded-3xl">
              <p className="font-bold text-amber-800 flex items-center gap-2 mb-4">💡 Gợi Ý Cho Bạn</p>
              <ul className="text-amber-900/80 text-sm space-y-3 leading-relaxed">
                <li>• Nên đến vườn vào buổi sáng để chọn mai trong điều kiện ánh sáng tốt nhất.</li>
                <li>• Mang theo ảnh không gian đặt mai để được tư vấn kích thước phù hợp.</li>
                <li>• Đội ngũ chuyên gia luôn sẵn sàng hỗ trợ bạn tại vườn.</li>
              </ul>
            </div>
          </div>

          {/* Right column - Form */}
          <div
            ref={successRef}
            className="bg-white p-10 rounded-3xl shadow-xl lg:self-center"
          >
            {!isSubmitted ? (
              <>
                <h3 className="text-2xl font-bold text-slate-900 mb-8">Thông Tin Đặt Lịch</h3>

                <form
                  ref={formRef}
                  onSubmit={handleSubmit}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;

                    const target = e.target as HTMLElement;
                    if (target.tagName === "TEXTAREA") return;

                    e.preventDefault();

                    const form = formRef.current;
                    if (!form) return;

                    const focusables = Array.from(
                      form.querySelectorAll<HTMLElement>(
                        'input:not([type="hidden"]), textarea, button, select'
                      )
                    ).filter((el) => el.offsetParent !== null);

                    const index = focusables.indexOf(target);
                    focusables[index + 1]?.focus();
                  }}
                  className="space-y-6"
                >
                  {/* Honeypot (ẩn) */}
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setField("website")(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />

                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Họ và Tên <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      list="vmgc-name-suggestions"
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={formData.name}
                      onChange={(e) => setField("name")(e.target.value)}
                      required
                    />
                    <datalist id="vmgc-name-suggestions">
                      {nameSuggestions.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700">
                      Số Điện Thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="090 123 4567"
                      list="vmgc-phone-suggestions"
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={formData.phone}
                      onChange={(e) => setField("phone")(e.target.value)}
                      required
                    />
                    <datalist id="vmgc-phone-suggestions">
                      {phoneSuggestions.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                    {formData.phone && !phoneVN(formData.phone) && (
                      <p className="text-xs text-red-600 mt-2">SĐT phải có 10 số (0xxxxxxxxx) hoặc +84xxxxxxxxx.</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700">Email</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      list="vmgc-email-suggestions"
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={formData.email}
                      onChange={(e) => setField("email")(e.target.value)}
                    />
                    <datalist id="vmgc-email-suggestions">
                      {emailSuggestions.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        Ngày Tham Quan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        value={formData.date}
                        onChange={(e) => {
                          setField("date")(e.target.value);
                          setTimeError(""); // đổi ngày thì xóa lỗi giờ (nếu có)
                        }}
                        required
                      />
                      {formData.date && !isFutureOrToday(formData.date) && (
                        <p className="text-xs text-red-600 mt-2">Ngày tham quan phải từ hôm nay trở đi.</p>
                      )}
                    </div>

                    <div>
                      {/* Giờ hẹn (24h + OK) */}
                      <div className="relative">
                        <label className="text-sm font-bold text-slate-700">
                          Giờ Hẹn <span className="text-red-500">*</span>
                        </label>

                        {/* Nút mở chọn giờ */}
                        <button
                          type="button"
                          onClick={() => setTimeOpen((v) => !v)}
                          className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-left
               focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          {formData.time ? formData.time : "Chọn giờ (HH:mm)"}
                        </button>

                        {/* Popup chọn giờ */}
                        {timeOpen && (
                          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
                            <div className="flex gap-3">
                              {/* Giờ */}
                              <select
                                className="w-1/2 px-3 py-2 rounded-xl border border-slate-200"
                                value={timeDraft.split(":")[0]}
                                onChange={(e) => {
                                  const hh = e.target.value.padStart(2, "0");
                                  const mm = timeDraft.split(":")[1] || "00";
                                  setTimeDraft(`${hh}:${mm}`);
                                }}
                              >
                                {Array.from({ length: 24 }, (_, i) =>
                                  String(i).padStart(2, "0")
                                ).map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>

                              {/* Phút */}
                              <select
                                className="w-1/2 px-3 py-2 rounded-xl border border-slate-200"
                                value={timeDraft.split(":")[1]}
                                onChange={(e) => {
                                  const hh = timeDraft.split(":")[0] || "07";
                                  const mm = e.target.value.padStart(2, "0");
                                  setTimeDraft(`${hh}:${mm}`);
                                }}
                              >
                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>

                            {/* Nút OK / Hủy */}
                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setTimeOpen(false)}
                                className="px-4 py-2 rounded-xl border"
                              >
                                Hủy
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setField("time")(timeDraft);
                                  setTimeOpen(false);

                                  // validate giờ so với hiện tại (nếu có ngày)
                                  if (formData.date && !isFutureOrNowDateTime(formData.date, timeDraft)) {
                                    setTimeError("Giờ hẹn phải từ thời điểm hiện tại trở đi.");
                                  } else {
                                    setTimeError("");
                                  }
                                }}
                                className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold"
                              >
                                OK
                              </button>
                            </div>
                          </div>
                        )}

                        {/* input ẩn để required vẫn hoạt động */}
                        <input type="hidden" value={formData.time} required />
                        {formData.time && timeError && (
                          <p className="text-xs text-red-600 mt-2">{timeError}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700">Ghi Chú</label>
                    <textarea
                      placeholder="Nhu cầu cụ thể của bạn..."
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[120px]"
                      value={formData.note}
                      onChange={(e) => setField("note")(e.target.value)}
                    />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all
                      ${loading || !canSubmit
                        ? "bg-red-300 cursor-not-allowed"
                        : "bg-red-700 hover:bg-red-800 active:scale-[0.99]"
                      }`}
                  >
                    {loading ? "Đang gửi..." : "Xác Nhận Đặt Lịch Hẹn"}
                  </button>

                  <p className="text-xs text-slate-400 text-center mt-4">
                    Bằng việc đặt lịch, bạn đồng ý với các điều khoản dịch vụ của chúng tôi.
                  </p>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4 min-h-[360px] flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-green-600 text-5xl mx-auto mb-8 border-4 border-green-200 bg-green-100">
                  ✓
                </div>

                <h4 className="text-2xl font-bold text-slate-900">Đặt Lịch Thành Công!</h4>

                <p className="text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Chúng tôi đã nhận được yêu cầu của bạn. Đội ngũ sẽ liên hệ xác nhận trong thời gian sớm nhất.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
                  {/* CTA sang trang Sản Phẩm */}
                  <a
                    href="#/san-pham"
                    className="
                      inline-flex items-center justify-center
                      px-6 py-3 rounded-xl
                      bg-amber-500 text-white font-bold
                      shadow-lg
                      hover:bg-amber-600
                      transition-all
                      active:scale-[0.98]
                    "
                  >
                    👉 Tiếp Tục Xem Mai Tết
                  </a>

                  {/* Đặt lại lịch */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false);
                      setError("");
                      setSuccessCode("");
                    }}
                    className="
                      px-6 py-3 rounded-xl
                      border border-amber-400
                      text-amber-600 font-bold
                      hover:bg-amber-50
                      transition-all
                    "
                  >
                    Đặt một lịch hẹn khác
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;
