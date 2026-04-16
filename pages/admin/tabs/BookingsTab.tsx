import React from "react";
import type { Booking } from "../../../types";
import { StatCard, Th, Td } from "../shared";

interface BookingsTabProps {
  bookingStats: {
    total: number;
    pending: number;
    confirmed: number;
  };
  bookingFilter: string;
  onBookingFilterChange: (value: string) => void;
  filteredBookings: Booking[];
  paginatedBookings: Booking[];
  bookingPage: number;
  setBookingPage: React.Dispatch<React.SetStateAction<number>>;
  bookingPageInput: string;
  onBookingPageInputChange: (value: string) => void;
  totalBookingPages: number;
  itemsPerPage: number;
  onViewCancelledNote: (note: string) => void;
  onEditBookingNote: (booking: Booking) => void;
  onConfirmBooking: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => void;
}

const BookingsTab: React.FC<BookingsTabProps> = ({
  bookingStats,
  bookingFilter,
  onBookingFilterChange,
  filteredBookings,
  paginatedBookings,
  bookingPage,
  setBookingPage,
  bookingPageInput,
  onBookingPageInputChange,
  totalBookingPages,
  itemsPerPage,
  onViewCancelledNote,
  onEditBookingNote,
  onConfirmBooking,
  onCancelBooking,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Tổng lịch hẹn"
          value={String(bookingStats.total)}
          note="Sheet: DatLich"
        />
        <StatCard
          title="Chờ xử lý"
          value={String(bookingStats.pending)}
          note="Trạng thái mới"
        />
        <StatCard
          title="Đã xác nhận"
          value={String(bookingStats.confirmed)}
          note="Đã xác nhận lịch hẹn"
        />
      </div>
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Danh sách đặt lịch
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Tạm hiển thị dữ liệu mẫu để hoàn thiện layout quản trị.
            </p>
          </div>
          <select
            className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
            value={bookingFilter}
            onChange={(e) => onBookingFilterChange(e.target.value)}
          >
            <option value="Tất cả">Tất cả trạng thái</option>
            <option value="Mới">Mới</option>
            <option value="Đã xác nhận">Đã xác nhận</option>
            <option value="Đã hủy">Đã hủy</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left">
                <Th>STT</Th>
                <Th>Mã lịch</Th>
                <Th>Khách hàng</Th>
                <Th>Ngày tham quan</Th>
                <Th>Giờ hẹn</Th>
                <Th>Trạng thái</Th>
                <Th>Ghi chú</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.map((b, index) => (
                <tr key={b.maDatLich}>
                  <Td>{(bookingPage - 1) * itemsPerPage + index + 1}</Td>
                  <Td>{b.maDatLich}</Td>
                  <Td>{b.hoTen}</Td>
                  <Td>{b.ngayThamQuan}</Td>
                  <Td>{b.gioHen}</Td>
                  <Td>
                    <span
                      className={`inline-block whitespace-nowrap px-3 py-1 text-xs rounded-full font-medium
                        ${
                          b.trangThai === "Đã xác nhận"
                            ? "bg-green-100 text-green-700"
                            : b.trangThai === "Đã hủy"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }
                      `}
                    >
                      {b.trangThai}
                    </span>
                  </Td>
                  <td className="text-sm text-slate-600">
                    {b.trangThai === "Đã hủy" ? (
                      <button
                        type="button"
                        onClick={() => onViewCancelledNote(b.ghiChu || "")}
                        className="max-w-[220px] truncate text-left text-red-600 font-medium hover:underline"
                        title="Bấm để xem đầy đủ lý do hủy"
                      >
                        {b.ghiChu || "-"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEditBookingNote(b)}
                        className={`max-w-[220px] truncate text-left hover:underline ${
                          b.ghiChu ? "text-slate-700" : "text-slate-400"
                        }`}
                        title="Bấm để sửa ghi chú"
                      >
                        {b.ghiChu || "-"}
                      </button>
                    )}
                  </td>
                  <Td className="text-right">
                    {b.trangThai === "Mới" && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => onConfirmBooking(b)}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded"
                        >
                          Xác nhận
                        </button>
                        <button
                          onClick={() => onCancelBooking(b)}
                          className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded"
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <Td colSpan={8} className="text-center py-8 text-slate-500">
                    Không có lịch hẹn nào
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
            disabled={bookingPage === 1}
            className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
          >
            ←
          </button>
          <div className="px-4 py-2 rounded-xl bg-slate-100 flex items-center gap-2">
            Trang
            <input
              type="number"
              value={bookingPageInput}
              onChange={(e) => onBookingPageInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  let page = Number(bookingPageInput);
                  if (!page || page < 1) page = 1;
                  if (page > totalBookingPages) page = totalBookingPages;
                  setBookingPage(page);
                }
              }}
              className="w-16 px-2 py-1 border rounded text-center outline-none"
            />
            / {totalBookingPages}
          </div>
          <button
            onClick={() =>
              setBookingPage((p) => Math.min(totalBookingPages, p + 1))
            }
            disabled={bookingPage === totalBookingPages}
            className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </section>
    </div>
  );
};

export default BookingsTab;
