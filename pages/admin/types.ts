import type { AuthUser } from "../../types";

export type AdminTab = "products" | "bookings" | "users" | "orders";

export interface AdminProps {
  authUser?: AuthUser | null;
  onBackToSite?: () => void;
}

export type ProductFormState = {
  id: string;
  category: string;
  rentPrice: string;
  price: string;
  height: string;
  width: string;
  hoanh: string;
  chau: string;
  note: string;
  daThue: boolean;
  daBan: boolean;
};
