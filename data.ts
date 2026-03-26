// src/data.ts

import raw from "./products_raw.json";
import { Product } from "./types";
import { normalizeCode, formatSpecs } from "./utils/productFormat";
import imageMap from "./imageMap.json";

/**
 * Kiểu dữ liệu gốc từ JSON (giữ nguyên key tiếng Việt)
 */
type RawRow = {
  "Mã Cây": string;
  "Giá Thuê (triệu)": number | null;
  "Giá Bán (triệu)": number | null;
  Cao_m: number | null;
  Ngang_m: number | null;
  Hoành_cm: number | null;
  Chậu_m: number | null;
};

/** Triệu → VND (number) */
const toVND = (million: number | null): number | null => {
  if (million == null) return null;
  const n = Number(million);
  return Number.isFinite(n) ? Math.round(n * 1_000_000) : null;
};

/** Số mét → chuỗi hiển thị (vd: 2.5 → "2.5m") */
const fmtMeter = (m: number | null): string | null => {
  if (m == null) return null;
  const n = Number(m);
  if (!Number.isFinite(n)) return null;
  return `${n}m`;
};

/** Code để hiển thị đẹp: "BS472" -> "BS 472", "BS01" -> "BS 01" */
const codeForDisplay = (code: string): string => code.replace(/^BS/, "BS ");

/**
 * DANH SÁCH SẢN PHẨM DÙNG CHO TOÀN BỘ WEB
 */
export const products: Product[] = (raw as RawRow[])
  .filter((row) => row && row["Mã Cây"])
  .map((row) => {
    // code chuẩn để khớp filename ảnh: BS01, BS47, BS472...
    const code = normalizeCode(row["Mã Cây"]);
    const displayCode = codeForDisplay(code);

    // Ảnh: chỉ trả path thật, UI sẽ onError -> fallback (no-avatar/notimg)
    const hasImage = Boolean((imageMap as Record<string, boolean>)[code]);
    const image = hasImage ? `/products/${code}.jpg` : "";

    // Specs sinh từ data (nếu thiếu thì null)
    const specsText = formatSpecs({
      Cao_m: row.Cao_m,
      Ngang_m: row.Ngang_m,
      Hoành_cm: row.Hoành_cm,
    });

    return {
      id: code,
      name: `Mai ${displayCode}`,

      category: "Mai Bonsai",

      price: toVND(row["Giá Bán (triệu)"]),
      rentPrice: toVND(row["Giá Thuê (triệu)"]),

      height: fmtMeter(row.Cao_m),
      width: fmtMeter(row.Ngang_m),
      age: null,

      image,
      thumbnails: hasImage ? [image] : [],

      // mô tả bớt “cứng”: ưu tiên show specs nếu có
      description: specsText
        ? `${specsText}. Vui lòng liên hệ để xem cây thực tế và nhận tư vấn chi tiết.`
        : `Mã cây ${displayCode}. Vui lòng liên hệ để xem cây thực tế và nhận tư vấn chi tiết.`,
    };
  });
