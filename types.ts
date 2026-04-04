// src/types.ts

export type Page =
  | "home"
  | "products"
  | "product-detail"
  | "booking"
  | "contact";

/**
 * Product dùng cho web Vườn Mai Gò Cát
 * - Các field số có thể null để tránh bug khi data thiếu
 * - KHÔNG dùng undefined để dễ kiểm soát render
 */
export interface Product {
  /** ID hiển thị & dùng nội bộ (vd: "BS 01") */
  id: string;

  /** Tên hiển thị (vd: "Mai BS 01") */
  name: string;

  /** Giá bán (VND) – null = Liên hệ */
  price: number | null;

  /** Giá thuê (VND) – null = Liên hệ */
  rentPrice: number | null;

  /** Phân loại hiển thị */
  category: "Mai Bonsai" | "Mai Tàng" | "Khác";

  /** Chiều cao (vd: "2.5m") */
  height: string | null;

  /** Tán / ngang (vd: "1.8m") */
  width: string | null;

  /** Tuổi cây (nếu có) */
  age: number | null;

  /** Ảnh chính */
  image: string;

  /** Ảnh phụ */
  thumbnails: string[];

  /** Mô tả chi tiết */
  description: string;

  /** ✅ NEW: trạng thái */
  isRented: boolean; // Đã thuê
  isSold: boolean;   // Đã bán
}

// ================= AUTH =================

export interface AuthUser {
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
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