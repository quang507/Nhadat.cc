// escalation-feed — FR-140: cửa cho bridge acc clone (chạy local) kéo các
// việc "báo CTV/admin" khi OA chưa duyệt (nudge gửi OA không được thì reminder
// escalation vẫn pending ở đây). Bridge pull → tự resolve SĐT ra uid Zalo →
// gửi → ack lại. FR-149: kéo cả kind `report` (báo cáo CTV 17h) về Zalo admin.
// POST { action: "pull" } → { items: [{id, note, text, name, zalo_user_id, phone}] }
// POST { action: "ack", id } → { ok: true }
// Bảo vệ thêm (tuỳ chọn): đặt secret BRIDGE_SECRET trong Vault thì mọi request
// phải kèm header x-bridge-secret khớp; chưa đặt thì chỉ cần anon key như cũ.
import { escalationText, jsonResponse, serviceClient } from "../_shared/claude.ts";

const KINDS = ["escalation", "report"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const client = serviceClient();

  const { data: gate } = await client.rpc("get_secret", { secret_name: "BRIDGE_SECRET" });
  if (gate && req.headers.get("x-bridge-secret") !== gate) {
    return jsonResponse({ error: "bridge secret sai" }, 401);
  }

  // FR-152 nhịp tim: bridge gõ cửa đây mỗi phút, nên đây là chỗ RẺ NHẤT để
  // biết nó còn sống — khỏi thêm một dòng nào vào máy chạy bridge. Quá 15
  // phút không thấy nhịp trong giờ làm thì bot_health_tick() ghi sổ + báo.
  // (Lưu ý thật: tin báo đi ĐƯỜNG BRIDGE, nên bridge chết là tin nằm chờ tới
  //  lúc nó sống lại. Muốn biết ngay thì mở /admin — trang đó đọc bot_health.)
  await client.rpc("beat", { p_who: "bridge-zca" });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "pull");

  // FR-152: bridge chạy trên máy chủ dự án, console.error của nó hiện ở terminal
  // rồi mất theo cửa sổ. Cho nó một đường đẩy lỗi lên sổ chung — cùng cổng
  // x-bridge-secret đã có, khỏi mở thêm cửa nào.
  if (action === "log") {
    await client.rpc("log_loi", {
      p_source: `bridge ${String(body.source ?? "").slice(0, 30)}`.trim(),
      p_detail: String(body.detail ?? ""),
      p_code: null,
    });
    return jsonResponse({ ok: true });
  }

  if (action === "ack") {
    const id = String(body.id ?? "");
    if (!id) return jsonResponse({ error: "id bắt buộc" }, 400);

    // TỰ HỌC Zalo ID: bridge chỉ có SĐT thì nó gọi findUser để ra uid. Ghi ngược
    // uid đó vào đúng người — lần sau chat-reply nhận ra vai NGƯỜI BÁN ngay từ
    // tin đầu, khỏi chờ ai điền tay. Chỉ ghi khi ô đang trống, không đè.
    const learned = body.zalo_user_id ? String(body.zalo_user_id).trim() : "";
    if (learned) {
      const { data: r } = await client.from("reminders")
        .select("seller_id, ctv_id").eq("id", id).maybeSingle();
      if (r?.seller_id) {
        await client.from("sellers").update({ zalo_user_id: learned })
          .eq("id", r.seller_id).is("zalo_user_id", null);
      } else if (r?.ctv_id) {
        await client.from("ctvs").update({ zalo_user_id: learned })
          .eq("id", r.ctv_id).is("zalo_user_id", null);
      } else {
        await client.from("admins").update({ zalo_user_id: learned })
          .is("zalo_user_id", null);
      }
    }

    await client.from("reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id).in("kind", KINDS);
    return jsonResponse({ ok: true, learned_zalo_id: !!learned });
  }

  // pull: việc pending tới hạn + đích liên lạc theo vai:
  // seller (FR-144 — chủ động hỏi chính chủ) → CTV được giao → admin.
  const { data: due } = await client
    .from("reminders")
    .select("id, kind, note, ctv_id, seller_id, ctvs(name, zalo_user_id, phone), sellers(name, zalo_user_id, phone)")
    .eq("status", "pending").in("kind", KINDS)
    .lte("due_at", new Date().toISOString())
    .limit(10);
  const { data: adm } = await client.from("admins")
    .select("zalo_user_id, zalo_phone").limit(1).maybeSingle();

  type Target = { name?: string | null; zalo_user_id?: string | null; phone?: string | null } | null;
  const items = (due ?? []).map((r) => {
    const ctv = r.ctvs as Target;
    const seller = r.sellers as Target;
    return {
      id: r.id,
      note: r.note,
      // Text soạn sẵn dùng chung với nudge (_shared/claude.ts) — hai đường đi
      // ra ngoài (OA và bridge) phải nói y hệt nhau.
      text: escalationText(r),
      name: seller?.name ?? ctv?.name ?? "admin",
      zalo_user_id: seller?.zalo_user_id ?? ctv?.zalo_user_id ?? adm?.zalo_user_id ?? null,
      phone: seller?.phone ?? ctv?.phone ?? adm?.zalo_phone ?? null,
    };
  });
  return jsonResponse({ items });
});
