import type { Product } from "../../types";
import type { ProductsType } from "../../utils/productsApi";
import type { ProductFormState } from "./types";

export const RECENT_USER_DAYS = 7;

const DEFAULT_AVATAR_URLS = [
  "/no-avatar.png",
  "/no_avatar_fallback.png",
  "/avt.png",
];

export const formatPrice = (value: number | string | null | undefined) => {
  if (value == null || value === "") return "Liên hệ";
  const num =
    typeof value === "number"
      ? value
      : Number(
          String(value)
            .replace(/[^\d.,-]/g, "")
            .replace(/\./g, "")
            .replace(",", "."),
        );
  if (!Number.isFinite(num) || num <= 0) return "Liên hệ";
  return Number(num).toLocaleString("vi-VN") + "đ";
};

export const toMillionInput = (
  value: number | string | null | undefined,
) => {
  if (value == null || value === "") return "";
  const num =
    typeof value === "number"
      ? value
      : Number(
          String(value)
            .replace(/[^\d.,-]/g, "")
            .replace(/\./g, "")
            .replace(",", "."),
        );
  if (!Number.isFinite(num) || num <= 0) return "";
  const million = Number(num) / 1_000_000;
  return Number.isInteger(million)
    ? String(million)
    : String(million).replace(".", ",");
};

export const hasRealAvatar = (avatarUrl?: string | null) => {
  const value = String(avatarUrl || "").trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  return !DEFAULT_AVATAR_URLS.some((item) =>
    lower.endsWith(item.toLowerCase()),
  );
};

export const formatGender = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "--";
  const normalized = raw.toLowerCase();
  if (["nam", "male", "m"].includes(normalized)) return "Nam";
  if (["nữ", "nu", "female", "f"].includes(normalized)) return "Nữ";
  return raw;
};

export const extractUserNote = (description?: string | null) => {
  const s = String(description || "").trim();
  if (!s) return "";
  const idx = s.indexOf(". ");
  if (idx < 0) return s;
  const first = s.slice(0, idx).trim();
  const looksLikeSpecs =
    first.includes("·") || /Cao\s*~|Tán\s*~|Hoành\s*\d+/i.test(first);
  return looksLikeSpecs ? s.slice(idx + 2).trim() : s;
};

export const sortProductsForAdmin = (items: Product[]) => {
  return [...items].sort((a, b) => {
    const getNum = (id: string) =>
      parseInt(String(id || "").replace(/[^\d]/g, "")) || 0;
    return getNum(b.id) - getNum(a.id);
  });
};

export const buildProductStats = (items: Product[]) => {
  const bonsai = items.filter((p) => p.category === "Mai Bonsai").length;
  const tang = items.filter((p) => p.category === "Mai Tàng").length;
  return {
    total: items.length,
    bonsai,
    tang,
  };
};

export const matchesProductsType = (
  category: string,
  type: ProductsType,
) => {
  if (type === "All") return true;
  if (type === "BS") return category === "Mai Bonsai";
  if (type === "T") return category === "Mai Tàng";
  return true;
};

export const parseCommaNumber = (value: string) => {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, "");
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

export const parseMillionInputToVnd = (value: string) => {
  const num = parseCommaNumber(value);
  if (num == null || num <= 0) return null;
  return Math.round(num * 1_000_000);
};

export const buildProductDescriptionFromForm = (
  formData: ProductFormState,
) => {
  const parts: string[] = [];
  const height = parseCommaNumber(formData.height);
  const width = parseCommaNumber(formData.width);
  const chau = parseCommaNumber(formData.chau);
  const hoanh = formData.hoanh ? Number(formData.hoanh) : null;
  if (height != null) parts.push(`Cao ~ ${height}m`);
  if (width != null) parts.push(`Tán ~ ${width}m`);
  if (hoanh != null && Number.isFinite(hoanh)) parts.push(`Hoành ${hoanh}cm`);
  if (chau != null) parts.push(`Chậu ~ ${chau}m`);
  const specs = parts.join(" · ");
  const note = String(formData.note || "").trim();
  if (specs && note) return `${specs}. ${note}`;
  if (specs) return `${specs}.`;
  return note;
};

export const buildOptimisticProduct = (
  formData: ProductFormState,
  fallbackImage?: string | null,
): Product => {
  const normalizedId = String(formData.id || "")
    .trim()
    .toUpperCase();
  const image = String(fallbackImage || "").trim() || "/notimg.jpg";
  return {
    id: normalizedId,
    name: normalizedId || "Sản phẩm",
    category:
      formData.category === "Mai Tàng"
        ? "Mai Tàng"
        : formData.category === "Mai Bonsai"
          ? "Mai Bonsai"
          : "Khác",
    description: buildProductDescriptionFromForm(formData),
    image,
    thumbnails: image ? [image] : [],
    rentPrice: parseMillionInputToVnd(formData.rentPrice),
    price: parseMillionInputToVnd(formData.price),
    height: parseCommaNumber(formData.height),
    width: parseCommaNumber(formData.width),
    age: null,
    hoanh_cm: formData.hoanh ? Number(formData.hoanh) : null,
    chau_m: parseCommaNumber(formData.chau),
    isSold: formData.daBan === true,
    isRented: formData.daThue === true,
  };
};
