"use client";
// Admin (FR-127): duyệt tin cho_thong_tin → dang_ban / ẩn (an) theo vòng đời
// FR-139 (cho_thong_tin → dang_ban → dang_quan_tam → da_chot). Quyền cấp theo
// bảng `admins` (email) — RLS phía DB mới là hàng rào thật, trang này chỉ là UI.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type Listing } from "@/lib/supabase";
import { formatArea, formatPrice, sanitizeDescription } from "@/lib/format";

// Tin chờ duyệt: chỉ các cột thẻ duyệt cần, không kéo "*".
type TinCho = Pick<
  Listing,
  "id" | "code" | "ward" | "price_vnd" | "price_raw" | "area_m2" | "description" | "location_raw" | "created_at"
>;

type Ng = {
  id: string;
  name: string | null;
  seller_type: string;
  active_count: number;
  closed_count: number;
  rank: string;
};

type Tien = {
  day: string;
  model_calls: number;
  in_tokens: number;
  out_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
};

// Giá niêm yết Opus 5, đô trên MỘT TRIỆU chữ-máy. Để thành hằng số ở đây, không
// nhét vào DB: giá đổi thì sửa một chỗ này, còn số chữ đã ghi trong DB vẫn đúng
// mãi mãi. Ngược lại — lưu sẵn thành tiền trong DB — là để lại một cột số sai mà
// không ai biết là nó đã sai từ lúc nào.
const GIA_VAO = 5;
const GIA_RA = 25;
const HE_SO_NAP = 2; // nhịp nhớ tạm 1 giờ; xem chat-reply chỗ cache_control
const HE_SO_DOC = 0.1;

const tienNgay = (t: Tien) =>
  (t.in_tokens * GIA_VAO +
    t.out_tokens * GIA_RA +
    t.cache_write_tokens * GIA_VAO * HE_SO_NAP +
    t.cache_read_tokens * GIA_VAO * HE_SO_DOC) / 1_000_000;

type Viec = { id: string; kind: string; note: string | null; due_at: string; created_at: string };
type NguoiBan = {
  id: string; name: string | null; seller_type: string; created_at: string; zalo_user_id: string | null;
};
const NHAN: Record<string, string> = { ccrb: "Chính chủ · 1%", nmg: "Môi giới · 0,5%", unknown: "Chưa nhãn" };

const HANG: Record<string, { ten: string; lop: string }> = {
  vang: { ten: "Vàng", lop: "bg-[#f6c453] text-navy" },
  bac:  { ten: "Bạc",  lop: "bg-line text-navy" },
  dong: { ten: "Đồng", lop: "bg-[#e2c9b0] text-navy" },
};

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [pending, setPending] = useState<TinCho[]>([]);
  const [counts, setCounts] = useState<{ tong: number; active: number; cho: number }>();
  // FR-152: sức khoẻ bot. Đọc THẲNG từ DB bằng phiên admin — cố tình KHÔNG đi
  // qua bridge, vì còi báo "bridge chết" mà lại gửi bằng bridge thì vô nghĩa.
  const [health, setHealth] = useState<{
    beat: string | null;
    errs: { id: number; at: string; source: string; status_code: number | null; detail: string | null }[];
  }>();
  // FR-155: hạng người rao. CHỈ hiện ở đây, không hiện trên web (OPEN-26 —
  // quyết định chủ dự án 27/08/2026). Chưa ai chốt được căn nào nên chưa ai lên
  // Vàng được; đưa ra trước mặt khách lúc này là dựng thang bịt bậc trên cùng.
  const [hang, setHang] = useState<Ng[]>([]);
  // Tiền bộ não (migration 20260901b). Đếm LƯỢT không trả lời được câu "scale
  // lên có chịu nổi không" — tiền tính theo CHỮ, và bốn loại chữ lệch giá tới
  // 50 lần. Đây là chỗ đọc số thật thay vì ước tính.
  const [tien, setTien] = useState<Tien[]>([]);
  // 02/09 — "hiện thông báo cho admin". Đường cũ là hàng escalation đi qua
  // bridge tới Zalo admin; bridge chết từ 27/08 nên 85 việc xếp hàng không ai
  // thấy. Đọc THẲNG bảng ở đây, đóng việc ngay tại chỗ.
  const [viec, setViec] = useState<Viec[]>([]);
  // Người bán mới 14 ngày: nhãn bot gán lúc bóc tách — sai thì đổi ở đây.
  const [nguoiBan, setNguoiBan] = useState<NguoiBan[]>([]);

  // MỘT đợt cho cả trang (FR-171 j). Trước bản này là 5 đợt nối tiếp (12 truy
  // vấn), mỗi đợt một lần thời gian mạng VN→Supabase ~150-250 ms, tức 1-1,5 s
  // trước khi có số. Không truy vấn nào ở đây cần kết quả của truy vấn khác.
  // Ba lần `count: exact` trên `listings` (3 lần quét bảng) thay bằng MỘT lượt
  // đọc cột `status` rồi đếm tại chỗ — kho ~200 dòng, rẻ hơn ba lần quét.
  const load = async () => {
    const [pend, st, beatRes, errRes, tn, vc, nb, hg] = await Promise.all([
      supabase
        .from("listings")
        .select("id, code, ward, price_vnd, price_raw, area_m2, description, location_raw, created_at")
        .eq("status", "cho_thong_tin")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("listings").select("status"),
      supabase.from("bot_health").select("at").eq("who", "bridge-zca").maybeSingle(),
      supabase.from("bot_errors").select("id, at, source, status_code, detail")
        .order("at", { ascending: false }).limit(10),
      supabase
        .from("bot_usage")
        .select("day, model_calls, in_tokens, out_tokens, cache_write_tokens, cache_read_tokens")
        .order("day", { ascending: false }).limit(7),
      supabase.from("reminders")
        .select("id, kind, note, due_at, created_at")
        .eq("status", "pending").in("kind", ["escalation", "report"])
        .order("due_at", { ascending: true }).limit(30),
      supabase.from("sellers")
        .select("id, name, seller_type, created_at, zalo_user_id")
        .gte("created_at", new Date(Date.now() - 14 * 86400e3).toISOString())
        .order("created_at", { ascending: false }).limit(20),
      supabase
        .from("seller_ranks")
        .select("id, name, seller_type, active_count, closed_count, rank")
        .order("active_count", { ascending: false }).limit(50),
    ]);
    setPending((pend.data ?? []) as TinCho[]);
    const trangThai = (st.data ?? []).map((r) => r.status as string);
    setCounts({
      tong: trangThai.length,
      active: trangThai.filter((s) => s === "dang_ban" || s === "dang_quan_tam").length,
      cho: trangThai.filter((s) => s === "cho_thong_tin").length,
    });
    setHealth({ beat: (beatRes.data?.at as string) ?? null, errs: errRes.data ?? [] });
    setTien((tn.data ?? []) as Tien[]);
    setViec((vc.data ?? []) as Viec[]);
    setNguoiBan((nb.data ?? []) as NguoiBan[]);
    setHang((hg.data ?? []) as Ng[]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setRole("anon");
      const { data: a } = await supabase
        .from("admins").select("email").eq("email", user.email ?? "").maybeSingle();
      if (!a) return setRole("user");
      setRole("admin");
      load();
    });
  }, []);

  // Đóng một việc chờ: đánh dấu đã gửi (admin đã đọc ở đây thay vì qua Zalo).
  const dongViec = async (id: string) => {
    const { error } = await supabase.from("reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (!error) setViec((v) => v.filter((x) => x.id !== id));
  };
  // Đổi nhãn người bán. RLS phía DB (sellers_admin_update) mới là hàng rào.
  const doiNhan = async (id: string, seller_type: "ccrb" | "nmg") => {
    const { error } = await supabase.from("sellers").update({ seller_type }).eq("id", id);
    if (!error) setNguoiBan((l) => l.map((s) => (s.id === id ? { ...s, seller_type } : s)));
  };

  const setStatus = async (id: string, status: "dang_ban" | "an") => {
    const { error } = await supabase.from("listings").update({ status }).eq("id", id);
    if (!error) setPending((p) => p.filter((l) => l.id !== id));
  };

  if (role === "loading") return <div className="mx-auto max-w-4xl px-4 py-16 text-mute">Đang kiểm tra quyền…</div>;
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Khu vực quản trị</h1>
        <p className="mt-2 text-mute">
          {role === "anon" ? "Cần đăng nhập bằng tài khoản quản trị." : "Tài khoản này không có quyền quản trị."}
        </p>
        {role === "anon" && (
          <Link href="/dang-nhap" className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 font-bold text-white">
            Đăng nhập
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Duyệt tin</h1>
        <Link
          href="/admin/dang-tin"
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]"
        >
          + Đăng tin thủ công
        </Link>
      </div>
      {counts && (
        <p className="mt-1 text-sm text-mute tabular-nums">
          {counts.tong} tin tổng · {counts.active} đang rao · {counts.cho} chờ duyệt
        </p>
      )}

      {/* FR-152 — sức khoẻ bot */}
      {health && (
        <div className="mt-6 rounded-king border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="eyebrow text-mute">Sức khoẻ bot</span>
            <BridgeBadge at={health.beat} />
            <span className="text-sm text-mute">
              {health.errs.length ? `${health.errs.length} lỗi gần nhất` : "Không có lỗi nào được ghi"}
            </span>
          </div>
          {health.errs.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {health.errs.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-3 py-2">
                  <span className="w-32 shrink-0 tabular-nums text-mute">
                    {new Date(e.at).toLocaleString("vi-VN")}
                  </span>
                  <span className="font-semibold">
                    {e.source}
                    {e.status_code ? ` · ${e.status_code}` : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-navy/75">{e.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Việc chờ admin — đọc thẳng bảng, không qua bridge (02/09) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">Việc chờ admin</span>
          <span className="text-sm text-mute">
            {viec.length ? `${viec.length} việc đang chờ` : "Không có việc nào chờ"}
          </span>
        </div>
        {viec.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {viec.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start gap-x-3 py-2">
                <span className="w-32 shrink-0 tabular-nums text-mute">
                  {new Date(v.created_at).toLocaleString("vi-VN")}
                </span>
                <span className="min-w-0 flex-1 text-navy/85">{v.note}</span>
                <button onClick={() => dongViec(v.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand">
                  Đã xử lý
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Người bán mới — nhãn bot gán lúc bóc tách, sửa tại chỗ (02/09) */}
      {nguoiBan.length > 0 && (
        <div className="mt-6 rounded-king border border-line bg-white p-5">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="eyebrow text-mute">Người bán 14 ngày qua</span>
            <span className="text-sm text-mute">nhãn quyết định mức phí — bấm để đổi nếu bot gán sai</span>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {nguoiBan.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className="w-28 shrink-0 tabular-nums text-mute">
                  {new Date(s.created_at).toLocaleDateString("vi-VN")}
                </span>
                <span className="font-semibold">{s.name ?? "Chưa có tên"}</span>
                <span className="text-mute">{s.zalo_user_id ? "từ chat" : "tạo tay"}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                  s.seller_type === "unknown" ? "bg-navy text-white" : "bg-brand/10 text-brand"
                }`}>
                  {NHAN[s.seller_type] ?? s.seller_type}
                </span>
                <span className="ml-auto flex gap-2">
                  {(["ccrb", "nmg"] as const).filter((t) => t !== s.seller_type).map((t) => (
                    <button key={t} onClick={() => doiNhan(s.id, t)}
                      className="rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand">
                      Đổi thành {t === "ccrb" ? "chính chủ" : "môi giới"}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tiền bộ não — số ĐO, không phải ước tính (migration 20260901b) */}
      {tien.length > 0 && <TheTien rows={tien} />}

      {/* FR-155 — hạng người rao. Nội bộ, KHÔNG lên web (OPEN-26). */}
      {hang.length > 0 && (
        <div className="mt-6 rounded-king border border-line bg-white p-5">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="eyebrow text-mute">Hạng người rao</span>
            <span className="text-sm text-mute">
              chưa hiện trên web — chờ có giao dịch chốt thật (OPEN-26)
            </span>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {hang.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${HANG[n.rank]?.lop ?? "bg-line"}`}>
                  {HANG[n.rank]?.ten ?? n.rank}
                </span>
                <span className="font-semibold">{n.name ?? "Không tên"}</span>
                <span className="text-mute">{n.seller_type.toUpperCase()}</span>
                <span className="ml-auto tabular-nums text-mute">
                  {n.active_count} tin đang rao · {n.closed_count} đã chốt
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {pending.map((l) => (
          <div key={l.id} className="rounded-king border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">
                #{l.code} · {l.ward} · {formatPrice(l.price_vnd, l.price_raw)} · {formatArea(l.area_m2)}
              </p>
              <span className="text-xs text-mute">{new Date(l.created_at).toLocaleString("vi-VN")}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-navy/80">
              {sanitizeDescription(l.description) || l.location_raw}
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setStatus(l.id, "dang_ban")}
                className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]">
                Duyệt — cho rao
              </button>
              <button onClick={() => setStatus(l.id, "an")}
                className="rounded-full border border-line px-5 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand active:scale-[0.98]">
                Ẩn tin
              </button>
              <Link href={`/nha-dat/${encodeURIComponent(l.code ?? "")}`} target="_blank"
                className="ml-auto self-center text-sm font-semibold text-mute hover:text-brand">
                Xem trang tin →
              </Link>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <div className="rounded-king border border-line bg-white p-10 text-center text-mute">
            Không còn tin chờ duyệt.
          </div>
        )}
      </div>
    </div>
  );
}

// Tiền bộ não, 7 ngày gần nhất.
//
// Con số đáng nhìn nhất KHÔNG phải tổng tiền mà là TRUNG BÌNH MỘT LƯỢT: tổng
// tiền lớn lên theo số khách là chuyện đương nhiên và lành mạnh, còn trung bình
// một lượt phình ra mới là dấu hiệu prompt đang béo dần hoặc nhớ tạm đang trượt.
//
// Cột "đọc lại" là sức khoẻ bộ nhớ tạm. Dưới 50% nghĩa là phần lớn lượt phải nạp
// lại khối luật từ đầu — đang trả giá nạp (2 lần) mà không hưởng giá đọc (1/10),
// tức là đắt hơn cả không dùng nhớ tạm. Gặp vậy thì đổi nhịp nhớ tạm trong
// chat-reply (khối bình luận ngay chỗ cache_control giải thích chọn nhịp nào).
function TheTien({ rows }: { rows: Tien[] }) {
  const tong = rows.reduce((s, t) => s + tienNgay(t), 0);
  const tongLuot = rows.reduce((s, t) => s + t.model_calls, 0);
  const tongNap = rows.reduce((s, t) => s + t.cache_write_tokens, 0);
  const tongDoc = rows.reduce((s, t) => s + t.cache_read_tokens, 0);
  // Chưa deploy bản có đồng hồ thì mọi cột chữ đều bằng 0 — nói thẳng ra vậy,
  // đừng hiện "$0.00" như thể đã đo được và bot chạy miễn phí.
  const daDo = rows.some((t) => t.in_tokens + t.out_tokens + tongNap + tongDoc > 0);
  const tyLeDoc = tongNap + tongDoc > 0 ? tongDoc / (tongNap + tongDoc) : null;

  return (
    <div className="mt-6 rounded-king border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="eyebrow text-mute">Tiền bộ não · 7 ngày</span>
        {daDo ? (
          <>
            <span className="font-bold tabular-nums">${tong.toFixed(2)}</span>
            <span className="text-sm text-mute tabular-nums">
              {tongLuot} lượt · trung bình ${tongLuot ? (tong / tongLuot).toFixed(3) : "—"}/lượt
            </span>
            {tyLeDoc !== null && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  tyLeDoc >= 0.5 ? "bg-brand/10 text-brand" : "bg-navy text-white"
                }`}
              >
                nhớ tạm: đọc lại {Math.round(tyLeDoc * 100)}%
                {tyLeDoc >= 0.5 ? "" : " — đang lỗ, xem lại nhịp"}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-mute">
            chưa đo được chữ — bản chat-reply có đồng hồ chưa được deploy; cột dưới
            mới chỉ đếm lượt
          </span>
        )}
      </div>

      <ul className="mt-3 divide-y divide-line text-sm">
        {rows.map((t) => (
          <li key={t.day} className="flex flex-wrap gap-x-3 py-2">
            <span className="w-28 shrink-0 tabular-nums text-mute">
              {new Date(t.day).toLocaleDateString("vi-VN")}
            </span>
            <span className="w-20 shrink-0 tabular-nums">{t.model_calls} lượt</span>
            <span className="w-24 shrink-0 tabular-nums font-semibold">
              {t.in_tokens + t.out_tokens + t.cache_write_tokens + t.cache_read_tokens > 0
                ? `$${tienNgay(t).toFixed(3)}`
                : "—"}
            </span>
            <span className="min-w-0 flex-1 tabular-nums text-navy/60">
              vào {t.in_tokens.toLocaleString("vi-VN")} · ra{" "}
              {t.out_tokens.toLocaleString("vi-VN")} · nạp{" "}
              {t.cache_write_tokens.toLocaleString("vi-VN")} · đọc lại{" "}
              {t.cache_read_tokens.toLocaleString("vi-VN")}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-mute">
        Cận trên: tính giá nạp theo nhịp 1 giờ (2× — nhịp của lượt khách mua). Lượt
        người bán để nhịp 5 phút nên rẻ hơn một chút. Từ 02/09 cả bốn nơi gọi bộ
        não (chat-reply, nudge, ask-seller, ctv-report) đều gắn đồng hồ — đây là
        tổng, không còn là sàn.
      </p>
    </div>
  );
}

// Nhịp tim bridge. Ba trạng thái, không phải hai: "chưa từng chạy" khác hẳn
// "đã chết" — báo nhầm cái đầu thành cái sau là còi giả ngay ngày đầu.
function BridgeBadge({ at }: { at: string | null }) {
  if (!at) {
    return (
      <span className="rounded-full bg-line px-3 py-1 text-xs font-bold text-mute">
        bridge: chưa từng gõ cửa
      </span>
    );
  }
  const phut = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  const song = phut <= 15;
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        song ? "bg-brand/10 text-brand" : "bg-navy text-white"
      }`}
    >
      bridge: {song ? "đang sống" : `im ${phut} phút`}
    </span>
  );
}
