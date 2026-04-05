/**
 * Vườn Mai Gò Cát - Products API (Google Apps Script)
 * - GET ?api=products&type=BS|T|All  => danh sách cây từ Google Sheet (đọc đúng tab)
 * - GET ?api=meta                    => version meta
 * - Ảnh: scan trong Drive folder theo tên file ~ mã cây
 * - Cache imageMap 10 phút để giảm tải
 * - Menu trong Sheet: Ảnh → Cập nhật ảnh (clear cache + bump img version)
 *
 * ✅ IMPORTANT (tùy chọn):
 * - Có thể ẨN GIÁ công khai bằng config HIDE_PUBLIC_PRICE
 * - Lọc & ưu tiên hiển thị có thể dùng giá nội bộ ở cột:
 *    "Giá thuê (xem nội bộ)" và "Giá bán (xem nội bộ)"
 *   => trả thêm giaThueFilter/giaBanFilter để frontend lọc/sort
 */

/** ================= CONFIG ================= */
// ✅ 2 sheet theo loại (BS = Bonsai, T = Tàng)
const SHEET_MAP = {
  BS: "MaiBonSai",
  T: "MaiTang",
};
const DEFAULT_TYPE = "All";

// 👇 folder ảnh Drive
const FOLDER_ID = "1abfb7akONARR-TQXTapBPDydiAQHWucX";

// ✅ folder chứa Avatar người dùng
const AVATAR_FOLDER_ID = "1JZ94hT8VIU85asyYfr4TPz8qdFkR0ctK";

// ✅ BẬT/TẮT HIỂN THỊ GIÁ CÔNG KHAI TRÊN WEB
const HIDE_PUBLIC_PRICE = false;

// ✅ Nếu cột giá nội bộ trống, cho phép fallback filter theo giá công khai
const FILTER_FALLBACK_TO_PUBLIC_PRICE = true;

/** ================= BOOKING CONFIG ================= */
const BOOKING_SHEET_NAME = "DatLich";
const BOOKING_OWNER_EMAIL = "asdfkhanh1111@gmail.com";
const BOOKING_SOURCE = "vuonmaigocat_web";

/** ================= MENU ================= */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu("Ảnh")
    .addItem("Cập nhật ảnh", "MENU_UPDATE_IMAGES")
    .addToUi();
}

function MENU_UPDATE_IMAGES() {
  CLEAR_IMAGE_CACHE_BUTTON();
}

/**
 * ✅ Auto mutual-exclusive checkbox Đã thuê / Đã bán
 * ✅ bump dataVersion khi bất kỳ ô dữ liệu thay đổi để frontend revalidate
 * ✅ áp dụng cho BOTH sheets: MaiBonSai + MaiTang
 */
function onEdit(e) {
  try {
    const range = e && e.range;
    if (!range) return;

    const sh = range.getSheet();
    if (!sh) return;

    const name = sh.getName();
    const isTargetSheet = name === SHEET_MAP.BS || name === SHEET_MAP.T;
    if (!isTargetSheet) return;

    const row = range.getRow();
    const col = range.getColumn();

    if (row <= 1) return;

    bumpDataVersion_();

    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    let colDaThue = -1;
    let colDaBan = -1;

    for (let i = 0; i < headers.length; i++) {
      const key = normalizeHeaderKey_(headers[i]);
      if (key === "dathue") colDaThue = i + 1;
      if (key === "daban") colDaBan = i + 1;
    }

    if (colDaThue < 0 || colDaBan < 0) return;

    const isEditDaThue = col === colDaThue;
    const isEditDaBan = col === colDaBan;
    if (!isEditDaThue && !isEditDaBan) return;

    const val = !!range.getValue();
    if (!val) return;

    if (isEditDaThue) {
      sh.getRange(row, colDaBan).setValue(false);
    } else if (isEditDaBan) {
      sh.getRange(row, colDaThue).setValue(false);
    }
  } catch (err) {
    // ignore
  }
}

/** ================= CACHE KEYS ================= */
const IMAGE_MAP_CACHE_KEY = "IMAGE_MAP_JSON_V2";
const IMAGE_MAP_CACHE_SECONDS = 10 * 60; // 10 phút

const IMG_VERSION_KEY = "IMG_VERSION_V1";
const DATA_VERSION_KEY = "DATA_VERSION_V1";

/** ================= VERSION ================= */
function getImgVersion_() {
  const props = PropertiesService.getScriptProperties();
  let v = props.getProperty(IMG_VERSION_KEY);
  if (!v) {
    v = String(Date.now());
    props.setProperty(IMG_VERSION_KEY, v);
  }
  return v;
}

function bumpImgVersion_() {
  const props = PropertiesService.getScriptProperties();
  const v = String(Date.now());
  props.setProperty(IMG_VERSION_KEY, v);
  return v;
}

function getDataVersion_() {
  const props = PropertiesService.getScriptProperties();
  let v = props.getProperty(DATA_VERSION_KEY);
  if (!v) {
    v = String(Date.now());
    props.setProperty(DATA_VERSION_KEY, v);
  }
  return v;
}

function bumpDataVersion_() {
  const props = PropertiesService.getScriptProperties();
  const v = String(Date.now());
  props.setProperty(DATA_VERSION_KEY, v);
  return v;
}

/** ================= HTTP ENTRY ================= */
function doGet(e) {
  try {
    const api = String(e?.parameter?.api || "").trim();
    const type = normalizeType_(e?.parameter?.type);

    if (api === "products") return handleProducts_(type);
    if (api === "meta") return handleMeta_();

    return json_({ ok: true, message: "Products API is running" });
  } catch (err) {
    return json_({ ok: false, error: String(err?.message || err) }, 500);
  }
}

function doPost(e) {
  try {
    let body = {};
    try {
      body = parseJson_(e);
    } catch (err) {
      body = {};
    }

    const api = String(body?.api || e?.parameter?.api || "").trim();

    if (api === "sendOtp") return handleSendOtp_(e);
    if (api === "register") return handleRegister_(e);
    if (api === "registerWithOtp") return handleRegisterWithOtp_(e);
    if (api === "login") return handleLogin_(e);
    if (api === "googleLogin") return handleGoogleLogin_(e);
    if (api === "getProfile") return handleGetProfile_(e);
    if (api === "updateProfile") return handleUpdateProfile_(e);
    if (api === "changePassword") return handleChangePassword_(e);

    // 🔥 NEW: API upload avatar
    if (api === "uploadAvatar") return handleUploadAvatar_(body);

    if (api === "booking") return handleBookingSubmit_(e);

    return json_({ ok: false, error: "Invalid API" });
  } catch (err) {
    return json_({
      ok: false,
      error: String(err?.message || err || "Server error"),
    });
  }
}

function handleMeta_() {
  return json_({
    ok: true,
    imgVersion: getImgVersion_(),
    dataVersion: getDataVersion_(),
    meta: {
      cacheSeconds: IMAGE_MAP_CACHE_SECONDS,
      now: Date.now(),
      hidePublicPrice: HIDE_PUBLIC_PRICE,
    },
  });
}

/** ================= JSON HELPERS ================= */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** ================= TYPE ================= */
function normalizeType_(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase();
  if (s === "BS" || s === "T") return s;
  return "All";
}

/** ================= NORMALIZE ================= */
function normalizeCode_(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase();
  if (!s) return "";

  const compact = s.replace(/\s+/g, "");

  let m = compact.match(/^(BS)(\d+)([A-Z]?)$/);
  if (m) {
    const prefix = m[1];
    const num = m[2];
    const tail = m[3] || "";
    return `${prefix} ${num}${tail}`;
  }

  m = compact.match(/^(T)(\d+)([A-Z]?)$/);
  if (m) {
    const prefix = m[1];
    const num = m[2];
    const tail = m[3] || "";
    return `${prefix} ${num}${tail}`;
  }

  return compact;
}

function normalizeHeaderKey_(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function toBool_(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function toNumberOrNull_(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;

  const s = String(v).trim();
  if (!s) return null;

  const cleaned = s
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function isPositiveNumber_(v) {
  return v != null && typeof v === "number" && isFinite(v) && v > 0;
}

/** ================= IMAGE MAP (Drive) ================= */
function buildImageMapFromDrive_() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFiles();

  const map = {};

  while (files.hasNext()) {
    const f = files.next();
    const name = String(f.getName() || "");
    const lower = name.toLowerCase();

    if (
      !lower.endsWith(".jpg") &&
      !lower.endsWith(".jpeg") &&
      !lower.endsWith(".png")
    ) {
      continue;
    }

    const base = name.replace(/\.[^.]+$/, "");
    const code = normalizeCode_(base);
    if (!code) continue;

    if (!map[code]) {
      const id = f.getId();
      map[code] = {
        id,
        url: `https://drive.google.com/thumbnail?id=${id}&sz=w1200`,
      };
    }
  }

  return map;
}

function getImageMapCached_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(IMAGE_MAP_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {}
  }

  const map = buildImageMapFromDrive_();
  cache.put(IMAGE_MAP_CACHE_KEY, JSON.stringify(map), IMAGE_MAP_CACHE_SECONDS);
  return map;
}

function clearImageMapCache_() {
  const cache = CacheService.getScriptCache();
  cache.remove(IMAGE_MAP_CACHE_KEY);

  const newV = bumpImgVersion_();

  const map = buildImageMapFromDrive_();
  cache.put(IMAGE_MAP_CACHE_KEY, JSON.stringify(map), IMAGE_MAP_CACHE_SECONDS);

  return { newV, count: Object.keys(map).length };
}

function CLEAR_IMAGE_CACHE_BUTTON() {
  const { newV, count } = clearImageMapCache_();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `✅ Đã cập nhật ảnh. Version=${newV}\nĐã quét ${count} ảnh.`,
    "Vườn Mai Gò Cát",
    6,
  );
}

/** ================= PRIORITY (Tier + Sort) ================= */
function getTier_(p) {
  const hasImg = !!p.imageUrl;
  const hasGiaThue = isPositiveNumber_(p.giaThueFilter);
  const hasGiaBan = isPositiveNumber_(p.giaBanFilter);

  if (hasImg && (hasGiaThue || hasGiaBan)) return 0;
  if (hasImg) return 1;
  if (hasGiaThue || hasGiaBan) return 2;
  return 3;
}

function tier0Compare_(a, b) {
  const rentA = isPositiveNumber_(a.giaThueFilter) ? a.giaThueFilter : 0;
  const sellA = isPositiveNumber_(a.giaBanFilter) ? a.giaBanFilter : 0;
  const rentB = isPositiveNumber_(b.giaThueFilter) ? b.giaThueFilter : 0;
  const sellB = isPositiveNumber_(b.giaBanFilter) ? b.giaBanFilter : 0;

  const priceA = Math.max(rentA, sellA);
  const priceB = Math.max(rentB, sellB);
  if (priceA !== priceB) return priceB - priceA;

  const specA =
    (isPositiveNumber_(a.cao_m) ? 1 : 0) +
    (isPositiveNumber_(a.ngang_m) ? 1 : 0) +
    (isPositiveNumber_(a.hoanh_cm) ? 1 : 0) +
    (isPositiveNumber_(a.chau_m) ? 1 : 0);

  const specB =
    (isPositiveNumber_(b.cao_m) ? 1 : 0) +
    (isPositiveNumber_(b.ngang_m) ? 1 : 0) +
    (isPositiveNumber_(b.hoanh_cm) ? 1 : 0) +
    (isPositiveNumber_(b.chau_m) ? 1 : 0);

  if (specA !== specB) return specB - specA;

  const modeA = rentA > 0 && sellA > 0 ? 2 : rentA > 0 ? 1 : 0;
  const modeB = rentB > 0 && sellB > 0 ? 2 : rentB > 0 ? 1 : 0;
  if (modeA !== modeB) return modeB - modeA;

  return String(a.maCay || "").localeCompare(String(b.maCay || ""), "vi");
}

/** ================= SHEET PARSER ================= */
function parseSheetItems_(sh, imageMap) {
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const headers = values[0].map((h) => String(h || "").trim());

  const idx = {};
  headers.forEach((h, i) => (idx[h] = i));

  const idxN = {};
  headers.forEach((h, i) => (idxN[normalizeHeaderKey_(h)] = i));

  const c_id =
    idx["MaCay"] ??
    idx["maCay"] ??
    idx["MaCây"] ??
    idx["Ma cay"] ??
    idxN["macay"] ??
    idx["d"] ??
    idx["id"] ??
    0;

  const c_cao = idx["Cao_m"] ?? idxN["caom"];
  const c_ngang = idx["Ngang_m"] ?? idxN["ngangm"];
  const c_hoanh = idx["Hoanh_cm"] ?? idxN["hoanhcm"];
  const c_chau = idx["Chau_m"] ?? idxN["chaum"];
  const c_note = idx["Note"] ?? idxN["note"];

  const c_giaThue = idx["GiaThue"] ?? idxN["giathue"];
  const c_giaBan = idx["GiaBan"] ?? idxN["giaban"];

  const c_giaThueNoiBo =
    idx["Giá thuê (xem nội bộ)"] ?? idxN["giathuexemnoibo"];
  const c_giaBanNoiBo = idx["Giá bán (xem nội bộ)"] ?? idxN["giabanxemnoibo"];

  let c_daThue = null;
  let c_daBan = null;
  headers.forEach((h, i) => {
    const key = normalizeHeaderKey_(h);
    if (key === "dathue") c_daThue = i;
    if (key === "daban") c_daBan = i;
  });

  const items = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const rawId = row[c_id];
    const code = normalizeCode_(rawId);
    if (!code) continue;

    const img = imageMap[code] || null;

    const publicGiaThue =
      c_giaThue != null ? toNumberOrNull_(row[c_giaThue]) : null;
    const publicGiaBan =
      c_giaBan != null ? toNumberOrNull_(row[c_giaBan]) : null;

    const noiBoGiaThue =
      c_giaThueNoiBo != null ? toNumberOrNull_(row[c_giaThueNoiBo]) : null;
    const noiBoGiaBan =
      c_giaBanNoiBo != null ? toNumberOrNull_(row[c_giaBanNoiBo]) : null;

    const giaThueFilter =
      noiBoGiaThue != null
        ? noiBoGiaThue
        : FILTER_FALLBACK_TO_PUBLIC_PRICE
          ? publicGiaThue
          : null;

    const giaBanFilter =
      noiBoGiaBan != null
        ? noiBoGiaBan
        : FILTER_FALLBACK_TO_PUBLIC_PRICE
          ? publicGiaBan
          : null;

    items.push({
      maCay: code,
      giaThue: HIDE_PUBLIC_PRICE ? null : publicGiaThue,
      giaBan: HIDE_PUBLIC_PRICE ? null : publicGiaBan,
      giaThueFilter: giaThueFilter,
      giaBanFilter: giaBanFilter,
      cao_m: c_cao != null ? toNumberOrNull_(row[c_cao]) : null,
      ngang_m: c_ngang != null ? toNumberOrNull_(row[c_ngang]) : null,
      hoanh_cm: c_hoanh != null ? toNumberOrNull_(row[c_hoanh]) : null,
      chau_m: c_chau != null ? toNumberOrNull_(row[c_chau]) : null,
      note: c_note != null ? String(row[c_note] || "").trim() : "",
      daThue: c_daThue != null ? toBool_(row[c_daThue]) : false,
      daBan: c_daBan != null ? toBool_(row[c_daBan]) : false,
      imageId: img ? img.id : null,
      imageUrl: img ? img.url : null,
    });
  }

  return items;
}

/** ================= PRODUCTS HANDLER ================= */
function handleProducts_(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const imageMap = getImageMapCached_();

  let sheets = [];
  if (type === "BS") sheets = [SHEET_MAP.BS];
  else if (type === "T") sheets = [SHEET_MAP.T];
  else sheets = [SHEET_MAP.BS, SHEET_MAP.T];

  let items = [];
  for (const sheetName of sheets) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) {
      return json_({ ok: false, error: `Missing sheet: ${sheetName}` });
    }
    items = items.concat(parseSheetItems_(sh, imageMap));
  }

  items.sort((a, b) => {
    const tA = getTier_(a);
    const tB = getTier_(b);
    if (tA !== tB) return tA - tB;

    if (tA === 0) {
      const c0 = tier0Compare_(a, b);
      if (c0 !== 0) return c0;
    }
    return String(a.maCay || "").localeCompare(String(b.maCay || ""), "vi");
  });

  return json_({
    ok: true,
    imgVersion: getImgVersion_(),
    dataVersion: getDataVersion_(),
    total: items.length,
    items,
    meta: {
      cacheSeconds: IMAGE_MAP_CACHE_SECONDS,
      type: type || "All",
      sheets,
      hidePublicPrice: HIDE_PUBLIC_PRICE,
      filterFallbackToPublicPrice: FILTER_FALLBACK_TO_PUBLIC_PRICE,
    },
  });
}

/** ================= BOOKING ================= */
function handleBookingSubmit_(e) {
  const payload = parseBookingPayload_(e);
  validateBookingPayload_(payload);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(BOOKING_SHEET_NAME);
  if (!sh) {
    throw new Error(`Missing sheet: ${BOOKING_SHEET_NAME}`);
  }

  const bookingCode = generateBookingCode_();
  const createdAt = new Date();

  appendBookingRow_(sh, {
    bookingCode: bookingCode,
    createdAt: createdAt,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    date: payload.date,
    time: payload.time,
    note: payload.note,
    source: payload.source || BOOKING_SOURCE,
    status: "Mới",
  });

  sendOwnerBookingEmail_({
    bookingCode: bookingCode,
    createdAt: createdAt,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    date: payload.date,
    time: payload.time,
    note: payload.note,
  });

  if (payload.email) {
    sendCustomerBookingEmail_({
      bookingCode: bookingCode,
      name: payload.name,
      email: payload.email,
      date: payload.date,
      time: payload.time,
      note: payload.note,
    });
  }

  return json_({
    ok: true,
    bookingCode: bookingCode,
    message: "Booking created successfully",
  });
}

function parseBookingPayload_(e) {
  const raw =
    e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  const data = JSON.parse(raw);

  return {
    name: String(data?.name || "").trim(),
    phone: String(data?.phone || "").trim(),
    email: String(data?.email || "").trim(),
    date: String(data?.date || "").trim(),
    time: String(data?.time || "").trim(),
    note: String(data?.note || "").trim(),
    website: String(data?.website || "").trim(),
    source: String(data?.source || BOOKING_SOURCE).trim(),
  };
}

function validateBookingPayload_(payload) {
  if (payload.website) {
    throw new Error("Spam detected");
  }

  if (!payload.name) {
    throw new Error("Thiếu họ tên");
  }

  if (!payload.phone) {
    throw new Error("Thiếu số điện thoại");
  }

  if (!/^(0|\+84)\d{9}$/.test(payload.phone.replace(/\s/g, ""))) {
    throw new Error("Số điện thoại không hợp lệ");
  }

  if (!payload.date) {
    throw new Error("Thiếu ngày tham quan");
  }

  if (!payload.time) {
    throw new Error("Thiếu giờ hẹn");
  }
}

function generateBookingCode_() {
  const ts = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyMMddHHmmssSSS",
  );
  const rand = Math.floor(Math.random() * 900 + 100);
  return "DL" + ts + rand;
}

function appendBookingRow_(sh, data) {
  sh.appendRow([
    data.bookingCode,
    data.createdAt,
    data.name,
    data.phone,
    data.email,
    data.date,
    data.time,
    data.note,
    data.source,
    data.status,
  ]);
}

function sendOwnerBookingEmail_(data) {
  const subject = `🔔 Có khách đặt lịch tham quan: ${data.name} (${data.bookingCode})`;

  const body =
    "Vườn Mai Gò Cát vừa nhận được một lịch hẹn mới.\n\n" +
    `Mã đặt lịch: ${data.bookingCode}\n` +
    `Thời gian tạo: ${formatDateTimeVN_(data.createdAt)}\n` +
    `Họ tên: ${data.name}\n` +
    `Số điện thoại: ${data.phone}\n` +
    `Email: ${data.email || "(không có)"}\n` +
    `Ngày tham quan: ${data.date}\n` +
    `Giờ hẹn: ${data.time}\n` +
    `Ghi chú: ${data.note || "(không có)"}\n`;

  MailApp.sendEmail({
    to: BOOKING_OWNER_EMAIL,
    subject: subject,
    body: body,
  });
}

function sendCustomerBookingEmail_(data) {
  const subject = `✅ Xác nhận đặt lịch tham quan - Vườn Mai Gò Cát (${data.bookingCode})`;

  const body =
    `Xin chào ${data.name},\n\n` +
    "Vườn Mai Gò Cát đã nhận được yêu cầu đặt lịch tham quan của bạn.\n\n" +
    `Mã đặt lịch: ${data.bookingCode}\n` +
    `Ngày tham quan: ${data.date}\n` +
    `Giờ hẹn: ${data.time}\n` +
    `Ghi chú: ${data.note || "(không có)"}\n\n` +
    "Đội ngũ của chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.\n\n" +
    "Trân trọng,\nVườn Mai Gò Cát";

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: body,
  });
}

function formatDateTimeVN_(d) {
  return Utilities.formatDate(
    new Date(d),
    Session.getScriptTimeZone(),
    "dd/MM/yyyy HH:mm:ss",
  );
}

/** ================= AUTH ================= */

const USERS_SHEET_NAME = "Users";

function handleRegister_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const password = String(data?.password || "").trim();
  const name = String(data?.name || "").trim();

  if (!email || !password || !name) {
    throw new Error("Thiếu thông tin đăng ký");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sh) throw new Error("Missing Users sheet");

  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const existingEmail = String(rows[i][0] || "").toLowerCase();
    if (existingEmail === email) {
      throw new Error("Email đã tồn tại");
    }
  }

  const passwordHash = hashPassword_(password);

  sh.appendRow([
    email, // A - email
    passwordHash, // B - passwordHash
    name, // C - name
    "", // D - phone
    "", // E - birthDate
    "", // F - gender
    new Date(), // G - createdAt
    "", // H - avatarUrl
  ]);

  return json_({
    ok: true,
    user: { email, name, avatarUrl: "" },
  });
}

function handleRegisterWithOtp_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const password = String(data?.password || "").trim();
  const name = String(data?.name || "").trim();
  const otp = String(data?.otp || "").trim();

  if (!email || !password || !name || !otp) {
    throw new Error("Thiếu thông tin");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const otpSheet = ss.getSheetByName(OTP_SHEET_NAME);

  if (!usersSheet) throw new Error("Missing Users sheet");
  if (!otpSheet) throw new Error("Missing OTP sheet");

  const userRows = usersSheet.getDataRange().getValues();
  for (let i = 1; i < userRows.length; i++) {
    const existingEmail = String(userRows[i][0] || "").toLowerCase();
    if (existingEmail === email) {
      throw new Error("Email đã tồn tại");
    }
  }

  const rows = otpSheet.getDataRange().getValues();
  const now = Date.now();

  let otpValid = false;

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][0] || "")
      .trim()
      .toLowerCase();
    const rowOtp = String(rows[i][1] || "").trim();
    const expiredAt = new Date(rows[i][2]).getTime();
    const used = rows[i][3] === true;

    if (rowEmail === email && rowOtp === otp) {
      if (now > expiredAt) {
        throw new Error("OTP đã hết hạn");
      }

      if (used) {
        throw new Error("OTP đã được sử dụng");
      }

      otpValid = true;

      otpSheet.getRange(i + 1, 4).setValue(true);
      break;
    }
  }

  if (!otpValid) {
    throw new Error("OTP không đúng");
  }

  const passwordHash = hashPassword_(password);

  usersSheet.appendRow([email, passwordHash, name, "", "", "", new Date(), ""]);

  return json_({
    ok: true,
    user: {
      email,
      name,
      avatarUrl: "",
    },
  });
}

function handleLogin_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const password = String(data?.password || "").trim();
  const passwordHash = hashPassword_(password);

  if (!email || !password) {
    throw new Error("Thiếu email hoặc mật khẩu");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sh) throw new Error("Missing Users sheet");

  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][0] || "").toLowerCase();
    const rowPassword = String(rows[i][1] || "");

    const passwordMatched = rowPassword === passwordHash;

    if (rowEmail === email && passwordMatched) {
      return json_({
        ok: true,
        user: {
          email: rowEmail,
          name: String(rows[i][2] || ""),
          phone: String(rows[i][3] || ""),
          avatarUrl: String(rows[i][7] || ""), // 🔥 Thêm avatarUrl
        },
      });
    }
  }

  throw new Error("Email hoặc mật khẩu không đúng");
}

function handleGoogleLogin_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const name = String(data?.name || "").trim();
  const avatarUrl = String(data?.avatarUrl || "").trim();

  if (!email) {
    throw new Error("Thiếu email Google");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sh) throw new Error("Missing Users sheet");

  const rows = sh.getDataRange().getValues();

  // 🔎 check user tồn tại
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][0] || "").toLowerCase();

    if (rowEmail === email) {
      return json_({
        ok: true,
        user: {
          email,
          name: rows[i][2] || name,
          phone: rows[i][3] || "",
          avatarUrl: rows[i][7] || avatarUrl,
        },
      });
    }
  }

  // 🆕 nếu chưa có → tạo mới
  sh.appendRow([
    email, // A
    "", // B password (Google không cần)
    name, // C
    "", // D phone
    "", // E birthDate
    "", // F gender
    new Date(), // G createdAt
    avatarUrl, // H avatar
  ]);

  return json_({
    ok: true,
    user: {
      email,
      name,
      avatarUrl,
    },
  });
}

function handleUpdateProfile_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const name = String(data?.name || "").trim();
  const phone = String(data?.phone || "").trim();
  const birthDate = String(data?.birthDate || "").trim();
  const gender = String(data?.gender || "").trim();

  if (!email) {
    throw new Error("Thiếu email");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sh) throw new Error("Missing Users sheet");

  const rows = sh.getDataRange().getValues();

  const COL_EMAIL = 0;
  const COL_NAME = 2;
  const COL_PHONE = 3;
  const COL_BIRTH = 4;
  const COL_GENDER = 5;

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][COL_EMAIL] || "").toLowerCase();

    if (rowEmail === email) {
      sh.getRange(i + 1, COL_NAME + 1).setValue(name);
      sh.getRange(i + 1, COL_PHONE + 1).setValue(phone);
      sh.getRange(i + 1, COL_BIRTH + 1).setValue(birthDate);
      sh.getRange(i + 1, COL_GENDER + 1).setValue(gender);

      return json_({
        ok: true,
        user: {
          email,
          name,
          phone,
          avatarUrl: String(rows[i][7] || ""),
        },
      });
    }
  }

  throw new Error("Không tìm thấy user");
}

function handleChangePassword_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const currentPassword = String(data?.currentPassword || "").trim();
  const newPassword = String(data?.newPassword || "").trim();

  if (!email || !currentPassword || !newPassword) {
    throw new Error("Thiếu thông tin đổi mật khẩu");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sh) throw new Error("Missing Users sheet");

  const rows = sh.getDataRange().getValues();

  const COL_EMAIL = 0;
  const COL_PASSWORD = 1;

  const currentPasswordHash = hashPassword_(currentPassword);
  const newPasswordHash = hashPassword_(newPassword);

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][COL_EMAIL] || "")
      .trim()
      .toLowerCase();
    const rowPassword = String(rows[i][COL_PASSWORD] || "").trim();

    const matched = rowPassword === currentPasswordHash;

    if (rowEmail === email) {
      if (!matched) {
        throw new Error("Mật khẩu hiện tại không đúng");
      }

      sh.getRange(i + 1, COL_PASSWORD + 1).setValue(newPasswordHash);

      return json_({
        ok: true,
        message: "Đổi mật khẩu thành công",
      });
    }
  }

  throw new Error("Không tìm thấy user");
}

function handleGetProfile_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error("Thiếu email");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sh) throw new Error("Missing Users sheet");

  const rows = sh.getDataRange().getValues();

  const COL_EMAIL = 0;
  const COL_NAME = 2;
  const COL_PHONE = 3;
  const COL_BIRTH = 4;
  const COL_GENDER = 5;

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][COL_EMAIL] || "")
      .trim()
      .toLowerCase();

    if (rowEmail === email) {
      return json_({
        ok: true,
        user: {
          email: rowEmail,
          name: String(rows[i][COL_NAME] || "").trim(),
          phone: String(rows[i][COL_PHONE] || "").trim(),
          birthDate: String(rows[i][COL_BIRTH] || "").trim(),
          gender: String(rows[i][COL_GENDER] || "").trim(),
          avatarUrl: String(rows[i][7] || ""), // 🔥 Thêm avatarUrl
        },
      });
    }
  }

  throw new Error("Không tìm thấy user");
}

/** 🔥 NEW: Upload Avatar */
function handleUploadAvatar_(data) {
  try {
    const { email, fileName, fileData } = data;

    Logger.log("=== handleUploadAvatar_ START ===");
    Logger.log("email = " + email);
    Logger.log("fileName = " + fileName);
    Logger.log("fileData exists = " + !!fileData);
    Logger.log("fileData length = " + (fileData ? fileData.length : 0));

    if (!email || !fileData) {
      throw new Error("Thiếu dữ liệu uploadAvatar");
    }

    const match = fileData.match(/^data:(.*);base64,/);
    Logger.log("match base64 = " + !!match);

    if (!match) {
      throw new Error("fileData không đúng định dạng base64");
    }

    const contentType = match[1];
    Logger.log("contentType = " + contentType);

    const base64Data = fileData.split(",")[1];
    Logger.log("base64Data exists = " + !!base64Data);

    if (!base64Data) {
      throw new Error("Không đọc được dữ liệu ảnh");
    }

    const bytes = Utilities.base64Decode(base64Data);
    Logger.log("bytes length = " + bytes.length);

    const blob = Utilities.newBlob(
      bytes,
      contentType,
      fileName || "avatar.png",
    );
    Logger.log("blob name = " + blob.getName());
    Logger.log("AVATAR_FOLDER_ID = " + AVATAR_FOLDER_ID);

    const folder = DriveApp.getFolderById(AVATAR_FOLDER_ID);
    Logger.log("folder name = " + folder.getName());

    const file = folder.createFile(blob);
    Logger.log("created file id = " + file.getId());

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    Logger.log("avatar url = " + url);

    const ss = SpreadsheetApp.openById(
      "14isgEVE4kjxr8QRqSB4GH60OFMIXgIApFqn_cKtvXf0",
    );
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) {
      throw new Error("Không tìm thấy sheet Users");
    }

    const dataRange = sheet.getDataRange().getValues();
    let foundUser = false;

    for (let i = 1; i < dataRange.length; i++) {
      const rowEmail = String(dataRange[i][0] || "").toLowerCase();
      Logger.log("checking rowEmail = " + rowEmail);

      if (rowEmail === email.toLowerCase()) {
        sheet.getRange(i + 1, 8).setValue(url);
        Logger.log("updated avatarUrl at row = " + (i + 1));
        foundUser = true;
        break;
      }
    }

    if (!foundUser) {
      throw new Error("Không tìm thấy user để cập nhật avatarUrl");
    }

    return json_({
      ok: true,
      avatarUrl: url,
    });
  } catch (err) {
    Logger.log("UPLOAD AVATAR ERROR = " + err);
    return json_({
      ok: false,
      error: err.toString(),
    });
  }
}

// helper parse JSON
function parseJson_(e) {
  const raw =
    e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  return JSON.parse(raw);
}

function hashPassword_(password) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8,
  );

  return raw
    .map((b) => {
      const v = b < 0 ? b + 256 : b;
      return ("0" + v.toString(16)).slice(-2);
    })
    .join("");
}

const OTP_SHEET_NAME = "OTP";
const OTP_EXPIRE_MINUTES = 5;

function generateOtp_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function handleSendOtp_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  if (!email) {
    throw new Error("Thiếu email");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const otpSheet = ss.getSheetByName(OTP_SHEET_NAME);

  if (!usersSheet) throw new Error("Missing Users sheet");
  if (!otpSheet) throw new Error("Missing OTP sheet");

  const userRows = usersSheet.getDataRange().getValues();

  for (let i = 1; i < userRows.length; i++) {
    const existingEmail = String(userRows[i][0] || "")
      .trim()
      .toLowerCase();
    if (existingEmail === email) {
      throw new Error("Email đã tồn tại");
    }
  }

  const cache = CacheService.getScriptCache();
  const key = "OTP_COOLDOWN_" + email;

  if (cache.get(key)) {
    throw new Error("Vui lòng chờ 30 giây trước khi gửi lại OTP");
  }

  cache.put(key, "1", 30);

  const otp = generateOtp_();
  const expiredAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

  const otpRows = otpSheet.getDataRange().getValues();

  for (let i = otpRows.length; i >= 2; i--) {
    const rowEmail = String(otpRows[i - 1][0] || "")
      .trim()
      .toLowerCase();
    if (rowEmail === email) {
      otpSheet.deleteRow(i);
    }
  }

  otpSheet.appendRow([email, otp, expiredAt, false]);

  MailApp.sendEmail({
    to: email,
    subject: "Mã OTP đăng ký tài khoản - Vườn Mai Gò Cát",
    body:
      "Xin chào,\n\n" +
      `Mã OTP đăng ký tài khoản của bạn là: ${otp}\n` +
      `Mã có hiệu lực trong ${OTP_EXPIRE_MINUTES} phút.\n\n` +
      "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.\n\n" +
      "Trân trọng,\nVườn Mai Gò Cát",
  });

  return json_({
    ok: true,
    message: "Đã gửi OTP",
  });
}

function handleVerifyOtp_(e) {
  const data = parseJson_(e);

  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const otp = String(data?.otp || "").trim();

  if (!email || !otp) {
    throw new Error("Thiếu email hoặc OTP");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const otpSheet = ss.getSheetByName(OTP_SHEET_NAME);
  if (!otpSheet) throw new Error("Missing OTP sheet");

  const rows = otpSheet.getDataRange().getValues();
  const now = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = String(rows[i][0] || "")
      .trim()
      .toLowerCase();
    const rowOtp = String(rows[i][1] || "").trim();
    const rowExpiredAt = new Date(rows[i][2]).getTime();

    if (rowEmail === email && rowOtp === otp) {
      if (now > rowExpiredAt) {
        throw new Error("Mã OTP đã hết hạn");
      }

      const alreadyUsed = rows[i][3] === true;
      if (alreadyUsed) {
        throw new Error("OTP đã được sử dụng");
      }

      otpSheet.getRange(i + 1, 4).setValue(true);

      const cache = CacheService.getScriptCache();
      cache.put("OTP_VERIFIED_" + email, "true", 300);

      return json_({
        ok: true,
        message: "OTP hợp lệ",
      });
    }
  }

  throw new Error("OTP không đúng");
}

function testDrivePermission() {
  const folder = DriveApp.getFolders().next();
  Logger.log(folder.getName());
}

function forceAuthorize2() {
  const folder = DriveApp.getRootFolder();

  // 🔥 bắt buộc phải có hành động thật
  const files = folder.getFiles();
  if (files.hasNext()) {
    const file = files.next();
    Logger.log(file.getName());
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(ss.getName());
}

function testCreateFile() {
  const folder = DriveApp.getRootFolder();
  const file = folder.createFile("test.txt", "hello");
  Logger.log(file.getId());
}
