import React from "react";
import type { AuthUser } from "../../../types";
import { formatGender } from "../helpers";
import { StatCard, Th, Td } from "../shared";

interface UsersTabProps {
  userStats: {
    totalUsers: number;
    avatarCount: number;
    recentUsers: number;
    recentDays: number;
  };
  userSearch: string;
  onUserSearchChange: (value: string) => void;
  filteredUsers: AuthUser[];
  paginatedUsers: AuthUser[];
  userPage: number;
  setUserPage: React.Dispatch<React.SetStateAction<number>>;
  userPageInput: string;
  onUserPageInputChange: (value: string) => void;
  totalUserPages: number;
  itemsPerPage: number;
  onOpenPermission: (user: AuthUser) => void;
}

const UsersTab: React.FC<UsersTabProps> = ({
  userStats,
  userSearch,
  onUserSearchChange,
  filteredUsers,
  paginatedUsers,
  userPage,
  setUserPage,
  userPageInput,
  onUserPageInputChange,
  totalUserPages,
  itemsPerPage,
  onOpenPermission,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Tổng tài khoản"
          value={String(userStats.totalUsers)}
          note="Sheet: Users"
        />
        <StatCard
          title="Có avatar"
          value={String(userStats.avatarCount)}
          note="avatarUrl khác rỗng"
        />
        <StatCard
          title="Đăng ký gần đây"
          value={String(userStats.recentUsers)}
          note={`${userStats.recentDays} ngày gần nhất theo createdAt`}
        />
      </div>
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Danh sách người dùng
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Hiển thị đầy đủ email, tên, số điện thoại và giới tính từ
              sheet Users.
            </p>
          </div>
          <input
            type="search"
            name="admin-user-search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Tìm theo email, tên, số điện thoại hoặc giới tính..."
            value={userSearch}
            onChange={(e) => onUserSearchChange(e.target.value)}
            className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left">
                <Th>STT</Th>
                <Th>Email</Th>
                <Th>Họ tên</Th>
                <Th>Số điện thoại</Th>
                <Th>Giới tính</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-center text-slate-500 py-8">
                    Không có người dùng phù hợp.
                  </Td>
                </tr>
              ) : (
                paginatedUsers.map((u, index) => (
                  <tr key={u.email}>
                    <Td>{(userPage - 1) * itemsPerPage + index + 1}</Td>
                    <Td>{u.email}</Td>
                    <Td>{u.name || "--"}</Td>
                    <Td>{u.phone || "--"}</Td>
                    <Td>{formatGender(u.gender)}</Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => onOpenPermission(u)}
                        className="px-3 py-2 rounded-lg border border-amber-300 text-sm text-amber-800"
                      >
                        Phân quyền
                      </button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setUserPage((p) => Math.max(1, p - 1))}
            disabled={userPage === 1}
            className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
          >
            ←
          </button>
          <div className="px-4 py-2 rounded-xl bg-slate-100 flex items-center gap-2">
            Trang
            <input
              type="number"
              value={userPageInput}
              onChange={(e) => onUserPageInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  let page = Number(userPageInput);
                  if (!page || page < 1) page = 1;
                  if (page > totalUserPages) page = totalUserPages;
                  setUserPage(page);
                }
              }}
              className="w-16 px-2 py-1 border rounded text-center outline-none"
            />
            / {totalUserPages}
          </div>
          <button
            onClick={() =>
              setUserPage((p) => Math.min(totalUserPages, p + 1))
            }
            disabled={userPage === totalUserPages}
            className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </section>
    </div>
  );
};

export default UsersTab;
