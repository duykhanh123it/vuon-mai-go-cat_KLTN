import React from "react";

interface NotFoundProps {
  title?: string;
  description?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

const NotFound: React.FC<NotFoundProps> = ({
  title = "Không tìm thấy trang",
  description = "Liên kết bạn truy cập không tồn tại hoặc đã bị thay đổi.",
  primaryActionLabel = "Về trang chủ",
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div className="min-h-[70vh] bg-slate-50 px-4 py-20 flex items-center">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 md:p-10 text-center shadow-sm">
        <div className="text-6xl mb-5">🌼</div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{title}</h1>
        <p className="text-slate-500 leading-relaxed max-w-xl mx-auto">
          {description}
        </p>

        {(onPrimaryAction || onSecondaryAction) && (
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {onPrimaryAction && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 hover:bg-amber-500 transition"
              >
                {primaryActionLabel}
              </button>
            )}
            {onSecondaryAction && secondaryActionLabel && (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                {secondaryActionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotFound;
