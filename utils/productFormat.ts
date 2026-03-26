// utils/productFormat.ts

export function normalizeCode(raw: unknown): string {
  // "BS 472" -> "BS472", "bs472" -> "BS472"
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function formatMillionsToVND(millions: number | null | undefined): string | null {
  if (millions == null) return null;
  const vnd = Math.round(millions * 1_000_000);
  return vnd.toLocaleString("vi-VN") + "đ";
}


export function formatSpecs(p: {
  Cao_m?: number | null;
  Ngang_m?: number | null;
  Hoành_cm?: number | null;
}): string | null {
  const parts: string[] = [];

  if (p.Cao_m != null) parts.push(`Cao ~${trim(p.Cao_m)}m`);
  if (p.Ngang_m != null) parts.push(`Tán ~${trim(p.Ngang_m)}m`);
  if (p.Hoành_cm != null) parts.push(`Hoành ${trim(p.Hoành_cm)}cm`);

  return parts.length ? parts.join(" · ") : null;
}

function trim(n: number): string {
  // Giữ tối đa 2 chữ số thập phân, không bị tách dòng
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}


