import type { AuthUser } from "../../types";

export type AdminTab = "products" | "orders" | "bookings" | "users";

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
