import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getLocationDisplayInfo,
  type LocationConfidence,
  type LocationSource,
} from "../types";
import { resolveAdministrativeFocus } from "../utils/vnAdministrative";

declare global {
  interface Window {
    L?: any;
    __vmgcLeafletLoader?: Promise<any>;
  }
}

type CoordinateValue = number | null | undefined;

type Coordinates = {
  lat: CoordinateValue;
  lng: CoordinateValue;
};

type FocusBounds = [[number, number], [number, number]];

type StatusTone = "info" | "success" | "error";

type MapPinChange = {
  lat: number | null;
  lng: number | null;
  locationSource: LocationSource;
  locationConfidence: LocationConfidence;
};

interface MapPinPickerProps {
  lat?: number | null;
  lng?: number | null;
  locationSource?: LocationSource;
  locationConfidence?: LocationConfidence;
  onChange: (coords: MapPinChange) => void;
  className?: string;
  mapHeightClassName?: string;
  initialCenter?: {
    lat: number;
    lng: number;
  } | null;
  province?: string;
  ward?: string;
}

const LEAFLET_CSS_ID = "vmgc-leaflet-css";
const LEAFLET_SCRIPT_ID = "vmgc-leaflet-script";
const LEAFLET_CSS_HREF = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_SCRIPT_SRC = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const DEFAULT_CENTER = {
  lat: 10.7769,
  lng: 106.7009,
};
const DEFAULT_ZOOM = 12;
const PROVINCE_FOCUS_MAX_ZOOM = 11;
const WARD_FOCUS_MAX_ZOOM = 14;
const PIN_ZOOM = 17;

const normalizeCoordinate = (
  value: unknown,
  min: number,
  max: number,
): number | null => {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
};

const hasCoordinates = (value: Coordinates) =>
  typeof value.lat === "number" &&
  Number.isFinite(value.lat) &&
  typeof value.lng === "number" &&
  Number.isFinite(value.lng);

const ensureLeaflet = async () => {
  if (typeof window === "undefined") {
    throw new Error("Map chỉ hỗ trợ trên trình duyệt");
  }

  if (window.L) {
    return window.L;
  }

  if (window.__vmgcLeafletLoader) {
    return window.__vmgcLeafletLoader;
  }

  window.__vmgcLeafletLoader = new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_HREF;
      document.head.appendChild(link);
    }

    const resolveLeaflet = () => {
      if (window.L) {
        resolve(window.L);
        return;
      }
      reject(new Error("Không thể khởi tạo Leaflet"));
    };

    const rejectLeaflet = () => {
      reject(new Error("Không tải được thư viện bản đồ"));
    };

    const existingScript = document.getElementById(
      LEAFLET_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", resolveLeaflet, { once: true });
      existingScript.addEventListener("error", rejectLeaflet, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = LEAFLET_SCRIPT_ID;
    script.async = true;
    script.src = LEAFLET_SCRIPT_SRC;
    script.addEventListener("load", resolveLeaflet, { once: true });
    script.addEventListener("error", rejectLeaflet, { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    delete window.__vmgcLeafletLoader;
    throw error;
  });

  return window.__vmgcLeafletLoader;
};

const formatCoordinateText = (value: Coordinates) => {
  if (!hasCoordinates(value)) return "Chưa ghim vị trí";
  return `${value.lat!.toFixed(6)}, ${value.lng!.toFixed(6)}`;
};

const getStatusClasses = (tone: StatusTone) => {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
};

const getLocationBoxClasses = (
  confidence: "high" | "medium" | "low",
): string => {
  if (confidence === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (confidence === "medium") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const TargetIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2.75v2.5" />
    <path d="M12 18.75v2.5" />
    <path d="M2.75 12h2.5" />
    <path d="M18.75 12h2.5" />
  </svg>
);

const LoadingIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2"
      opacity="0.25"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const MapPinPicker: React.FC<MapPinPickerProps> = ({
  lat,
  lng,
  locationSource = "text_only",
  locationConfidence = "low",
  onChange,
  className = "",
  mapHeightClassName = "h-80",
  initialCenter,
  province = "",
  ward = "",
}) => {
  const selectedCoordinates = useMemo(
    () => ({
      lat: normalizeCoordinate(lat, -90, 90),
      lng: normalizeCoordinate(lng, -180, 180),
    }),
    [lat, lng],
  );

  const locationInfo = useMemo(
    () =>
      getLocationDisplayInfo({
        lat: selectedCoordinates.lat,
        lng: selectedCoordinates.lng,
        locationSource,
        locationConfidence,
      }),
    [locationConfidence, locationSource, selectedCoordinates.lat, selectedCoordinates.lng],
  );

  const preferredFocus = useMemo(
    () => resolveAdministrativeFocus(province, ward),
    [province, ward],
  );

  const focusKey = preferredFocus
    ? `${preferredFocus.level}:${preferredFocus.province.code}:${preferredFocus.ward?.code || ""}`
    : "";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [isMapReady, setIsMapReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const syncMarker = (coords: Coordinates, options?: { center?: boolean }) => {
    const map = mapRef.current;
    const leaflet = typeof window !== "undefined" ? window.L : null;
    if (!map || !leaflet) return;

    if (hasCoordinates(coords)) {
      const latlng = leaflet.latLng(coords.lat, coords.lng);
      if (!markerRef.current) {
        markerRef.current = leaflet.marker(latlng).addTo(map);
      } else {
        markerRef.current.setLatLng(latlng);
      }

      if (options?.center) {
        map.setView(latlng, Math.max(map.getZoom?.() || DEFAULT_ZOOM, PIN_ZOOM));
      }
      return;
    }

    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  };

  const applyAdministrativeFocus = (
    bounds: FocusBounds,
    center: { lat: number; lng: number },
    level: "province" | "ward",
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const maxZoom = level === "ward" ? WARD_FOCUS_MAX_ZOOM : PROVINCE_FOCUS_MAX_ZOOM;
    try {
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom,
      });
    } catch {
      map.setView([center.lat, center.lng], maxZoom);
    }
  };

  const initialMapCenterRef = useRef<{
    lat: number;
    lng: number;
  } | null>(null);

  if (!initialMapCenterRef.current) {
    initialMapCenterRef.current = hasCoordinates(selectedCoordinates)
      ? {
          lat: selectedCoordinates.lat,
          lng: selectedCoordinates.lng,
        }
      : preferredFocus
        ? {
            lat: preferredFocus.centerLat,
            lng: preferredFocus.centerLng,
          }
        : initialCenter || DEFAULT_CENTER;
  }

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      try {
        setLoadError("");
        const leaflet = await ensureLeaflet();
        if (cancelled || !containerRef.current || mapRef.current) {
          if (!cancelled) {
            setIsMapReady(true);
          }
          return;
        }

        const center = initialMapCenterRef.current || DEFAULT_CENTER;

        const map = leaflet.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        });
        map.setView(
          [center.lat, center.lng],
          hasCoordinates(selectedCoordinates)
            ? PIN_ZOOM
            : preferredFocus?.level === "ward"
              ? WARD_FOCUS_MAX_ZOOM
              : DEFAULT_ZOOM,
        );

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          })
          .addTo(map);

        try {
          map.attributionControl?.setPosition?.("bottomleft");
        } catch {
          // ignore attribution control positioning errors
        }

        map.on("click", (event: any) => {
          const next = {
            lat: Number(event.latlng.lat.toFixed(6)),
            lng: Number(event.latlng.lng.toFixed(6)),
            locationSource: "manual_pin" as LocationSource,
            locationConfidence: "high" as LocationConfidence,
          };
          syncMarker(next, { center: true });
          setStatusMessage({
            tone: "success",
            message: "Đã cập nhật ghim. Chạm chỗ khác trên map để chỉnh lại.",
          });
          onChangeRef.current(next);
        });

        mapRef.current = map;
        setIsMapReady(true);

        if (hasCoordinates(selectedCoordinates)) {
          syncMarker(selectedCoordinates, { center: true });
        } else if (preferredFocus) {
          applyAdministrativeFocus(
            preferredFocus.bounds,
            {
              lat: preferredFocus.centerLat,
              lng: preferredFocus.centerLng,
            },
            preferredFocus.level,
          );
        }

        window.setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // ignore invalidateSize errors during rapid unmount/remount
          }
        }, 120);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Không thể tải bản đồ chọn vị trí",
          );
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.off();
          mapRef.current.remove();
        } catch {
          // ignore cleanup errors
        }
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isMapReady) return;

    if (hasCoordinates(selectedCoordinates)) {
      syncMarker(selectedCoordinates, { center: true });
      return;
    }

    syncMarker({ lat: null, lng: null }, { center: false });

    if (preferredFocus) {
      applyAdministrativeFocus(
        preferredFocus.bounds,
        {
          lat: preferredFocus.centerLat,
          lng: preferredFocus.centerLng,
        },
        preferredFocus.level,
      );
      return;
    }

    if (initialCenter && mapRef.current) {
      mapRef.current.setView([initialCenter.lat, initialCenter.lng], DEFAULT_ZOOM);
    }
  }, [
    focusKey,
    initialCenter?.lat,
    initialCenter?.lng,
    isMapReady,
    preferredFocus,
    selectedCoordinates,
  ]);

  const handleClear = () => {
    syncMarker({ lat: null, lng: null }, { center: false });
    onChangeRef.current({
      lat: null,
      lng: null,
      locationSource: "text_only",
      locationConfidence: "low",
    });
    setStatusMessage({
      tone: "info",
      message: "Đã xóa ghim. Bạn vẫn có thể lưu bằng địa chỉ text.",
    });

    if (preferredFocus) {
      applyAdministrativeFocus(
        preferredFocus.bounds,
        {
          lat: preferredFocus.centerLat,
          lng: preferredFocus.centerLng,
        },
        preferredFocus.level,
      );
    }
  };

  const handleLocateDevice = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatusMessage({
        tone: "error",
        message: "Trình duyệt không hỗ trợ định vị. Hãy ghim tay trực tiếp trên map.",
      });
      return;
    }

    setIsLocating(true);
    setStatusMessage({
      tone: "info",
      message: "Đang lấy vị trí hiện tại của thiết bị...",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          locationSource: "device_geolocation" as LocationSource,
          locationConfidence: "medium" as LocationConfidence,
        };

        syncMarker(next, { center: true });
        onChangeRef.current(next);
        setIsLocating(false);
        setStatusMessage({
          tone: "success",
          message:
            "Đã lấy vị trí hiện tại. Nếu điểm giao khác chỗ bạn đang đứng, hãy chạm lại map để chỉnh.",
        });
      },
      (error) => {
        let message = "Không thể lấy vị trí hiện tại. Hãy thử lại hoặc ghim tay trên map.";

        if (error.code === error.PERMISSION_DENIED) {
          message = "Bạn đã từ chối quyền định vị. Hãy bật lại quyền vị trí hoặc ghim tay trên map.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Thiết bị chưa xác định được vị trí hiện tại. Hãy thử lại hoặc ghim tay trên map.";
        } else if (error.code === error.TIMEOUT) {
          message = "Định vị mất quá nhiều thời gian. Hãy thử lại hoặc ghim tay trên map.";
        }

        setIsLocating(false);
        setStatusMessage({
          tone: "error",
          message,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    );
  };

  const showAdministrativeHint = Boolean(province.trim() || ward.trim());
  const focusHint = preferredFocus
    ? preferredFocus.level === "ward"
      ? `Map đang focus gần ${preferredFocus.label}.`
      : `Map đang focus theo ${preferredFocus.label}.`
    : showAdministrativeHint
      ? "Nhập đúng tỉnh / xã để map focus gần hơn."
      : "";

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-600">
          Chạm trực tiếp lên map để ghim. Có thể bỏ qua nếu bạn chỉ muốn lưu địa chỉ text.
        </p>
        {hasCoordinates(selectedCoordinates) && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Xóa ghim
          </button>
        )}
      </div>

      {focusHint ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          {focusHint}
        </div>
      ) : null}

      <div
        className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${mapHeightClassName}`.trim()}
      >
        <div ref={containerRef} className="h-full w-full" />

        {!loadError && (
          <button
            type="button"
            onClick={handleLocateDevice}
            disabled={isLocating}
            className="absolute bottom-4 right-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Định vị vị trí"
            title="Định vị vị trí"
          >
            {isLocating ? (
              <LoadingIcon className="h-5 w-5 animate-spin" />
            ) : (
              <TargetIcon className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
          {loadError}. Bạn vẫn có thể lưu địa chỉ mà không ghim map.
        </div>
      ) : null}

      {statusMessage ? (
        <div
          className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${getStatusClasses(
            statusMessage.tone,
          )}`}
        >
          {statusMessage.message}
        </div>
      ) : locationInfo.source === "device_geolocation" && locationInfo.hasCoordinates ? (
        <div className={`rounded-xl border px-3 py-2.5 text-sm ${getStatusClasses("info")}`}>
          Định vị dùng vị trí hiện tại của thiết bị. Hãy chỉnh lại ghim nếu điểm giao khác vị trí này.
        </div>
      ) : null}

      <div
        className={`rounded-xl border px-3 py-3 text-sm ${getLocationBoxClasses(
          locationInfo.confidence,
        )}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base">{locationInfo.icon}</span>
          <span className="font-semibold">{locationInfo.statusLabel}</span>
          <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {locationInfo.sourceLabel}
          </span>
          <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {locationInfo.confidenceLabel}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {hasCoordinates(selectedCoordinates)
            ? `Tọa độ: ${formatCoordinateText(selectedCoordinates)}`
            : "Bạn vẫn có thể lưu đơn bằng địa chỉ text nếu chưa muốn ghim map."}
        </p>
      </div>
    </div>
  );
};

export default MapPinPicker;
