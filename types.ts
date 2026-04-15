// src/types.ts

export type Page =
  | "home"
  | "products"
  | "product-detail"
  | "booking"
  | "contact"
  | "admin";

/**
 * Product dùng cho web Vườn Mai Gò Cát
 * - Các field số có thể null để tránh bug khi data thiếu
 * - KHÔNG dùng undefined để dễ kiểm soát render
 */
export interface Product {
  /** ID hiển thị & dùng nội bộ (vd: "BS01") */
  id: string;

  /** Tên hiển thị (vd: "Mai BS01") */
  name: string;

  /** Giá bán theo đơn vị triệu – null = Liên hệ */
  price: number | null;

  /** Giá thuê theo đơn vị triệu – null = Liên hệ */
  rentPrice: number | null;

  /** Phân loại hiển thị */
  category: "Mai Bonsai" | "Mai Tàng" | "Khác";

  /** Chiều cao cây (m) */
  height: number | null;

  /** Tán / ngang cây (m) */
  width: number | null;

  /** Tuổi cây (nếu có) */
  age: number | null;

  /** Ảnh chính */
  image: string | null;

  /** Ảnh phụ */
  thumbnails: string[];

  /** Mô tả chi tiết */
  description: string;

  /** Hoành cây (cm) */
  hoanh_cm: number | null;

  /** Đường kính chậu (m) */
  chau_m: number | null;

  /** Trạng thái */
  isRented: boolean;
  isSold: boolean;
}

// ================= AUTH =================

export interface AuthUser {
  name: string;
  email: string;

  phone: string;        // luôn có (có thể rỗng "")
  birthDate: string;    // luôn có (có thể rỗng "")
  gender: string;       // luôn có (có thể rỗng "")
  createdAt: string;    // luôn có (có thể rỗng "")
  avatarUrl: string;    // luôn có (có thể rỗng "")

  role: "user" | "admin";
  permissions: string[];
}

export const DEFAULT_USER: AuthUser = {
  name: "",
  email: "",
  phone: "",
  birthDate: "",
  gender: "",
  createdAt: "",
  avatarUrl: "",
  role: "user",
  permissions: [],
};

const normalizePermissions = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }
    } catch {
      // fallback nếu backend trả string thường
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export function normalizeAuthUser(
  user: Partial<AuthUser> | null | undefined,
): AuthUser {
  return {
    name: String(user?.name || ""),
    email: String(user?.email || ""),
    phone: String(user?.phone || ""),
    birthDate: String(user?.birthDate || ""),
    gender: String(user?.gender || ""),
    createdAt: String(user?.createdAt || ""),
    avatarUrl: String(user?.avatarUrl || ""),
    role: String(user?.role || "").toLowerCase() === "admin" ? "admin" : "user",
    permissions: normalizePermissions(user?.permissions),
  };
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// ================= GOOGLE AUTH =================

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

// ================= BOOKING =================

export interface Booking {
  maDatLich: string;

  thoiGianTao: string;

  hoTen: string;
  soDienThoai: string;
  email: string;

  ngayThamQuan: string;
  gioHen: string;

  ghiChu: string;

  nguon: string;

  trangThai: "Mới" | "Đã xác nhận" | "Đã hủy";
}