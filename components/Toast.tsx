import React, { createContext, useContext, useState } from "react";

type ToastType = "success" | "error" | "info" | "loading" | "confirm";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  paused?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const ToastContext = createContext<any>(null);
export const useToast = () => useContext(ToastContext);

const MAX_TOAST = 4;

const getStyle = (type: ToastType) => {
  switch (type) {
    case "success":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    case "loading":
      return "bg-blue-500";
    default:
      return "bg-slate-800";
  }
};

const getIcon = (type: ToastType) => {
  switch (type) {
    case "success":
      return "✔";
    case "error":
      return "❌";
    case "loading":
      return "⏳";
    default:
      return "ℹ";
  }
};

export const ToastProvider = ({ children }: any) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (message: string, type: ToastType = "info") => {
    const id = Date.now();

    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      return next.slice(-MAX_TOAST);
    });

    if (type !== "loading" && type !== "confirm") {
      setTimeout(() => removeToast(id), 3000);
    }

    return id;
  };

  // 🔥 Promise toast
  const showPromise = async (promise: Promise<any>, messages: any) => {
    const id = showToast(messages.loading, "loading");

    try {
      await promise;
      removeToast(id);
      showToast(messages.success, "success");
    } catch {
      removeToast(id);
      showToast(messages.error, "error");
    }
  };

  // 🔥 Confirm toast
  const showConfirm = (message: string, onConfirm: () => void) => {
    const id = Date.now();

    setToasts((prev) => [...prev, { id, message, type: "confirm", onConfirm }]);
  };

  return (
    <ToastContext.Provider value={{ showToast, showPromise, showConfirm }}>
      {children}

      <div className="fixed top-5 right-5 z-[9999] space-y-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`relative px-4 py-3 rounded-2xl text-white shadow-xl text-sm font-medium flex flex-col gap-2
            ${getStyle(t.type)}
            animate-[slideIn_0.3s_ease]`}
          >
            <div className="flex items-center gap-3">
              <span>{getIcon(t.type)}</span>
              <span>{t.message}</span>
            </div>

            {/* CONFIRM */}
            {t.type === "confirm" && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    t.onConfirm?.();
                    removeToast(t.id);
                  }}
                  className="px-3 py-1 bg-white text-black rounded-lg text-xs"
                >
                  OK
                </button>
                <button
                  onClick={() => removeToast(t.id)}
                  className="px-3 py-1 bg-black/30 rounded-lg text-xs"
                >
                  Hủy
                </button>
              </div>
            )}

            {/* Progress */}
            {t.type !== "loading" && t.type !== "confirm" && (
              <div className="absolute bottom-0 left-0 h-1 w-full bg-white/30">
                <div className="h-full bg-white animate-[progress_3s_linear]" />
              </div>
            )}
          </div>
        ))}
      </div>

      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(40px); }
            to { opacity: 1; transform: translateX(0); }
          }

          @keyframes progress {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}
      </style>
    </ToastContext.Provider>
  );
};
