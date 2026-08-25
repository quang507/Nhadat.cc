// escalation-feed — FR-140: cửa cho bridge acc clone (chạy local) kéo các
// việc "báo CTV/admin" khi OA chưa duyệt (nudge gửi OA không được thì reminder
// escalation vẫn pending ở đây). Bridge pull → tự resolve SĐT ra uid Zalo →
// gửi → ack lại.
// POST { action: "pull" } → { items: [{id, note, name, zalo_user_id, phone}] }
// POST { action: "ack", id } → { ok: true }
// Bảo vệ thêm (tuỳ chọn): đặt secret BRIDGE_SECRET trong Vault thì mọi request
// phải kèm header x-bridge-secret khớp; chưa đặt thì chỉ cần anon key như cũ.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

function db(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const client = db();

  const { data: gate } = await client.rpc("get_secret", { secret_name: "BRIDGE_SECRET" });
  if (gate && req.headers.get("x-bridge-secret") !== gate) {
    return new Response(JSON.stringify({ error: "bridge secret sai" }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "pull");

  if (action === "ack") {
    const id = String(body.id ?? "");
    if (!id) return new Response(JSON.stringify({ error: "id bắt buộc" }), { status: 400 });
    await client.from("reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id).in("kind", ["escalation", "report"]);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // pull: escalation pending tới hạn + đích liên lạc theo vai:
  // seller (FR-144 — chủ động hỏi chính chủ) → CTV được giao → admin.
  const { data: due } = await client
    .from("reminders")
    .select("id, kind, note, ctv_id, seller_id, ctvs(name, zalo_user_id, phone), sellers(name, zalo_user_id, phone)")
    .eq("status", "pending").in("kind", ["escalation", "report"])
    .lte("due_at", new Date().toISOString())
    .limit(10);
  const { data: adm } = await client.from("admins")
    .select("zalo_user_id, zalo_phone").limit(1).maybeSingle();

  type Target = { name?: string | null; zalo_user_id?: string | null; phone?: string | null } | null;
  const items = (due ?? []).map((r) => {
    const ctv = r.ctvs as Target;
    const seller = r.sellers as Target;
    // Text soạn sẵn đúng vai: hỏi chính chủ thì lễ phép kiểu CSKH,
    // báo CTV/admin thì kiểu thông báo nội bộ.
    const text = r.kind === "report"
      ? String(r.note) // FR-149: báo cáo CTV 17h gửi nguyên văn về Zalo admin
      : r.seller_id
      ? `Chào anh/chị, em bên nhadat.cc ạ. ${r.note}. Anh/chị bổ sung giúp em để em báo khách liền nha!`
      : `🔔 nhadat.cc: ${r.note}. Anh/chị check giúp rồi trả lời khách sớm nha.`;
    return {
      id: r.id,
      note: r.note,
      text,
      name: seller?.name ?? ctv?.name ?? "admin",
      zalo_user_id: seller?.zalo_user_id ?? ctv?.zalo_user_id ?? adm?.zalo_user_id ?? null,
      phone: seller?.phone ?? ctv?.phone ?? adm?.zalo_phone ?? null,
    };
  });
  return new Response(JSON.stringify({ items }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});
