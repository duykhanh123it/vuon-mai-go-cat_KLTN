import React from "react";
import { Page } from "../types";
import anhMai1 from "../img/anhmai1_tc.png";
import anhMai2 from "../img/anhmai2_tc.png";
import anhMai3 from "../img/anhmai3_tc.png";
import anhMai4 from "../img/anhmai4_tc.png";
import anhMai5 from "../img/anhmai5_tc.png";
import anhMai6 from "../img/anhmai6_tc.png";
import anhHero0 from "../img/anhHeRo.png";
import anhHero1 from "../img/anhHeRo1.png";
import anhHero2 from "../img/anhHeRo2.png";
import anhHero3 from "../img/anhHeRo4.png";

interface HomeProps {
  setCurrentPage: (page: Page) => void;
}

const Home: React.FC<HomeProps> = ({ setCurrentPage }) => {
  const images = [anhMai1, anhMai2, anhMai3, anhMai4, anhMai5, anhMai6];

  const heroImages = [anhHero0, anhHero1, anhHero2, anhHero3];

  const [heroIndex, setHeroIndex] = React.useState(0);
  const [isSliding, setIsSliding] = React.useState(false);

  // ===== Marquee interactive (drag to scrub) =====
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const groupRef = React.useRef<HTMLDivElement | null>(null);

  const offsetRef = React.useRef(0);
  const baseSpeedRef = React.useRef(55);
  const isPointerDownRef = React.useRef(false);

  const startXRef = React.useRef(0);
  const startOffsetRef = React.useRef(0);

  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef<number>(0);
  const groupWRef = React.useRef<number>(0);

  React.useEffect(() => {
    const el = groupRef.current;
    if (!el) return;

    const measure = () => {
      groupWRef.current = el.getBoundingClientRect().width;
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => ro.disconnect();
  }, [images.length]);

  React.useEffect(() => {
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      const w = groupWRef.current || 1;

      if (!isPointerDownRef.current) {
        offsetRef.current += baseSpeedRef.current * dt;
      }

      offsetRef.current = ((offsetRef.current % w) + w) % w;

      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${-offsetRef.current}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const nextIndex = (heroIndex + 1) % heroImages.length;

  React.useEffect(() => {
    const intervalMs = 2500;
    const slideMs = 650;

    const t = window.setInterval(() => {
      setIsSliding(true);

      window.setTimeout(() => {
        setHeroIndex((prev) => (prev + 1) % heroImages.length);
        setIsSliding(false);
      }, slideMs);
    }, intervalMs);

    return () => window.clearInterval(t);
  }, [heroImages.length]);

  const marqueeStyle = (
    <style>
      {`
        @keyframes heroSlideIn {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }

        @keyframes heroEnter {
          0%   { transform: translateX(22%); opacity: .75; filter: blur(1px); }
          100% { transform: translateX(0);   opacity: 1;   filter: blur(0); }
        }

        @keyframes heroExit {
          0%   { transform: translateX(0);   opacity: 1;   filter: blur(0); }
          100% { transform: translateX(-10%);opacity: 0;   filter: blur(1px); }
        }
      `}
    </style>
  );

  return (
    <div>
      {marqueeStyle}
      {/* Hero Section */}
      <section className="relative min-h-[60vh] sm:min-h-[70vh] lg:min-h-[80vh] flex items-center justify-center text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="h-full w-[200%] flex"
            style={{
              transform: isSliding ? "translateX(-50%)" : "translateX(0)",
              transition: isSliding ? "transform 650ms ease-in-out" : "none",
            }}
          >
            <div className="relative w-1/2 h-full">
              <img
                src={heroImages[heroIndex]}
                alt="hero-current"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover brightness-50"
              />
            </div>

            <div className="relative w-1/2 h-full">
              <img
                src={heroImages[nextIndex]}
                alt="hero-next"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover brightness-50"
              />
            </div>
          </div>
        </div>
        <div className="relative z-10 text-center max-w-4xl px-4">
          <h1
            className="
              font-serif font-bold text-white
              text-2xl sm:text-3xl lg:text-4xl
              leading-[1.1]
              drop-shadow
            "
          >
            Vườn Mai Gò Cát
          </h1>

          <p
            className="
              text-white/90
              text-sm sm:text-base lg:text-lg
              leading-[1.8]
              mt-3
            "
          >
            Tôn vinh nét đẹp Tết cổ truyền Việt
          </p>

          <button
            onClick={() => setCurrentPage("products")}
            className="mt-6 bg-amber-400 hover:bg-amber-500 text-amber-950 px-8 py-3 rounded-full font-bold text-lg transition-all shadow-lg active:scale-95"
          >
            Khám Phá Bộ Sưu Tập
          </button>
        </div>
      </section>

      {/* Intro Info */}
      <section className="bg-slate-50 pb-8">
        <div className="container mx-auto px-4">
          <div className="relative z-10 -mt-20 md:-mt-24 lg:-mt-32">
            <div className="max-w-4xl mx-auto bg-amber-50 rounded-2xl shadow-xl overflow-hidden md:flex">
              <div className="p-8 md:p-12 text-center flex-1">
                <h2 className="text-3xl md:text-4xl font-bold font-serif text-amber-900 uppercase tracking-wide leading-snug md:leading-tight mb-6">
                  Hơn 30 Năm Khẳng Định Chất Lượng
                </h2>
                <p className="text-slate-600 leading-relaxed text-lg text-pretty tracking-tight">
                  Vườn Mai Gò Cát tự hào là thương hiệu uy tín hàng đầu trong
                  ngành Mai, chuyên cung cấp Mai chưng Tết trong và ngoài nước
                  với hơn 30 năm kinh nghiệm. Chúng tôi cam kết mang đến cho quý
                  khách những tác phẩm tấm huyết, đẹp nhất và ý nghĩa nhất. Góp
                  phần tạo nên một mùa Tết trọn vẹn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Marquee Section */}
      <section className="container mx-auto px-4 pt-2 pb-20">
        <div className="py-10">
          <h2 className="text-3xl font-bold font-serif text-center">
            Khám phá Vườn Mai <span className="block sm:inline">Gò Cát</span>
          </h2>
        </div>

        <div className="relative overflow-hidden mt-10">
          <div
            className="
              pointer-events-none absolute inset-y-0 left-0 z-10
              w-12 sm:w-24
              bg-gradient-to-r
              from-white/60 sm:from-white
              to-transparent
            "
          />

          <div
            className="
              pointer-events-none absolute inset-y-0 right-0 z-10
              w-12 sm:w-24
              bg-gradient-to-l
              from-white/60 sm:from-white
              to-transparent
            "
          />

          <div
            ref={trackRef}
            className="flex w-max cursor-grab active:cursor-grabbing select-none"
            style={{
              willChange: "transform",
              touchAction: "pan-y",
            }}
            onPointerDown={(e) => {
              isPointerDownRef.current = true;
              startXRef.current = e.clientX;
              startOffsetRef.current = offsetRef.current;

              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!isPointerDownRef.current) return;

              const dx = e.clientX - startXRef.current;

              offsetRef.current = startOffsetRef.current - dx;

              const w = groupWRef.current || 1;
              offsetRef.current = ((offsetRef.current % w) + w) % w;

              if (trackRef.current) {
                trackRef.current.style.transform = `translateX(${-offsetRef.current}px)`;
              }
            }}
            onPointerUp={() => {
              isPointerDownRef.current = false;
            }}
            onPointerCancel={() => {
              isPointerDownRef.current = false;
            }}
          >
            <div ref={groupRef} className="flex gap-6 pr-6">
              {images.map((img, i) => (
                <div
                  key={`g1-${i}`}
                  className="group w-64 h-[220px] sm:h-[300px] lg:h-[500px] flex-shrink-0 rounded-2xl overflow-hidden shadow-md transition-shadow duration-300 hover:shadow-xl"
                >
                  <img
                    src={img}
                    alt={`marquee-${i}`}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    draggable={false}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-6 pr-6">
              {images.map((img, i) => (
                <div
                  key={`g2-${i}`}
                  className="group w-64 h-[220px] sm:h-[300px] lg:h-[500px] flex-shrink-0 rounded-2xl overflow-hidden shadow-md transition-shadow duration-300 hover:shadow-xl"
                >
                  <img
                    src={img}
                    alt={`marquee-${i}`}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Visit / Contact CTA Banner */}
      <section
        className="relative overflow-hidden py-12 sm:py-16 lg:py-20 text-white"
        style={{
          background: "linear-gradient(to right, #2F5D3A, #D4A017)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 600px at 85% 70%, rgba(255,255,255,0.18), rgba(0,0,0,0) 60%), linear-gradient(to right, rgba(0,0,0,0.12), rgba(0,0,0,0))",
            mixBlendMode: "overlay",
            opacity: 0.9,
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
        radial-gradient(circle at 88% 82%, rgba(255,255,255,0.50) 0 2px, transparent 3px),
        radial-gradient(circle at 92% 78%, rgba(255,255,255,0.35) 0 1.5px, transparent 3px),
        radial-gradient(circle at 84% 88%, rgba(255,255,255,0.28) 0 1.2px, transparent 3px),
        radial-gradient(circle at 95% 90%, rgba(255,255,255,0.22) 0 1.2px, transparent 3px),
        radial-gradient(circle at 80% 80%, rgba(255,255,255,0.18) 0 1px, transparent 3px),
        radial-gradient(circle at 90% 92%, rgba(255,255,255,0.18) 0 1px, transparent 3px),
        radial-gradient(700px 350px at 86% 86%, rgba(255,236,150,0.28), rgba(0,0,0,0) 60%)
      `,
            backgroundRepeat: "no-repeat",
            opacity: 0.9,
            filter: "blur(0.2px)",
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E\")",
            backgroundRepeat: "repeat",
            mixBlendMode: "soft-light",
            opacity: 0.28,
          }}
        />

        <div className="relative container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold font-serif mb-6">
            Ghé Thăm <span className="block sm:inline">Vườn Mai Gò Cát</span>
          </h2>

          <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto">
            Quý khách có thể ghé thăm trực tiếp vườn để trải nghiệm không gian
            mai vàng rực rỡ và được tư vấn tận tình.
          </p>

          <button
            onClick={() => setCurrentPage("contact")}
            className="bg-white text-[#2F5D3A] hover:bg-slate-100 px-10 py-4 rounded-full font-bold text-lg transition-all shadow-xl active:scale-95"
          >
            Liên Hệ Ngay
          </button>
        </div>
      </section>

      {/* Contact + Map */}
      <section className="py-12 sm:py-16 lg:py-20 container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-12 items-stretch">
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
                    56 Đường 882, P. Long Trường, Thành phố Hồ Chí Minh, Việt
                    Nam
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
                  <p className="text-slate-700">
                    0903 745 308: Nguyễn Thị Kim Trang
                  </p>
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
                  <p className="text-slate-700">
                    Thứ 2 - Chủ Nhật: 7:00 - 18:00
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <h3 className="text-3xl font-bold font-serif mb-10 border-l-4 border-amber-500 pl-4">
              Bản Đồ Đường Đi
            </h3>

            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl group min-h-[220px] sm:min-h-[280px] md:min-h-0 md:flex-1">
              <img
                src="/map.png"
                alt="Bản đồ Vườn Mai Gò Cát"
                className="absolute inset-0 w-full h-full object-cover
               transition-transform duration-700 ease-out
               group-hover:scale-105"
                draggable={false}
              />

              <div
                className="absolute inset-0 bg-black/30
               opacity-0 group-hover:opacity-100
               transition-opacity duration-500"
              />

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
    </div>
  );
};

export default Home;
