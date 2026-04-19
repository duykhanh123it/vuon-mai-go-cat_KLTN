import type { CartItem, OrderTransactionType, Product } from "../types";
import { clampPositiveInt, normalizeProductId } from "../types";

const CART_STORAGE_KEY = "vmgc_cart_v1";

const getStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const normalized = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : null;
};

const normalizeCartItem = (value: any): CartItem | null => {
  const productId = normalizeProductId(value?.productId);
  const transactionType: OrderTransactionType =
    String(value?.transactionType || "").trim().toLowerCase() === "buy"
      ? "buy"
      : String(value?.transactionType || "").trim().toLowerCase() === "rent"
        ? "rent"
        : "rent";

  const unitPrice = toNumber(value?.unitPrice);
  if (!productId || unitPrice == null || unitPrice <= 0) {
    return null;
  }

  return {
    cartKey: getCartItemKey(productId, transactionType),
    productId,
    name: String(value?.name || productId),
    category:
      value?.category === "Mai Bonsai" || value?.category === "Mai Tàng"
        ? value.category
        : "Khác",
    image: String(value?.image || "").trim() || null,
    transactionType,
    unitPrice,
    quantity: clampPositiveInt(value?.quantity ?? 1, 1),
    snapshotNote: String(value?.snapshotNote || "").trim(),
  };
};

export const getCartItemKey = (
  productId: string,
  transactionType: OrderTransactionType,
) => `${normalizeProductId(productId)}__${transactionType}`;

export const readCart = (): CartItem[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeCartItem(item))
      .filter(Boolean) as CartItem[];
  } catch {
    return [];
  }
};

export const writeCart = (items: CartItem[]): void => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
};

export const clearCartStorage = (): void => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const getCartMode = (
  items: CartItem[],
): OrderTransactionType | null => {
  if (!items.length) return null;

  const first = items[0]?.transactionType;
  if (first !== "rent" && first !== "buy") return null;

  const mixed = items.some((item) => item.transactionType !== first);
  return mixed ? null : first;
};

export const getCartItemCount = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + clampPositiveInt(item.quantity, 1), 0);

export const getCartSubtotal = (item: CartItem): number =>
  clampPositiveInt(item.quantity, 1) * Math.max(0, Number(item.unitPrice || 0));

export const getCartTotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + getCartSubtotal(item), 0);

export const buildCartItemFromProduct = (
  product: Product,
  transactionType: OrderTransactionType,
): CartItem => {
  if (product.isSold || product.isRented) {
    throw new Error("Cây này hiện không còn khả dụng để đặt hàng");
  }

  const productId = normalizeProductId(product.id);
  if (!productId) {
    throw new Error("Sản phẩm không hợp lệ");
  }

  const unitPrice =
    transactionType === "rent"
      ? Number(product.rentPrice || 0)
      : Number(product.price || 0);

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error(
      transactionType === "rent"
        ? "Sản phẩm này chưa có giá thuê để thêm vào giỏ"
        : "Sản phẩm này chưa có giá bán để thêm vào giỏ",
    );
  }

  return {
    cartKey: getCartItemKey(productId, transactionType),
    productId,
    name: String(product.name || productId),
    category: product.category,
    image: String(product.image || "").trim() || null,
    transactionType,
    unitPrice,
    quantity: 1,
    snapshotNote: String(product.description || "").trim(),
  };
};

export const addOrIncreaseCartItem = (
  items: CartItem[],
  item: CartItem,
  quantity = 1,
): CartItem[] => {
  const currentMode = getCartMode(items);

  if (currentMode === null && items.length > 0) {
    throw new Error(
      "Giỏ hàng đang chứa dữ liệu không hợp lệ. Vui lòng xóa giỏ hàng và thêm lại.",
    );
  }

  if (currentMode && currentMode !== item.transactionType) {
    throw new Error(
      "Backend hiện tại chỉ tạo 1 đơn cho 1 loại giao dịch. Vui lòng thanh toán hoặc xóa giỏ hiện tại trước khi đổi sang thuê/mua.",
    );
  }

  const safeQuantity = clampPositiveInt(quantity, 1);
  const existingIndex = items.findIndex(
    (cartItem) => cartItem.cartKey === item.cartKey,
  );

  if (existingIndex < 0) {
    return [...items, { ...item, quantity: safeQuantity }];
  }

  return items.map((cartItem, index) =>
    index === existingIndex
      ? {
          ...cartItem,
          quantity: clampPositiveInt(cartItem.quantity + safeQuantity, 1),
        }
      : cartItem,
  );
};

export const updateCartItemQuantity = (
  items: CartItem[],
  cartKey: string,
  quantity: number,
): CartItem[] => {
  const safeQuantity = clampPositiveInt(quantity, 1);
  return items.map((item) =>
    item.cartKey === cartKey ? { ...item, quantity: safeQuantity } : item,
  );
};

export const removeCartItem = (
  items: CartItem[],
  cartKey: string,
): CartItem[] => items.filter((item) => item.cartKey !== cartKey);
