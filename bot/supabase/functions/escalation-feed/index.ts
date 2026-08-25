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

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "pull");

  if (action === "ack") {
    const id = String(body.id ?? "");
    if (!id) return jsonResponse({ error: "id bắt buộc" }, 400);
    await client.from("reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id).in("kind", KINDS);
    return jsonResponse({ ok: true });
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
