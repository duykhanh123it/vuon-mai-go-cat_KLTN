import { useCallback, useEffect, useMemo, useState } from "react";
import type { CartItem, OrderTransactionType, Product } from "../types";
import {
  addOrIncreaseCartItem,
  buildCartItemFromProduct,
  clearCartStorage,
  getCartItemCount,
  getCartMode,
  getCartTotal,
  readCart,
  removeCartItem,
  updateCartItemQuantity,
  writeCart,
} from "../utils/cart";

type CartActionResult = {
  ok: boolean;
  message: string;
  items: CartItem[];
};

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>(() => readCart());

  useEffect(() => {
    writeCart(items);
  }, [items]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "vmgc_cart_v1") return;
      setItems(readCart());
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const replaceItems = useCallback((nextItems: CartItem[]) => {
    setItems(nextItems);
    writeCart(nextItems);
  }, []);

  const addProduct = useCallback(
    (
      product: Product,
      transactionType: OrderTransactionType,
      quantity = 1,
    ): CartActionResult => {
      try {
        const nextItem = buildCartItemFromProduct(product, transactionType);
        const nextItems = addOrIncreaseCartItem(items, nextItem, quantity);
        replaceItems(nextItems);

        const exists = items.some((item) => item.cartKey === nextItem.cartKey);
        return {
          ok: true,
          message: exists
            ? "Đã cập nhật số lượng trong giỏ hàng"
            : "Đã thêm sản phẩm vào giỏ hàng",
          items: nextItems,
        };
      } catch (error) {
        return {
          ok: false,
          message: String((error as any)?.message || error || "Không thể thêm vào giỏ hàng"),
          items,
        };
      }
    },
    [items, replaceItems],
  );

  const updateQuantity = useCallback(
    (cartKey: string, quantity: number): CartItem[] => {
      const nextItems = updateCartItemQuantity(items, cartKey, quantity);
      replaceItems(nextItems);
      return nextItems;
    },
    [items, replaceItems],
  );

  const removeItem = useCallback(
    (cartKey: string): CartItem[] => {
      const nextItems = removeCartItem(items, cartKey);
      replaceItems(nextItems);
      return nextItems;
    },
    [items, replaceItems],
  );

  const clearCart = useCallback(() => {
    setItems([]);
    clearCartStorage();
  }, []);

  const summary = useMemo(() => {
    const mode = getCartMode(items);
    return {
      mode,
      itemCount: getCartItemCount(items),
      totalAmount: getCartTotal(items),
    };
  }, [items]);

  return {
    items,
    setItems: replaceItems,
    addProduct,
    updateQuantity,
    removeItem,
    clearCart,
    mode: summary.mode,
    itemCount: summary.itemCount,
    totalAmount: summary.totalAmount,
  };
};
