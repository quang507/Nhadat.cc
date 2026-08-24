// Khởi tạo client Claude cho edge function.
// Key lấy từ env (supabase secrets) trước, không có thì đọc Vault
// (secret tên ANTHROPIC_API_KEY, chỉ đọc được bằng service role).
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const MODEL = "claude-opus-5";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function anthropicClient(db: SupabaseClient): Promise<Anthropic> {
  let apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    const { data, error } = await db.rpc("get_secret", {
      secret_name: "ANTHROPIC_API_KEY",
    });
    if (error || !data) {
      throw new Error("Không tìm thấy ANTHROPIC_API_KEY (env lẫn Vault)");
    }
    apiKey = data as string;
  }
  return new Anthropic({ apiKey });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
