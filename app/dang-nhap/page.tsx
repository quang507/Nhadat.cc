"use client";
// Đăng nhập cho NHÀ MÔI GIỚI (FR-124) — magic link qua email, không mật khẩu.
// Người mua không bao giờ cần tài khoản; CCRB rao qua Zalo (INS-05).
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState("error");
      setErrMsg("Email chưa đúng định dạng — anh chị xem lại giúp em.");
      return;
    }
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/quan-ly` },
    });
    if (error) {
      setState("error");
      setErrMsg("Gửi không được: " + error.message);
    } else {
      setState("sent");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-extrabold">Dành cho nhà môi giới</h1>
      <p className="mt-2 text-mute">
        Đăng nhập bằng email — tụi em gửi một đường link, bấm vào là vào thẳng
        trang quản lý tin, không cần mật khẩu.
      </p>
      <p className="mt-2 text-sm text-mute">
        Anh chị là <strong>chính chủ</strong> muốn rao? Không cần tài khoản —{" "}
        <a href="/raoban" className="font-semibold text-brand hover:underline">rao qua Zalo một câu là xong</a>.
      </p>

      {state === "sent" ? (
        <div className="mt-8 rounded-king border border-line bg-white p-6">
          <p className="font-bold">Đã gửi link vào {email}.</p>
          <p className="mt-1 text-sm text-mute">
            Mở email (kiểm tra cả mục spam) và bấm link để vào trang quản lý.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 rounded-king border border-line bg-white p-6">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mute">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@congty.vn"
              className="w-full rounded-lg border border-line px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
          {state === "error" && <p className="mt-2 text-sm font-medium text-brand">{errMsg}</p>}
          <button
            type="submit"
            disabled={state === "sending"}
            className="mt-4 w-full rounded-full bg-brand py-3 font-bold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:opacity-60"
          >
            {state === "sending" ? "Đang gửi…" : "Gửi link đăng nhập"}
          </button>
        </form>
      )}
    </div>
  );
}
