import type { PaymentStatus } from "../types";

export interface PaymentStatusInput {
  totalAmount: number;
  paidAmount: number;
  depositAmount?: number | null;
}

const toSafeNumber = (value: unknown) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, num);
};

export const derivePaymentStatus = ({
  totalAmount,
  paidAmount,
  depositAmount,
}: PaymentStatusInput): PaymentStatus => {
  const total = toSafeNumber(totalAmount);
  const paid = toSafeNumber(paidAmount);
  const deposit = toSafeNumber(depositAmount);
  const remaining = Math.max(0, total - paid);

  if (paid <= 0) return "unpaid";
  if (remaining <= 0 || (total > 0 && paid >= total)) return "paid";
  if (deposit > 0 && paid <= deposit) return "deposit_paid";
  return "partial_paid";
};

export const getPaymentStatusTone = (status: PaymentStatus) => {
  switch (status) {
    case "unpaid":
      return "red";
    case "deposit_paid":
      return "amber";
    case "partial_paid":
      return "blue";
    case "paid":
      return "green";
    default:
      return "slate";
  }
};

export const getPaymentStatusClassName = (status: PaymentStatus) => {
  switch (status) {
    case "unpaid":
      return "bg-red-100 text-red-700 border-red-200";
    case "deposit_paid":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "partial_paid":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "paid":
      return "bg-green-100 text-green-700 border-green-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};
