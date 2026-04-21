import type { CartItem, CartMode, OrderTransactionType, Product } from "../types";
import { canProductTransactionProceed, resolveProductAvailability } from "./productAvailability";

export const CART_STORAGE_KEY = "vmgc_cart_v1";

const normalizeNumber = (value: unknown, fallback = 1) => {
  const num = Number(value || fallback);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.max(1, Math.trunc(num));
};

export const readCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        cartKey: String(item?.cartKey || ""),
        productId: String(item?.productId || ""),
        productName: String(item?.productName || ""),
        productCategory: item?.productCategory || "Khác",
        image: item?.image ? String(item.image) : null,
        transactionType: (item?.transactionType === "buy" ? "buy" : "rent") as OrderTransactionType,
        quantity: 1,
        unitPrice: Number(item?.unitPrice || 0),
        lineTotal: Number(item?.lineTotal || item?.unitPrice || 0),
        snapshotNote: String(item?.snapshotNote || ""),
      }))
      .filter((item) => item.cartKey && item.productId && item.unitPrice > 0);
  } catch {
    return [];
  }
};

export const writeCart = (items: CartItem[]) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

export const clearCartStorage = () => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const buildCartItemFromProduct = (
  product: Product,
  transactionType: OrderTransactionType,
): CartItem => {
  const availability = resolveProductAvailability(product);
  if (!canProductTransactionProceed(product, transactionType)) {
    throw new Error(availability.reason || "Sản phẩm hiện không thể thêm vào giỏ hàng.");
  }

  const unitPrice = transactionType === "buy" ? Number(product.price || 0) : Number(product.rentPrice || 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error("Sản phẩm chưa có giá công khai để đặt trực tuyến.");
  }

  return {
    cartKey: `${product.id}::${transactionType}`,
    productId: String(product.id || "").trim(),
    productName: String(product.name || product.id || "Sản phẩm"),
    productCategory: product.category,
    image: product.image || null,
    transactionType,
    quantity: 1,
    unitPrice,
    lineTotal: unitPrice,
    snapshotNote: String(product.description || "").trim().slice(0, 240),
  };
};

export const getCartMode = (items: CartItem[]): CartMode => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[0]?.transactionType === "buy" ? "buy" : "rent";
};

export const addOrIncreaseCartItem = (
  items: CartItem[],
  nextItem: CartItem,
  quantity = 1,
): CartItem[] => {
  const nextMode = nextItem.transactionType;
  const currentMode = getCartMode(items);
  if (currentMode && currentMode !== nextMode) {
    throw new Error(
      currentMode === "buy"
        ? "Giỏ hàng hiện đang là đơn bán. Hãy hoàn tất hoặc xoá giỏ trước khi thêm cây thuê."
        : "Giỏ hàng hiện đang là đơn thuê. Hãy hoàn tất hoặc xoá giỏ trước khi thêm cây bán.",
    );
  }

  const exists = items.find((item) => item.cartKey === nextItem.cartKey);
  if (exists) {
    return items.map((item) =>
      item.cartKey === nextItem.cartKey
        ? { ...item, quantity: 1, lineTotal: item.unitPrice }
        : item,
    );
  }

  const safeQuantity = normalizeNumber(quantity, 1);
  return [
    ...items,
    {
      ...nextItem,
      quantity: Math.min(1, safeQuantity),
      lineTotal: nextItem.unitPrice,
    },
  ];
};

export const updateCartItemQuantity = (
  items: CartItem[],
  cartKey: string,
  quantity: number,
): CartItem[] => {
  const safeQuantity = Math.min(1, normalizeNumber(quantity, 1));
  return items.map((item) =>
    item.cartKey === cartKey
      ? {
          ...item,
          quantity: safeQuantity,
          lineTotal: item.unitPrice * safeQuantity,
        }
      : item,
  );
};

export const removeCartItem = (items: CartItem[], cartKey: string): CartItem[] =>
  items.filter((item) => item.cartKey !== cartKey);

export const getCartItemCount = (items: CartItem[]) => items.length;

export const getCartTotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
