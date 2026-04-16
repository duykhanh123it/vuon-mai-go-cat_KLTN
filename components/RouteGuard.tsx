import React from "react";
import type { AuthUser, AdminTab } from "../types";
import { canAccessAdmin, canAccessAdminTab } from "../types";

interface RouteGuardProps {
  authUser: AuthUser | null;
  requiredAdminTab?: AdminTab;
  onRequestLogin: () => void;
  children: React.ReactNode;
}

const RouteGuard: React.FC<RouteGuardProps> = ({
  authUser,
  requiredAdminTab,
  onRequestLogin,
  children,
}) => {
  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Bạn cần đăng nhập để truy cập khu quản trị
          </h1>
          <p className="text-slate-500 mb-6 leading-relaxed">
            Vui lòng đăng nhập bằng tài khoản đã được cấp quyền quản trị hoặc
            được phân quyền truy cập sản phẩm và lịch hẹn.
          </p>
          <button
            type="button"
            onClick={onRequestLogin}
            className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-6 py-3 font-bold text-amber-950 hover:bg-amber-500 transition"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin(authUser)) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">⛔</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Bạn không có quyền truy cập trang quản trị
          </h1>
          <p className="text-slate-500 leading-relaxed">
            Tài khoản này chưa được cấp quyền vào khu quản trị của website.
          </p>
        </div>
      </div>
    );
  }

  if (requiredAdminTab && !canAccessAdminTab(authUser, requiredAdminTab)) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Bạn không có quyền truy cập mục này
          </h1>
          <p className="text-slate-500 leading-relaxed">
            Liên kết bạn mở thuộc khu vực quản trị mà tài khoản hiện tại chưa
            được cấp quyền sử dụng.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RouteGuard;
