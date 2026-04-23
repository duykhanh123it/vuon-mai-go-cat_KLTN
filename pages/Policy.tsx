import React from "react";
import { SHOP_POLICY_VERSION } from "../utils/policy";

type PolicyBlock = {
  title: string;
  points: string[];
};

const systemHighlights = [
  "Thêm vào giỏ, checkout hoặc tạo đơn new chưa đồng nghĩa giữ cây.",
  "Đơn thuê chỉ giữ cây khi admin xác nhận và đã thu cọc tối thiểu theo quy định.",
  "Đơn mua chỉ giữ cây khi admin xác nhận đơn hợp lệ và chốt giữ cây cho khách.",
  "Mỗi cây là tài sản riêng biệt, quyền giữ cây thuộc về đơn đủ điều kiện trước.",
];

const systemPrinciples: PolicyBlock[] = [
  {
    title: "1. Nguyên tắc áp dụng toàn hệ thống",
    points: [
      "Cây trên hệ thống là tài sản riêng lẻ, mỗi cây có mã định danh, tình trạng và lịch vận hành riêng.",
      "Việc khách thêm cây vào giỏ, điền checkout hoặc tạo đơn ở trạng thái new chưa đồng nghĩa cây đã được giữ.",
      "Cây chỉ được xem là được giữ cho khách khi đơn đạt điều kiện giữ cây theo từng loại giao dịch.",
      "Nhà vườn chỉ xác nhận giao hoặc bàn giao khi cây còn đủ điều kiện vận hành thực tế.",
    ],
  },
  {
    title: "2. Nguyên tắc ưu tiên giữ cây",
    points: [
      "Nếu có nhiều khách cùng quan tâm một cây, quyền giữ cây thuộc về đơn đủ điều kiện giữ cây trước.",
      "Với đơn thuê, mốc giữ cây là khi admin xác nhận và đã thu cọc tối thiểu theo quy định.",
      "Với đơn mua, mốc giữ cây là khi admin xác nhận đơn hợp lệ và chốt giữ cây cho khách.",
      "Trong các tình huống phát sinh đặc thù, nhà vườn có thể trao đổi trực tiếp với khách để thống nhất phương án phù hợp nhưng vẫn ưu tiên theo nguyên tắc chung của chính sách.",
    ],
  },
];

const summaryNotes = [
  "Tạo đơn hoặc thêm vào giỏ chưa đồng nghĩa giữ cây.",
  "Đơn thuê completed nghĩa là đã kết thúc hợp đồng thuê, không phải chỉ mới giao cây.",
  "Hủy sau khi cây đã được giữ hoặc đã chuẩn bị giao có thể phát sinh khấu trừ cọc hoặc chi phí thực tế.",
];

const rentHighlights = [
  "Giá thuê niêm yết mặc định áp dụng cho 1 chu kỳ thuê chuẩn từ 5 đến 10 ngày.",
  "Đơn thuê chỉ được giữ cây khi admin xác nhận và đã thu tối thiểu 30% tổng đơn hoặc 500.000đ, tùy mức nào cao hơn.",
  "Gia hạn chỉ được chấp thuận khi cây chưa bị xếp cho lịch khác và admin đồng ý trước.",
  "Trả trễ, hư hỏng, mất cây, mất chậu hoặc mất phụ kiện có thể bị khấu trừ cọc hoặc bồi thường.",
];

const rentSections: PolicyBlock[] = [
  {
    title: "1. Phạm vi áp dụng",
    points: [
      "Áp dụng cho các cây có hiển thị giá thuê trên hệ thống.",
      "Giá thuê niêm yết mặc định là giá cho 1 chu kỳ thuê chuẩn từ 5 đến 10 ngày, trừ khi có ghi chú khác.",
      "Mỗi cây là một tài sản riêng biệt, không gộp số lượng như hàng hóa tiêu chuẩn.",
      "Đơn thuê được vận hành theo trạng thái new → confirmed → active → completed.",
    ],
  },
  {
    title: "2. Điều kiện giữ cây",
    points: [
      "Khi khách hoàn tất đặt đơn, đơn được tạo ở trạng thái new và chưa giữ cây thật.",
      "Đơn thuê chỉ được chuyển sang confirmed khi admin xác nhận cây sẵn sàng cho thuê và khách đã đặt cọc tối thiểu theo quy định.",
      "Mức cọc tiêu chuẩn để giữ cây là 30% tổng giá trị đơn hoặc 500.000đ/đơn, tùy mức nào cao hơn, trừ khi nhà vườn có xác nhận khác cho từng trường hợp cụ thể.",
      "Chỉ khi đơn đã ở trạng thái confirmed, cây mới được xem là được giữ cho khách.",
    ],
  },
  {
    title: "3. Trạng thái đơn thuê",
    points: [
      "new: đơn mới tạo, chưa giữ cây thật, chờ admin kiểm tra tình trạng cây, lịch thuê và điều kiện vận hành.",
      "confirmed: admin đã xác nhận đơn và đơn đã đủ điều kiện giữ cây; đây là mốc chính thức giữ cây cho khách.",
      "active: cây đã được bàn giao cho khách hoặc đã bắt đầu thời gian thuê thực tế; cây không mở lại cho đơn khác trong giai đoạn này.",
      "completed: đơn thuê đã kết thúc, cây đã được nhận lại và các chi phí liên quan của đơn đã được xử lý xong.",
    ],
  },
  {
    title: "4. Giá thuê, gia hạn và phát sinh",
    points: [
      "Nếu thời gian thuê ngắn hơn hoặc dài hơn khung tiêu chuẩn, chi phí có thể được điều chỉnh theo thực tế vận hành.",
      "Khách cần báo yêu cầu gia hạn trước thời điểm kết thúc thuê dự kiến; gia hạn chỉ được chấp thuận khi cây chưa được xếp cho lịch tiếp theo và admin đồng ý.",
      "Phí gia hạn, trả trễ hoặc các phát sinh đặc thù sẽ được ghi nhận theo tình trạng thực tế của từng đơn.",
      "Các khoản phát sinh có thể bao gồm giao gấp, giao ngoài phạm vi tiêu chuẩn, vệ sinh, phục hồi hoặc xử lý tổn thất trong quá trình thuê.",
    ],
  },
  {
    title: "5. Trả cây, hủy đơn và bồi thường",
    points: [
      "Khi kết thúc thời gian thuê, khách có trách nhiệm hoàn trả cây, chậu và phụ kiện đi kèm theo hiện trạng hợp lý để nhà vườn kiểm tra.",
      "Hủy khi đơn còn ở trạng thái new thường không phát sinh phí, trừ khi đã có chi phí chuẩn bị riêng theo yêu cầu của khách.",
      "Hủy sau khi đơn đã confirmed có thể bị hoàn một phần cọc, khấu trừ một phần hoặc không hoàn toàn bộ tùy thời điểm hủy và mức độ chuẩn bị thực tế.",
      "Nếu cây, chậu hoặc phụ kiện bị hư hỏng, mất mát hoặc xuống cấp bất thường do quá trình sử dụng, nhà vườn có quyền khấu trừ cọc, thu thêm chi phí khắc phục hoặc yêu cầu bồi thường theo thiệt hại thực tế.",
    ],
  },
];

const buyHighlights = [
  "Đơn mua tạo xong vẫn ở trạng thái new; cây chưa chắc chắn được giữ cho khách.",
  "Cây chỉ được giữ khi admin xác nhận đơn hợp lệ và chốt giữ cây.",
  "Nhà vườn có thể yêu cầu cọc, thanh toán một phần hoặc thanh toán đủ trước khi giao tùy từng đơn.",
  "Đơn mua chỉ completed khi giao xong và nghĩa vụ thanh toán đã hoàn tất.",
];

const buySections: PolicyBlock[] = [
  {
    title: "1. Phạm vi áp dụng",
    points: [
      "Áp dụng cho các cây có hiển thị giá bán trên hệ thống.",
      "Mỗi cây là một tài sản riêng biệt, có thể khác nhau về dáng, mã cây, chậu, kích thước và tình trạng thực tế.",
      "Đơn mua được vận hành theo trạng thái new → confirmed → delivering → completed.",
      "Thông tin ảnh, mã cây, ghi chú và giá tại thời điểm đặt đơn được xem là snapshot của đơn trong giai đoạn vận hành hiện tại.",
    ],
  },
  {
    title: "2. Điều kiện giữ cây",
    points: [
      "Khi khách hoàn tất đặt đơn, đơn được tạo ở trạng thái new và chưa chắc chắn giữ cây.",
      "Admin sẽ kiểm tra tình trạng cây, khả năng giao hàng và điều kiện thanh toán trước khi xác nhận.",
      "Đơn mua chỉ được chuyển sang confirmed khi admin xác nhận cây có thể bán cho khách và chốt giữ cây cho đơn đó.",
      "Trong trường hợp hiếm gặp có xung đột thời điểm giữa nhiều đơn, đơn được xác nhận hợp lệ trước sẽ được ưu tiên giữ cây.",
    ],
  },
  {
    title: "3. Thanh toán và giao hàng",
    points: [
      "Nhà vườn có thể áp dụng thanh toán trước toàn bộ, đặt cọc trước, thanh toán một phần trước khi giao hoặc thanh toán khi giao theo thỏa thuận của từng đơn.",
      "Nếu khách không hoàn thành nghĩa vụ thanh toán theo mốc đã thống nhất, nhà vườn có quyền không tiếp tục giữ cây hoặc lùi lịch giao.",
      "Trạng thái delivering được dùng khi cây đang trong quá trình chuẩn bị giao, đang vận chuyển hoặc đang chờ hoàn tất bàn giao thực tế.",
      "Thông tin giao hàng đã chốt tại checkout sẽ được lưu theo đơn để đội vận hành giao đúng địa chỉ đã thống nhất.",
    ],
  },
  {
    title: "4. Hủy đơn và đổi lịch giao",
    points: [
      "Hủy khi đơn còn ở trạng thái new thường chưa phát sinh chi phí, trừ khi nhà vườn đã thực hiện chuẩn bị riêng theo yêu cầu.",
      "Hủy sau khi đơn đã confirmed có thể phát sinh khấu trừ cọc hoặc chi phí thực tế tùy mức độ chuẩn bị và thời điểm hủy.",
      "Nếu đơn đã vào delivering, việc hủy có thể phát sinh thêm chi phí vận chuyển, xử lý hoặc hoàn trả.",
      "Khách nên báo sớm khi cần đổi lịch để nhà vườn sắp xếp lại vận hành; nhà vườn sẽ hỗ trợ trong phạm vi có thể nhưng không cam kết đáp ứng mọi yêu cầu đổi lịch nếu đơn đã vào giai đoạn chuẩn bị giao hoặc đang giao.",
    ],
  },
  {
    title: "5. Hoàn tất đơn mua",
    points: [
      "Trạng thái completed chỉ được dùng khi cây đã giao xong và nghĩa vụ thanh toán của đơn đã hoàn tất.",
      "Với các cây có tính cá thể cao, tình trạng thực tế tại thời điểm bàn giao có thể được admin xác nhận lại trước khi chốt giao.",
      "Khách nên kiểm tra kỹ thông tin cây, chậu, kích thước, tình trạng và các yêu cầu liên quan trước khi xác nhận đơn.",
      "Với trường hợp phát sinh ngoài tiêu chuẩn, nhà vườn có thể trao đổi trực tiếp với khách để chốt phương án xử lý phù hợp.",
    ],
  },
];

const commonNotes = [
  "Ở giai đoạn v1, một số khoản như gia hạn thuê, trả trễ, hư hỏng chi tiết, phụ phí vận chuyển đặc biệt hoặc bồi thường có thể được admin xác nhận thủ công trong đơn.",
  "Một số tình huống đặc thù chưa thể chuẩn hóa hoàn toàn trên giao diện sẽ được xử lý bằng xác nhận trực tiếp giữa nhà vườn và khách hàng.",
  "Khi hệ thống được nâng cấp thêm các trường dữ liệu và rule vận hành, chính sách này có thể tiếp tục được cập nhật để phản ánh đúng cách vận hành mới nhất.",
];

const SummaryCard: React.FC<{ items: string[] }> = ({ items }) => (
  <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
      Tóm tắt quan trọng
    </p>
    <div className="mt-5 grid gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm font-medium leading-relaxed text-amber-950"
        >
          {item}
        </div>
      ))}
    </div>
  </section>
);

const SectionCard: React.FC<{
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  sections: PolicyBlock[];
}> = ({ id, eyebrow, title, description, highlights, sections }) => (
  <section
    id={id}
    className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
  >
    <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-slate-600">
          {description}
        </p>
      </div>
      <div className="grid gap-2 sm:max-w-sm">
        {highlights.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-900"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {sections.map((section) => (
        <article
          key={section.title}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
        >
          <h3 className="text-lg font-bold text-slate-900">{section.title}</h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
            {section.points.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-1 text-amber-600">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  </section>
);

const PolicyPage: React.FC = () => {
  return (
    <div className="bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                Chính sách áp dụng toàn hệ thống
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Chính Sách Thuê & Mua
              </h1>
              <p className="mt-4 leading-relaxed text-slate-600">
                Trang này tổng hợp các quy định áp dụng cho luồng thuê cây và mua
                cây trên website Vườn Mai Gò Cát. Khách hàng nên đọc trước khi đặt
                đơn để hiểu rõ điều kiện giữ cây, thanh toán, giao nhận, gia hạn,
                hủy đơn và xử lý phát sinh.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("policy-rent")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-slate-900 px-6 py-3 text-base font-semibold text-amber-700 transition hover:bg-slate-50"
                >
                  Xem nhanh chính sách thuê
                </button>

                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("policy-buy")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-amber-300 px-6 py-3 text-base font-semibold text-amber-700 transition hover:bg-amber-50"
                >
                  Xem nhanh chính sách mua
                </button>
              </div>
            </div>
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 lg:max-w-sm">
              <p className="font-bold">Phiên bản chính sách</p>
              <p className="mt-2">{SHOP_POLICY_VERSION}</p>
              <p className="mt-3 text-amber-900/80">
                Đơn hàng tạo mới trên hệ thống sẽ yêu cầu khách xác nhận đã đọc và
                đồng ý với chính sách này trước khi gửi đơn.
              </p>
            </div>
          </div>
        </section>

        <SummaryCard items={summaryNotes} />

        <SectionCard
          id="policy-system"
          eyebrow="Áp dụng cho toàn hệ thống"
          title="Nguyên tắc vận hành chung"
          description="Các nguyên tắc dưới đây giúp khóa logic giữ cây, giảm hiểu sai giữa khách hàng, admin và hệ thống trong quá trình vận hành thực tế."
          highlights={systemHighlights}
          sections={systemPrinciples}
        />

        <SectionCard
          id="policy-rent"
          eyebrow="Dành cho đơn thuê"
          title="Chính sách thuê cây"
          description="Bản này bám sát flow new → confirmed → active → completed và làm rõ thời điểm giữ cây, điều kiện gia hạn, hủy đơn và hoàn tất hợp đồng thuê."
          highlights={rentHighlights}
          sections={rentSections}
        />

        <SectionCard
          id="policy-buy"
          eyebrow="Dành cho đơn mua"
          title="Chính sách mua cây"
          description="Bản này bám sát flow new → confirmed → delivering → completed và làm rõ điều kiện giữ cây, thanh toán, giao hàng, hủy đơn và hoàn tất giao dịch mua."
          highlights={buyHighlights}
          sections={buySections}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900">
            Lưu ý vận hành giai đoạn v1
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {commonNotes.map((note) => (
              <div
                key={note}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-600"
              >
                {note}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PolicyPage;
