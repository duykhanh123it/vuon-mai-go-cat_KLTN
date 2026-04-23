import type { OrderTransactionType } from "../types";

export const SHOP_POLICY_VERSION = "2026-04-v1";
export const POLICY_PAGE_HASH = "#/chinh-sach-thue-mua";

export type PolicySection = "rent" | "buy";

export const buildPolicyHref = (section?: PolicySection) => {
  const params = new URLSearchParams();
  if (section) params.set("section", section);
  const query = params.toString();
  return query ? `${POLICY_PAGE_HASH}?${query}` : POLICY_PAGE_HASH;
};

export const getMinimumRentalDeposit = (
  totalAmount: number | null | undefined,
) => {
  const total = Math.max(0, Number(totalAmount || 0));
  if (!Number.isFinite(total) || total <= 0) return 0;
  const minByPercent = Math.round(total * 0.3);
  return Math.min(total, Math.max(500_000, minByPercent));
};

export const getPolicyAgreementLabel = (mode: OrderTransactionType) =>
  mode === "rent"
    ? "Tôi đã đọc và đồng ý Chính Sách Thuê & Mua, bao gồm thời hạn thuê 5 - 10 ngày, mức cọc tối thiểu, điều kiện gia hạn, hủy đơn và bồi thường nếu cây hư hỏng hoặc trả trễ."
    : "Tôi đã đọc và đồng ý Chính Sách Thuê & Mua, bao gồm quy trình giữ cây, giao hàng, thanh toán, hủy đơn và bàn giao cây mua.";

export const RENT_POLICY_HIGHLIGHTS = [
  "Giá thuê niêm yết áp dụng cho 1 chu kỳ thuê chuẩn từ 5 đến 10 ngày.",
  "Đơn thuê chỉ được giữ cây khi admin xác nhận và đã thu tối thiểu 30% tổng đơn hoặc 500.000đ tiền cọc.",
  "Gia hạn cần được admin chấp thuận trước, phụ phí sẽ chốt theo từng đơn thực tế.",
  "Trả trễ, làm hư hỏng, mất cây hoặc mất phụ kiện có thể bị phụ thu, khấu trừ cọc hoặc bồi thường.",
];

export const BUY_POLICY_HIGHLIGHTS = [
  "Đơn mua tạo xong vẫn ở trạng thái new, cây chỉ được giữ khi admin xác nhận.",
  "Nhà vườn có thể nhận cọc hoặc thanh toán một phần trước khi giao, tùy từng đơn.",
  "Đơn mua chỉ hoàn tất khi giao xong và đã thanh toán đủ.",
  "Hủy đơn sau khi admin đã giữ cây hoặc chuẩn bị giao có thể phát sinh khấu trừ cọc hoặc chi phí thực tế.",
];
