import administrativeCentersData from "../data/vnAdministrativeCenters.json";

type ProvinceRecord = (typeof administrativeCentersData)["provinces"][number];
type WardRecord = (typeof administrativeCentersData)["wards"][number];

export type { ProvinceRecord, WardRecord };

export type AdministrativeFocus = {
  level: "province" | "ward";
  province: ProvinceRecord;
  ward?: WardRecord;
  centerLat: number;
  centerLng: number;
  bounds: [[number, number], [number, number]];
  label: string;
};

const provinces = [...administrativeCentersData.provinces].sort((a, b) =>
  a.fullName.localeCompare(b.fullName, "vi"),
);
const wards = [...administrativeCentersData.wards];

const wardsByProvince = wards.reduce<Map<string, WardRecord[]>>((acc, ward) => {
  const current = acc.get(ward.provinceCode) || [];
  current.push(ward);
  acc.set(ward.provinceCode, current);
  return acc;
}, new Map());

for (const [provinceCode, items] of wardsByProvince.entries()) {
  wardsByProvince.set(
    provinceCode,
    [...items].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")),
  );
}

const EXTRA_PROVINCE_ALIASES: Record<string, string[]> = {
  "79": ["hcm", "tphcm", "tp hcm", "hcmc", "sai gon", "saigon"],
  "01": ["hn", "hanoi"],
  "48": ["dn", "danang", "da nang"],
  "31": ["hp", "haiphong", "hai phong"],
  "92": ["ct", "cantho", "can tho"],
};

const normalizeText = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (char) => (char === "đ" ? "d" : "D"))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toCompact = (value: string) => normalizeText(value).replace(/\s+/g, "");

const stripProvincePrefix = (value: string) =>
  normalizeText(value).replace(/^(tinh|thanh pho|tp)\s+/, "");

const stripWardPrefix = (value: string) =>
  normalizeText(value).replace(/^(phuong|p|xa|x|thi tran|tt|dac khu|dk)\s+/, "");

const toAcronym = (value: string) => {
  const words = normalizeText(value)
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "";
  return words.map((word) => word[0]).join("");
};

const uniqueList = (items: string[]) => {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(normalized);
  }
  return results;
};

const buildProvinceAliases = (province: ProvinceRecord) => {
  const codeName = String(province.codeName || "").replace(/_/g, " ");
  const base = [
    province.name,
    province.fullName,
    codeName,
    stripProvincePrefix(province.name),
    stripProvincePrefix(province.fullName),
    toAcronym(stripProvincePrefix(province.name)),
    toAcronym(stripProvincePrefix(province.fullName)),
    ...(EXTRA_PROVINCE_ALIASES[province.code] || []),
  ];

  const normalized = uniqueList(base);
  const compact = normalized.map(toCompact).filter(Boolean);
  return uniqueList([...normalized, ...compact]);
};

const buildWardAliases = (ward: WardRecord) => {
  const codeName = String(ward.codeName || "").replace(/_/g, " ");
  const base = [
    ward.name,
    ward.fullName,
    codeName,
    stripWardPrefix(ward.name),
    stripWardPrefix(ward.fullName),
    toAcronym(stripWardPrefix(ward.name)),
    toAcronym(stripWardPrefix(ward.fullName)),
  ];

  const normalized = uniqueList(base);
  const compact = normalized.map(toCompact).filter(Boolean);
  return uniqueList([...normalized, ...compact]);
};

const provinceAliasesByCode = new Map<string, string[]>(
  provinces.map((province) => [province.code, buildProvinceAliases(province)]),
);

const wardAliasesByCode = new Map<string, string[]>(
  wards.map((ward) => [ward.code, buildWardAliases(ward)]),
);

const scoreAliases = (query: string, aliases: string[]) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;
  const compactQuery = toCompact(normalizedQuery);
  let bestScore: number | null = null;

  for (const alias of aliases) {
    const compactAlias = alias.includes(" ") ? toCompact(alias) : alias;
    let score: number | null = null;

    if (alias === normalizedQuery || compactAlias === compactQuery) {
      score = 0;
    } else if (alias.startsWith(normalizedQuery)) {
      score = 10 + alias.length / 1000;
    } else if (compactAlias.startsWith(compactQuery)) {
      score = 20 + compactAlias.length / 1000;
    } else if (alias.includes(normalizedQuery)) {
      score = 30 + alias.length / 1000;
    } else if (compactAlias.includes(compactQuery)) {
      score = 40 + compactAlias.length / 1000;
    }

    if (score != null && (bestScore == null || score < bestScore)) {
      bestScore = score;
    }
  }

  return bestScore;
};

const rankItems = <T extends { code: string; fullName: string }>(
  query: string,
  items: T[],
  aliasLookup: Map<string, string[]>,
  limit: number,
) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return items.slice(0, limit);
  }

  return items
    .map((item) => ({
      item,
      score: scoreAliases(normalizedQuery, aliasLookup.get(item.code) || []),
    }))
    .filter((entry) => entry.score != null)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return (a.score || 0) - (b.score || 0);
      }
      return a.item.fullName.localeCompare(b.item.fullName, "vi");
    })
    .slice(0, limit)
    .map((entry) => entry.item);
};

export const getProvinceSuggestions = (query: string, limit = 12) =>
  rankItems(query, provinces, provinceAliasesByCode, limit);

const getWardCandidates = (provinceInput?: string) => {
  const provinceMatch = provinceInput ? findProvinceMatch(provinceInput) : null;
  if (provinceMatch) {
    return wardsByProvince.get(provinceMatch.code) || [];
  }
  return wards;
};

export const getWardSuggestions = (
  provinceInput: string,
  wardInput: string,
  limit = 12,
) => {
  const candidates = getWardCandidates(provinceInput);
  return rankItems(wardInput, candidates, wardAliasesByCode, limit);
};

export const findProvinceMatch = (input: string): ProvinceRecord | null => {
  const matches = getProvinceSuggestions(input, 5);
  if (!matches.length) return null;
  const best = matches[0];
  const bestScore = scoreAliases(input, provinceAliasesByCode.get(best.code) || []);
  if (bestScore == null || bestScore > 40.5) return null;
  return best;
};

export const findWardMatch = (
  provinceInput: string,
  wardInput: string,
): WardRecord | null => {
  const candidates = getWardCandidates(provinceInput);
  if (!wardInput.trim() || !candidates.length) return null;

  const ranked = rankItems(wardInput, candidates, wardAliasesByCode, 5);
  if (!ranked.length) return null;
  const best = ranked[0];
  const bestScore = scoreAliases(wardInput, wardAliasesByCode.get(best.code) || []);
  if (bestScore == null || bestScore > 40.5) return null;
  return best;
};

const buildBounds = (value: {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}): [[number, number], [number, number]] => [
  [value.minLat, value.minLng],
  [value.maxLat, value.maxLng],
];

export const resolveAdministrativeFocus = (
  provinceInput?: string,
  wardInput?: string,
): AdministrativeFocus | null => {
  const province = provinceInput ? findProvinceMatch(provinceInput) : null;
  const ward = wardInput ? findWardMatch(provinceInput || "", wardInput) : null;

  if (province && ward && ward.provinceCode === province.code) {
    return {
      level: "ward",
      province,
      ward,
      centerLat: ward.centerLat,
      centerLng: ward.centerLng,
      bounds: buildBounds(ward),
      label: `${ward.fullName}, ${province.fullName}`,
    };
  }

  if (province) {
    return {
      level: "province",
      province,
      centerLat: province.centerLat,
      centerLng: province.centerLng,
      bounds: buildBounds(province),
      label: province.fullName,
    };
  }

  if (ward) {
    const wardProvince = provinces.find((item) => item.code === ward.provinceCode);
    if (!wardProvince) return null;
    return {
      level: "ward",
      province: wardProvince,
      ward,
      centerLat: ward.centerLat,
      centerLng: ward.centerLng,
      bounds: buildBounds(ward),
      label: `${ward.fullName}, ${wardProvince.fullName}`,
    };
  }

  return null;
};
