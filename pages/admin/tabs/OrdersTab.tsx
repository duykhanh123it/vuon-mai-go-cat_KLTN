import React, { useEffect, useState } from "react";
import { Th, Td, Badge } from "../shared";

const API_URL = import.meta.env.VITE_PRODUCTS_API_BASE;

type Order = {
  orderId: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  orderStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [orderDetailCache, setOrderDetailCache] = useState<Record<string, any>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payLoading, setPayLoading] = useState(false);

  const [orderStatus, setOrderStatus] = useState("new");
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}?api=getOrders`);
      const data = await res.json();
      console.log("DETAIL RAW:", data);

      if (data.ok) {
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error("fetchOrders error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetail = async (orderId: string) => {
    try {
      // 🚀 nếu đã có cache → dùng luôn
      if (orderDetailCache[orderId]) {
        const cached = orderDetailCache[orderId];
        setOrderDetail(cached);
        setOrderStatus(cached.orderStatus || "new");
        return;
      }

      const res = await fetch(
        `${API_URL}?api=getOrderDetail&orderId=${orderId}`,
      );
      const data = await res.json();

      if (data.ok) {
        const detail = {
          ...data.order,
          payments: data.payments || [],
        };

        setOrderDetail(detail);
        setOrderStatus(detail.orderStatus || "new");

        // 💾 lưu cache
        setOrderDetailCache((prev) => ({
          ...prev,
          [orderId]: detail,
        }));
      }
    } catch (err) {
      console.error("fetchOrderDetail error:", err);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedOrderId || !payAmount) return;

    try {
      setPayLoading(true);

      const res = await fetch(`${API_URL}?api=addPayment`, {
        method: "POST",
        body: JSON.stringify({
          orderId: selectedOrderId,
          amount: Number(payAmount),
          method: payMethod,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        // reload detail
        await fetchOrderDetail(selectedOrderId);

        // cập nhật lại bảng danh sách đơn hàng
        await fetchOrders();

        // reset input
        setPayAmount("");
      }
    } catch (err) {
      console.error("addPayment error:", err);
    } finally {
      setPayLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrderId) return;
    try {
      setStatusLoading(true);
      const res = await fetch(`${API_URL}?api=updateOrderStatus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api: "updateOrderStatus",
          orderId: selectedOrderId,
          status: orderStatus,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchOrderDetail(selectedOrderId);
        await fetchOrders();
      }
    } catch (err) {
      console.error("updateStatus error:", err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusTone = (status: string) => {
    if (status === "paid") return "green";
    if (status === "new") return "amber";
    return "red";
  };

  return (
    <div className="bg-white p-6 rounded-xl border">
      <h2 className="text-xl font-bold mb-4">Danh sách đơn hàng</h2>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Mã đơn</Th>
                <Th>Khách</Th>
                <Th>Loại</Th>
                <Th>Tổng</Th>
                <Th>Đã trả</Th>
                <Th>Còn nợ</Th>
                <Th>Trạng thái</Th>
              </tr>
            </thead>

            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.orderId}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => {
                    setSelectedOrderId(o.orderId);
                    setIsOpen(true);
                    fetchOrderDetail(o.orderId);
                  }}
                >
                  <Td>{o.orderId}</Td>
                  <Td>
                    <div>{o.customerName}</div>
                    <div className="text-xs text-slate-400">
                      {o.customerPhone}
                    </div>
                  </Td>
                  <Td>{o.orderType}</Td>
                  <Td>{Number(o.totalAmount || 0).toLocaleString("vi-VN")}</Td>
                  <Td>{Number(o.paidAmount || 0).toLocaleString("vi-VN")}</Td>
                  <Td>
                    {Number(o.remainingAmount || 0).toLocaleString("vi-VN")}
                  </Td>
                  <Td>
                    <Badge
                      text={o.orderStatus?.toUpperCase()}
                      tone={getStatusTone(o.orderStatus)}
                    />
                  </Td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <Td colSpan={7} className="text-center text-slate-400">
                    Không có đơn hàng
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-xl p-6 relative animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-black"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>

            {!orderDetail ? (
              <p>Đang tải...</p>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-4">
                  Chi tiết đơn: {orderDetail.orderId}
                </h3>

                <div className="mb-4 space-y-2">
                  <label className="block text-sm text-slate-500">
                    Trạng thái đơn
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="new">Mới</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="completed">Hoàn tất</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={statusLoading}
                    className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-60"
                  >
                    {statusLoading ? "Đang cập nhật..." : "Cập nhật trạng thái"}
                  </button>
                </div>

                <div className="mb-2">
                  Khách: {orderDetail.customerName} ({orderDetail.customerPhone}
                  )
                </div>

                <div className="mb-2">
                  Tổng:{" "}
                  {Number(orderDetail.totalAmount || 0).toLocaleString("vi-VN")}
                  đ
                </div>

                <div className="mb-4">
                  Còn nợ:{" "}
                  {Number(orderDetail.remainingAmount || 0).toLocaleString(
                    "vi-VN",
                  )}
                  đ
                </div>

                <h4 className="font-semibold mb-2">Thanh toán</h4>

                <div className="mb-4 space-y-2">
                  <input
                    type="number"
                    placeholder="Nhập số tiền..."
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />

                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="bank">Chuyển khoản</option>
                  </select>

                  <button
                    onClick={handleAddPayment}
                    disabled={payLoading}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    {payLoading ? "Đang xử lý..." : "Thanh toán"}
                  </button>
                </div>

                <ul className="text-sm space-y-1">
                  {(orderDetail.payments || []).map((p: any) => (
                    <li key={p.paymentId}>
                      <p>{p.createdAt}</p>
                      <p>{Number(p.amount || 0).toLocaleString("vi-VN")}đ</p>
                      <p>{p.method || "-"}</p>
                      <p>{p.note || "-"}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
