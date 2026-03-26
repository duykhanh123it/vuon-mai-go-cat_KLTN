import React, { useEffect, useState } from "react";
import { Page } from "../types";

/**
 * Layout.tsx
 * Navbar: Mobile có hamburger + sidebar drawer
 */

interface NavbarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}


export const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage }) => {
  const PHONE_NUMBER = "0922727277";
  const ZALO_LINK = `https://zalo.me/${PHONE_NUMBER}`;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems: Array<{ id: Page; label: string; icon: string }> = [
    { id: "home", label: "Trang Chủ", icon: "🏠" },
    { id: "products", label: "Sản Phẩm", icon: "🌼" },
    { id: "booking", label: "Đặt Lịch Hẹn", icon: "📅" },
    { id: "contact", label: "Liên Hệ", icon: "📞" },
  ];

  const handleCallClick = () => {
    const ua = navigator.userAgent || (navigator as any).vendor || (window as any).opera;
    const isMobile = /android|iphone|ipad|ipod|iemobile|blackberry|bada|tizen|mobile/i.test(ua);

    if (isMobile) {
      window.location.href = `tel:${PHONE_NUMBER}`;
      return;
    }

    window.open(ZALO_LINK, "_blank", "noopener,noreferrer");
  };

  const goPage = (page: Page) => {
    setCurrentPage(page);
    setDrawerOpen(false);
  };

  // ESC để đóng + khóa scroll nền khi drawer mở
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };

    if (drawerOpen) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const navBtnBase =
    "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 " +
    "cursor-pointer select-none focus:outline-none focus-visible:outline-none";

  const navBtnActive = "border-2 border-slate-800 bg-amber-100 text-orange-600 shadow-sm";
  const navBtnInactive =
    "text-slate-600 hover:bg-slate-100/80 hover:text-amber-700 hover:backdrop-blur-sm";

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="container mx-auto px-4 py-3">
        {/* Header row: [☰] Logo [Gọi ngay] */}
        {/* Header row (mobile): ☰ | Logo (center) */}
        {/* Header row (mobile): ☰ | Logo (center) | spacer */}
        <div className="md:hidden">
          <div className="flex items-center justify-between h-14 px-4">
            {/* Left: Hamburger */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở menu"
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg hover:bg-slate-100 active:scale-95"
            >
              ☰
            </button>

            {/* Center: Brand (truncate để không bị xuống dòng trên máy thật) */}
            <button
              type="button"
              onClick={() => goPage("home")}
              aria-label="Về trang chủ"
              className="flex-1 flex items-center justify-center gap-2 select-none min-w-0"
            >
              <img
                src="/logo.jpg"
                alt="Vườn Mai Gò Cát"
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                draggable={false}
              />

              <div className="min-w-0 leading-tight text-left">
                <div className="text-[14px] font-bold font-serif text-amber-900 whitespace-nowrap truncate">
                  Vườn Mai Gò Cát
                </div>
                {/* <div className="text-[10px] text-slate-500 uppercase tracking-wide whitespace-nowrap truncate">
                  Tinh hoa Mai Tết Miền Nam
                </div> */}
              </div>
            </button>

            {/* Right: Spacer (giữ logo luôn ở giữa) */}
            <div className="w-10 h-10" />
          </div>
        </div>



        {/* Header row desktop: Logo - Menu - Gọi ngay (1 hàng) */}
        <div className="hidden md:flex items-center justify-between gap-6">
          {/* Brand (left) */}
          <button
            type="button"
            className="flex items-center gap-3 cursor-pointer text-left select-none"
            onClick={() => goPage("home")}
            aria-label="Về trang chủ"
          >
            <div className="w-11 h-11 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold overflow-hidden">
              <img
                src="/logo.jpg"
                alt="logo"
                className="rounded-full w-full h-full object-cover border-2 border-white"
                draggable={false}
              />
            </div>

            <div className="leading-none">
              <h1 className="text-lg font-bold font-serif text-amber-900">Vườn Mai Gò Cát</h1>
              {/* <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                Tinh hoa Mai Tết Miền Nam
              </p> */}
            </div>
          </button>

          {/* Menu (center) */}
          <div className="flex items-center justify-center gap-2">
            {navItems.map((item) => {
              const isActive =
                currentPage === item.id ||
                (item.id === "products" && String(currentPage).toLowerCase().includes("product"));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentPage(item.id)}
                  className={`${navBtnBase} ${isActive ? navBtnActive : navBtnInactive}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Call (right) */}
          <button
            type="button"
            onClick={handleCallClick}
            aria-label={`Gọi ngay ${PHONE_NUMBER}`}
            className="
    group relative overflow-hidden
    font-bold px-4 py-2 rounded-lg
    flex items-center gap-2
    text-white text-sm
    shadow-md hover:shadow-lg
    select-none whitespace-nowrap

    transition-transform duration-200 ease-out
    hover:scale-[1.04]
    active:scale-[0.96]
  "
            style={{ background: "linear-gradient(to right, #3F6F4A, #E2B93B)" }}
          >
            {/* Icon */}
            <span
              aria-hidden="true"
              className="
      inline-flex items-center justify-center
      transition-transform duration-200 ease-out
      group-hover:scale-110
    "
            >
              📞
            </span>

            {/* Text */}
            <span>Gọi ngay</span>

            {/* Light sweep */}
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


        {/* Menu desktop giữ nguyên kiểu cũ */}
        {/* <div className="hidden md:flex items-center justify-center gap-2 mt-3">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentPage(item.id)}
                className={`${navBtnBase} ${isActive ? navBtnActive : navBtnInactive}`}
              >
                {item.label}
              </button>
            );
          })}
        </div> */}
      </div>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-[290px] bg-white shadow-2xl z-[60] transform transition-transform duration-200 ${drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <img src="/logo.jpg" alt="logo" className="w-10 h-10 rounded-full object-cover" draggable={false} />
            <div className="leading-tight">
              <div className="font-bold text-amber-900">Vườn Mai Gò Cát</div>
              <div className="text-xs text-slate-500">Menu</div>
            </div>
          </div>

          <button
            type="button"
            className="w-10 h-10 rounded-lg hover:bg-slate-100 active:scale-95 transition text-xl"
            onClick={() => setDrawerOpen(false)}
            aria-label="Đóng menu"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          {navItems.map((item) => {
            const isActive =
              currentPage === item.id ||
              (item.id === "products" && String(currentPage).toLowerCase().includes("product"));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition select-none
        ${isActive ? "bg-amber-100 text-amber-900 border border-amber-200" : "hover:bg-slate-100 text-slate-700"}
      `}
              >
                <span className="text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="font-semibold">{item.label}</span>
              </button>
            );
          })}

          <div className="mt-4 pt-4 border-t">
            <button
              type="button"
              onClick={handleCallClick}
              className="hidden w-full font-bold px-4 py-3 rounded-xl text-white shadow-md hover:shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(to right, #3F6F4A, #E2B93B)" }}
            >
              📞 Gọi ngay
            </button>
          </div>
        </div>
      </aside>
    </nav>
  );
};


export const Footer: React.FC<{ setCurrentPage: (page: Page) => void }> = ({ setCurrentPage }) => {
  return (
    <footer className="bg-slate-800 text-white pt-16 pb-8">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center gap-3 mb-6 select-none">
            <img src="/logo.jpg" alt="logo" className="rounded-full w-10 h-10 object-cover" draggable={false} />
            <h2 className="text-xl font-bold font-serif">Vườn Mai Gò Cát</h2>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Hơn 30 năm kinh nghiệm trồng và chăm sóc Mai Tết cao cấp tại miền Nam Việt Nam. Cam kết chất lượng và sự hài lòng tuyệt đối.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-6 text-amber-400">Liên Kết Nhanh</h3>
          <ul className="space-y-3 text-sm text-slate-400">
            <li>
              <button
                type="button"
                onClick={() => setCurrentPage("home")}
                className="hover:text-amber-400 transition-colors cursor-pointer select-none"
              >
                Giới Thiệu
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setCurrentPage("products")}
                className="hover:text-amber-400 transition-colors cursor-pointer select-none"
              >
                Sản Phẩm
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setCurrentPage("contact")}
                className="hover:text-amber-400 transition-colors cursor-pointer select-none"
              >
                Liên hệ
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-6 text-amber-400">Liên Hệ</h3>
          <ul className="space-y-4 text-sm text-slate-400">
            <li className="flex gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              56 Đường 882, P. Long Trường, Thành phố Hồ Chí Minh
            </li>

            <li className="flex gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              0922 727 277
            </li>

            <li className="flex gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              vuonmaigocat@gmail.com
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-6 text-amber-400">Kết Nối Với Chúng Tôi</h3>
          <div className="flex gap-4 mb-6">
            <a
              href="https://www.facebook.com/vuonmaigocatquan9"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook Vườn Mai Gò Cát"
              className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold hover:bg-amber-400 hover:text-amber-950 transition-all select-none"
            >
              f
            </a>

            <a
              href="https://m.me/vuonmaigocatquan9"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Messenger Vườn Mai Gò Cát"
              className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white text-xl hover:bg-amber-400 hover:text-amber-950 transition-all select-none"
            >
              💬
            </a>
          </div>
          <p className="text-xs text-slate-500">Giờ làm việc: 7:00 - 18:00 (Hàng ngày)</p>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-16 pt-8 border-t border-slate-700 text-center text-slate-500 text-sm">
        <p>© 2024 Vườn Mai Gò Cát. Bảo lưu mọi quyền.</p>
      </div>
    </footer>
  );
};
