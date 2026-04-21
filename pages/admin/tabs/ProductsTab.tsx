import React from "react";
import type { Product } from "../../../types";
import type { ProductsType } from "../../../utils/productsApi";
import { formatPrice } from "../helpers";
import { Badge, StatCard, Th, Td } from "../shared";
import { getProductAvailabilityStatus } from "../../../utils/productAvailability";

interface ProductsTabProps {
  loadingProducts: boolean;
  stats: {
    total: number;
    bonsai: number;
    tang: number;
  };
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  productsType: ProductsType;
  onProductsTypeChange: (value: ProductsType) => void;
  onOpenCreate: () => void;
  filteredProducts: Product[];
  paginatedProducts: Product[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageInput: string;
  onPageInputChange: (value: string) => void;
  totalPages: number;
  itemsPerPage: number;
  onOpenView: (product: Product) => void;
  onOpenEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

const ProductsTab: React.FC<ProductsTabProps> = ({
  loadingProducts,
  stats,
  searchTerm,
  onSearchTermChange,
  productsType,
  onProductsTypeChange,
  onOpenCreate,
  filteredProducts,
  paginatedProducts,
  currentPage,
  setCurrentPage,
  pageInput,
  onPageInputChange,
  totalPages,
  itemsPerPage,
  onOpenView,
  onOpenEdit,
  onDelete,
}) => {
  const priority = {
    available: 0,
    reserved: 1,
    rented_out: 2,
    sold: 3,
  };

  const sortedProducts = [...paginatedProducts].sort((a, b) => {
    const aStatus = getProductAvailabilityStatus(a);
    const bStatus = getProductAvailabilityStatus(b);
    return priority[aStatus] - priority[bStatus];
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Tổng sản phẩm"
          value={loadingProducts ? "..." : String(stats.total)}
          note="Dữ liệu từ Google Sheet"
        />
        <StatCard
          title="Mai Bonsai"
          value={loadingProducts ? "..." : String(stats.bonsai)}
          note="Sheet: MaiBonSai"
        />
        <StatCard
          title="Mai Tàng"
          value={loadingProducts ? "..." : String(stats.tang)}
          note="Sheet: MaiTang"
        />
      </div>
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Danh sách sản phẩm
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Dữ liệu được kết nối từ Google Sheet.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Tìm mã cây (VD: BS01...)"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
            />
            <select
              className="h-11 rounded-xl border border-slate-300 px-4 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
              value={productsType}
              onChange={(e) =>
                onProductsTypeChange(e.target.value as ProductsType)
              }
            >
              <option value="All">Tất cả nhóm</option>
              <option value="BS">Mai Bonsai</option>
              <option value="T">Mai Tàng</option>
            </select>
            <button
              type="button"
              onClick={onOpenCreate}
              className="h-11 px-5 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold transition-all active:scale-[0.99]"
            >
              + Tạo cây mới
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left">
                <Th>STT</Th>
                <Th>Mã cây</Th>
                <Th>Nhóm</Th>
                <Th>Giá thuê</Th>
                <Th>Giá bán</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts ? (
                <tr>
                  <Td colSpan={7}>Đang tải dữ liệu...</Td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <Td colSpan={7}>
                    {searchTerm
                      ? "Không tìm thấy sản phẩm nào khớp với từ khóa"
                      : "Không có dữ liệu"}
                  </Td>
                </tr>
              ) : (
                sortedProducts.map((product) => {
                  const availability = getProductAvailabilityStatus(product);

                  return (
                    <tr
                      key={product.id}
                      className={`
                        ${availability === "reserved" ? "bg-yellow-50" : ""}
                        ${availability === "rented_out" ? "bg-blue-50" : ""}
                        ${availability === "sold" ? "opacity-60" : ""}
                      `}
                    >
                      <Td>
                        {(currentPage - 1) * itemsPerPage +
                          sortedProducts.indexOf(product) +
                          1}
                      </Td>
                      <Td>
                        <div>
                          <span className="font-medium text-slate-900">
                            {product.id}
                          </span>
                          <div className="mt-1">
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium
                                ${availability === "available" && "bg-green-100 text-green-700"}
                                ${availability === "reserved" && "bg-yellow-100 text-yellow-700"}
                                ${availability === "rented_out" && "bg-blue-100 text-blue-700"}
                                ${availability === "sold" && "bg-red-100 text-red-700"}
                              `}
                            >
                              {availability === "available" && "🟢 Sẵn sàng"}
                              {availability === "reserved" && "🟡 Đang giữ"}
                              {availability === "rented_out" && "🔵 Đang thuê"}
                              {availability === "sold" && "🔴 Đã bán"}
                            </span>
                          </div>
                        </div>
                      </Td>
                      <Td>{product.category}</Td>
                      <Td>{formatPrice(product.rentPrice)}</Td>
                      <Td>{formatPrice(product.price)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {availability === "available" && (
                            <Badge text="Sẵn sàng" tone="green" />
                          )}
                          {availability === "reserved" && (
                            <Badge text="Đang giữ" tone="amber" />
                          )}
                          {availability === "rented_out" && (
                            <Badge text="Đang thuê" tone="blue" />
                          )}
                          {availability === "sold" && (
                            <Badge text="Đã bán" tone="red" />
                          )}
                          {availability === "reserved" &&
                            product.reservedByOrderId && (
                              <div className="text-xs text-slate-500 mt-1">
                                Order: {product.reservedByOrderId}
                              </div>
                            )}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenView(product)}
                            className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                          >
                            Xem
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEdit(product)}
                            disabled={
                              availability === "sold" ||
                              availability === "reserved"
                            }
                            className={`px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-800 hover:bg-amber-50 transition
                              ${availability === "sold" || availability === "reserved" ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(product)}
                            disabled={
                              availability === "sold" ||
                              availability === "reserved"
                            }
                            className={`px-3 py-2 rounded-lg border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50 transition
                              ${availability === "sold" || availability === "reserved" ? "opacity-50 cursor-not-allowed" : ""}`}
                            title={
                              availability === "reserved"
                                ? "Không thể xóa vì đang có đơn giữ"
                                : availability === "sold"
                                  ? "Không thể xóa vì đã bán"
                                  : ""
                            }
                          >
                            Xóa
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
          >
            ←
          </button>
          <div className="px-4 py-2 rounded-xl bg-slate-100 flex items-center gap-2">
            Trang
            <input
              type="number"
              value={pageInput}
              onChange={(e) => onPageInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  let page = Number(pageInput);
                  if (!page || page < 1) page = 1;
                  if (page > totalPages) page = totalPages;
                  setCurrentPage(page);
                }
              }}
              className="w-16 px-2 py-1 border rounded text-center outline-none"
            />
            / {totalPages || 1}
          </div>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages || 1, p + 1))
            }
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </section>
    </div>
  );
};

export default ProductsTab;
