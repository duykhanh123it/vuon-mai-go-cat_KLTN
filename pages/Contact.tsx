import React from "react";
import { Page } from "../types";

type ContactProps = {
  setCurrentPage: (page: Page) => void;
};

const Contact: React.FC<ContactProps> = ({ setCurrentPage }) => {
  const openGoogleMaps = () => {
    // Link chỉ đường đến địa chỉ (bạn có thể đổi query nếu muốn)
    window.open(
      "https://maps.app.goo.gl/peJCCfcFDsLrZ7UY7",
      "_blank"
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Banner */}
      <section
        className="text-white py-20"
        style={{
          background: "linear-gradient(to right, #D4A017, #2F5D3A)",
        }}
      >
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold font-serif mb-4">Liên Hệ Tư Vấn</h1>
          <p className="text-xl opacity-90">Đội ngũ chuyên gia sẵn sàng hỗ trợ bạn 24/7</p>
        </div>
      </section>

      <div className="container mx-auto px-4 mt-12">
        {/* Advisor card */}
        <section className="mb-16">
          <div className="bg-white rounded-3xl shadow-xl p-10 max-w-5xl mx-auto text-center">
            <h2 className="text-2xl font-bold font-serif mb-10 tracking-widest">
              ĐỘI NGŨ TƯ VẤN VIÊN
            </h2>

            {/* 2 cards: mobile = stack, md+ = 2 cột */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Card 1: Lê Minh Quý (luôn ở trên trên mobile) */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 text-center border border-slate-100 shadow-sm">
                <div className="w-28 h-28 mx-auto rounded-full bg-slate-100 shadow-inner mb-6 border-4 border-amber-100 overflow-hidden">
                  <img
                    src="/leminhquy_contact.png"
                    alt="Anh Lê Minh Quý - Nghệ nhân Mai Vàng"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <h3 className="text-xl font-bold text-amber-800 mb-4">Anh Lê Minh Quý</h3>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
                  <a
                    href="tel:0922727277"
                    className="flex-1 bg-amber-400 hover:bg-amber-500 text-amber-950 py-4 rounded-xl
                       font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                  >
                    <span className="text-xl">📞</span> 092 272 7277
                  </a>

                  <a
                    href="https://zalo.me/0922727277"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl
                       font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                  >
                    <span className="text-xl">💬</span> Chat Zalo
                  </a>
                </div>
              </div>

              {/* Card 2: Nguyễn Thị Kim Trang */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 text-center border border-slate-100 shadow-sm">
                <div className="w-28 h-28 mx-auto rounded-full bg-slate-100 shadow-inner mb-6 border-4 border-amber-100 overflow-hidden">
                  {/* Nếu chưa có ảnh, bạn có thể tạo file này hoặc thay bằng ảnh khác */}
                  <img
                    src="/nguyenthikimtrang_contact.png"
                    alt="Chị Nguyễn Thị Kim Trang - Tư vấn viên"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      // fallback nếu thiếu ảnh
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Fallback chữ cái nếu ảnh bị ẩn */}
                  <div className="w-full h-full grid place-items-center text-3xl font-bold text-slate-400">
                    T
                  </div>
                </div>

                <h3 className="text-xl font-bold text-amber-800 mb-4">Chị Nguyễn Thị Kim Trang</h3>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
                  <a
                    href="tel:0903745308"
                    className="flex-1 bg-amber-400 hover:bg-amber-500 text-amber-950 py-4 rounded-xl
                       font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                  >
                    <span className="text-xl">📞</span> 0903 745 308
                  </a>

                  <a
                    href="https://zalo.me/0903745308"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl
                       font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                  >
                    <span className="text-xl">💬</span> Chat Zalo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mini Info & Map */}
        {/* Contact + Map (Synced with Contact page style) */}
        <section className="py-20 container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch">
            {/* Left: Contact info */}
            <div>
              <h3 className="text-3xl font-bold font-serif mb-10 border-l-4 border-amber-500 pl-4">
                Thông Tin Liên Hệ
              </h3>

              <div className="space-y-6">
                <div className="flex items-start gap-4 p-5 sm:p-6 bg-white rounded-2xl shadow-sm">
                  <div className="shrink-0 size-12 rounded-full bg-amber-100 grid place-items-center text-2xl leading-none text-amber-600">
                    📍
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-amber-700 uppercase tracking-wide text-sm mb-1">
                      Địa chỉ vườn
                    </p>
                    <p className="text-slate-700 leading-snug">
                      56 Đường 882, P. Long Trường, Thành phố Hồ Chí Minh, Việt Nam
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 bg-white rounded-2xl shadow-sm">
                  <div className="shrink-0 size-12 rounded-full bg-amber-100 grid place-items-center text-2xl leading-none text-amber-600">
                    📞
                  </div>
                  <div>
                    <p className="font-bold text-amber-700 uppercase tracking-wide text-sm mb-1">
                      Hotline
                    </p>
                    <p className="text-slate-700">0922 727 277: Lê Minh Quý</p>
                    <p className="text-slate-700">0903 745 308: Nguyễn Thị Kim Trang</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 bg-white rounded-2xl shadow-sm">
                  <div className="shrink-0 size-12 rounded-full bg-amber-100 grid place-items-center text-2xl leading-none text-amber-600">
                    ⏰
                  </div>
                  <div>
                    <p className="font-bold text-amber-700 uppercase tracking-wide text-sm mb-1">
                      Giờ làm việc
                    </p>
                    <p className="text-slate-700">Thứ 2 - Chủ Nhật: 7:00 - 18:00</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Map */}
            <div className="flex flex-col">
              <h3 className="text-3xl font-bold font-serif mb-10 border-l-4 border-amber-500 pl-4">
                Bản Đồ Đường Đi
              </h3>

              {/* Map Image */}
              <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl group min-h-[220px] sm:min-h-[280px] md:min-h-0 md:flex-1">
                <img
                  src="/map.png"
                  alt="Bản đồ Vườn Mai Gò Cát"
                  className="absolute inset-0 w-full h-full object-cover
               transition-transform duration-700 ease-out
               group-hover:scale-105"
                  draggable={false}
                />

                {/* Overlay */}
                <div
                  className="absolute inset-0 bg-black/30
               opacity-0 group-hover:opacity-100
               transition-opacity duration-500"
                />

                {/* Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <a
                    href="https://www.google.com/maps?q=Vườn%20Mai%20Gò%20Cát"
                    target="_blank"
                    rel="noreferrer"
                    className="
  bg-amber-400 text-amber-950
  px-6 py-3 rounded-xl font-bold shadow-lg
  transition-all duration-500
  opacity-100 scale-100
  hover:bg-amber-500
  group-hover:-translate-y-0.5 group-hover:shadow-xl
"

                  >
                    Mở Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA bottom */}
        <section
          className="relative py-20 px-6 md:px-12 rounded-[3rem] overflow-hidden"
          style={{
            background: "linear-gradient(to right, #D4A017, #2F5D3A)",
          }}
        >
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative z-10 text-center text-white">
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-6">Cần Tư Vấn Ngay?</h2>
            <p className="text-xl opacity-90 mb-12 max-w-2xl mx-auto font-light">
              Liên hệ hotline để được tư vấn và phục vụ tốt nhất cho mùa Tết này
            </p>

            <div className="flex flex-col md:flex-row gap-6 justify-center">
              <a
                href="tel:0922727277"
                className="
    group relative overflow-hidden

    bg-white text-[#2F5D3A]
    px-10 py-5 rounded-2xl
    font-bold text-lg
    shadow-xl

    flex items-center justify-center gap-3

    transition-transform duration-200 ease-out
    hover:scale-[1.03]
    active:scale-[0.97]
  "
              >
                {/* Icon */}
                <span
                  className="
      inline-flex items-center justify-center
      transition-transform duration-200 ease-out
      group-hover:scale-110
    "
                >
                  📞
                </span>

                {/* Text */}
                <span>Gọi Ngay: 0922 727 277</span>

                {/* Light sweep — RÕ HƠN */}
                <span
                  aria-hidden
                  className="
      pointer-events-none
      absolute inset-0

      bg-gradient-to-r
      from-transparent
      via-white/70
      to-transparent

      translate-x-[-140%]
      group-hover:translate-x-[140%]

      transition-transform duration-500 ease-out
      blur-[2px]
    "
                />
              </a>

              <button
                type="button"
                onClick={() => setCurrentPage("products")}
                className="
    group relative overflow-hidden

    bg-white/15 backdrop-blur-md border border-white/30 text-white
    px-10 py-5 rounded-2xl
    font-bold text-lg

    flex items-center justify-center

    transition-transform duration-200 ease-out
    hover:scale-[1.03]
    active:scale-[0.97]
  "
              >
                {/* Text */}
                <span>Xem Sản Phẩm</span>

                {/* Light sweep — đồng bộ với nút Gọi */}
                <span
                  aria-hidden
                  className="
      pointer-events-none
      absolute inset-0

      bg-gradient-to-r
      from-transparent
      via-white/50
      to-transparent

      translate-x-[-140%]
      group-hover:translate-x-[140%]

      transition-transform duration-500 ease-out
      blur-[2px]
    "
                />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Contact;
