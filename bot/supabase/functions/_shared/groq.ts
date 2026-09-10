// ĐƯỜNG DỰ PHÒNG KHI MODEL CHÍNH CHẾT (FR-194).
//
// VÌ SAO. Sáng 10/09/2026 tài khoản Anthropic hết số dư: mọi lượt gọi trả 400
// "credit balance is too low", `chat-reply` rơi về CÂU MẪU tiền định. Bot vẫn
// trả lời nên nhìn bên ngoài KHÔNG khác gì — chủ dự án đọc lại bản ghi chỉ thấy
// "giọng cứng" mà không ai biết model đã chết 48 lượt liền. Câu mẫu giữ được
// việc chạy, nhưng không giữ được giọng.
//
// Groq nói giọng OpenAI, không phải Anthropic — cắm khoá vào SDK Anthropic là
// gãy. File này là lớp CHUYỂN ĐỔI: phơi ra đúng hai hàm mà 10 chỗ gọi đang dùng
// (`messages.create`, `messages.parse`) rồi dịch sang `POST /openai/v1/chat/
// completions`, dịch cả `usage` về đúng bốn ô mà `doTien` ghi sổ.
//
// KHÔNG thay model chính. Chỉ chen vào khi lượt gọi chính HỎNG vì hết tiền / quá
// nhịp / quá tải — đúng những mã lỗi liệt kê ở `nenDoiSang()`. Lỗi khác (sai
// prompt, sai schema) vẫn ném lên như cũ, vì đổi model không chữa được chúng và
// nuốt lỗi ở đây là giấu một chỗ hỏng.
//
// GIỚI HẠN đã biết, đừng quên khi đọc kết quả:
//   · Groq KHÔNG có bộ nhớ tạm prompt → `cache_control` bị bỏ qua, hai ô
//     cache_read/cache_write ghi 0. Nhìn thẻ Chi phí Model thấy tỷ lệ đọc lại
//     tụt trong ngày chạy dự phòng là ĐÚNG, không phải hỏng.
//   · Các model Groq đang bật (gpt-oss-120b, qwen3.8-27b) KHÔNG nhìn được ảnh.
//     Lượt phân loại ảnh / đọc sổ có ảnh sẽ ném lỗi để tầng gọi đi đúng nhánh
//     "không phân loại được → cất RIÊNG TƯ" như cũ (FR-185), thay vì bịa ra
//     nhãn ảnh từ chỗ không nhìn thấy gì.

type Khoi = { type: string; text?: string; [k: string]: unknown };
type TinNhan = { role: string; content: string | Khoi[] };
export type ThamSo = {
  model?: string;
  max_tokens?: number;
  system?: Array<{ type: string; text: string; [k: string]: unknown }> | string;
  messages: TinNhan[];
  output_config?: { effort?: string; format?: unknown };
  [k: string]: unknown;
};
export type KetQua = {
  content: Array<{ type: string; text?: string }>;
  parsed_output?: unknown;
  stop_reason?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
};

const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";

/** Lỗi nào thì đáng đổi sang đường dự phòng — hết tiền, quá nhịp, quá tải. */
export function nenDoiSang(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e ?? "");
  const ma = (e as { status?: number })?.status ?? 0;
  return ma === 429 || ma === 529 || ma === 500 || ma === 503 ||
    /credit balance is too low|insufficient|quota|rate limit|overloaded|billing/i.test(s);
}

/** system của Anthropic là MẢNG khối; OpenAI chỉ nhận một chuỗi. */
function gopHeThong(system: ThamSo["system"]): string {
  if (!system) return "";
  if (typeof system === "string") return system;
  return system.map((k) => k.text ?? "").filter(Boolean).join("\n\n");
}

/** Khối nội dung → chuỗi. Gặp ảnh thì DỪNG: model dự phòng không nhìn được. */
function gopNoiDung(content: TinNhan["content"]): string {
  if (typeof content === "string") return content;
  for (const k of content) {
    if (k.type === "image" || k.type === "document") {
      throw new Error("Groq dự phòng không nhìn được ảnh — để tầng gọi đi nhánh cất riêng tư");
    }
  }
  return content.map((k) => k.text ?? "").filter(Boolean).join("\n");
}

/** Lấy JSON Schema ra khỏi `output_config.format` do `zodOutputFormat()` dựng. */
function bocSchema(format: unknown): { name: string; schema: unknown } | null {
  const f = format as Record<string, unknown> | null;
  if (!f) return null;
  const trong = (f.json_schema ?? f.schema ?? null) as Record<string, unknown> | null;
  if (trong && typeof trong === "object" && "schema" in trong) {
    return { name: String(trong.name ?? "ket_qua"), schema: trong.schema };
  }
  if (trong) return { name: String(f.name ?? "ket_qua"), schema: trong };
  return null;
}

async function goiGroq(
  khoa: string, model: string, p: ThamSo, schema: { name: string; schema: unknown } | null,
): Promise<KetQua> {
  const messages = [
    ...(gopHeThong(p.system) ? [{ role: "system", content: gopHeThong(p.system) }] : []),
    ...p.messages.map((m) => ({ role: m.role, content: gopNoiDung(m.content) })),
  ];
  const than: Record<string, unknown> = {
    model,
    messages,
    // Model suy luận tiêu ngân sách chữ cho phần NGHĨ trước khi viết câu trả lời,
    // nên trần của model chính (512) làm câu nhìn thấy bị cắt giữa chừng — bắt
    // 10/09: "Hẻm trước nhà rộng m". Cho lượt dự phòng ít nhất 900.
    max_completion_tokens: Math.max(p.max_tokens ?? 1024, 900),
    temperature: 0.6,
    // Model suy luận (qwen3.x) mặc định TRẢ KÈM đoạn nghĩ. Bắt tại trận 10/09:
    // một lượt trả về nguyên "<think> Here's a thinking process: 1. Analyze User
    // Input..." và bong bóng đó đi thẳng tới chủ nhà trên Zalo. Xin ẩn ở đây,
    // và vẫn cắt lại ở dưới — tham số này không phải model nào cũng nhận.
    reasoning_format: "hidden",
  };
  if (schema) {
    than.response_format = {
      type: "json_schema",
      json_schema: { name: schema.name, schema: schema.schema, strict: true },
    };
  }
  const r = await fetch(URL_GROQ, {
    method: "POST",
    headers: { Authorization: `Bearer ${khoa}`, "Content-Type": "application/json" },
    body: JSON.stringify(than),
  });
  if (!r.ok) throw new Error(`Groq ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  // Lưới thứ hai: cắt mọi khối nghĩ còn sót, kể cả khối chưa đóng thẻ (bị cắt
  // giữa chừng vì hết max_completion_tokens). Khách KHÔNG bao giờ được đọc nó.
  const tho = j.choices?.[0]?.message?.content ?? "";
  const txt = tho
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/^\s*(?:Here's a thinking process|Thinking process)[\s\S]*?(?:\n\n|$)/i, "")
    .trim();
  if (!txt) throw new Error(`Groq 502 model ${model} trả rỗng sau khi cắt khối nghĩ`);
  const kq: KetQua = {
    content: [{ type: "text", text: txt }],
    stop_reason: "end_turn",
    usage: {
      input_tokens: j.usage?.prompt_tokens ?? 0,
      output_tokens: j.usage?.completion_tokens ?? 0,
      // Groq không có bộ nhớ tạm prompt — hai ô này luôn 0, xem khối đầu file.
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  };
  if (schema) {
    try {
      kq.parsed_output = txt ? JSON.parse(txt) : null;
    } catch {
      kq.parsed_output = null; // tầng gọi đã có lưới regex, đừng ném
    }
  }
  return kq;
}

type CoMessages = {
  messages: {
    create: (p: ThamSo) => Promise<unknown>;
    parse: (p: ThamSo) => Promise<unknown>;
  };
};

/**
 * Bọc client chính bằng đường dự phòng Groq. `chinh` = null nghĩa là không có
 * khoá Anthropic — đi thẳng Groq.
 */
export function bocDuPhong(
  chinh: CoMessages | null,
  khoaGroq: string,
  modelGroq: string,
  ghiSo?: (nguon: string, chiTiet: string) => Promise<void>,
): CoMessages {
  // Bậc miễn phí Groq chặn nhịp THEO TỪNG MODEL. Đo 10/09: lượt đầu qua được,
  // lượt hai dính "Rate limit reached for model qwen/qwen3.8-27b" và rơi tiếp về
  // câu mẫu — tức là có lưới mà vẫn thủng. Nên GROQ_MODEL nhận DANH SÁCH ngăn
  // bằng dấu phẩy: hết nhịp model này thì xoay sang model kế, mỗi model một hạn
  // mức riêng. Hết cả danh sách mới chịu thua.
  const dsModel = modelGroq.split(",").map((m) => m.trim()).filter(Boolean);
  const chay = async (ten: "create" | "parse", p: ThamSo): Promise<unknown> => {
    if (chinh) {
      try {
        return await chinh.messages[ten](p);
      } catch (e) {
        if (!nenDoiSang(e)) throw e;
        await ghiSo?.(
          `model chinh hong - doi sang Groq ${dsModel[0]}`,
          String((e as { message?: string })?.message ?? e).slice(0, 300),
        );
      }
    }
    const schema = ten === "parse" ? bocSchema(p.output_config?.format) : null;
    let cuoi: unknown = null;
    for (const m of dsModel) {
      try {
        return await goiGroq(khoaGroq, m, p, schema);
      } catch (e) {
        cuoi = e;
        // Hết nhịp / quá tải thì xoay model; lỗi khác (sai schema, sai prompt)
        // xoay cũng vô ích — model nào cũng hỏng như nhau.
        if (!/^Groq (429|5\d\d)/.test(String((e as { message?: string })?.message ?? e))) break;
        // Xoay model là ĐƯỜNG ĐI BÌNH THƯỜNG của lưới dự phòng, không phải sự cố.
        // Ghi vào sổ lỗi là tự nuôi còi báo động (bài học escalation-feed 08/09).
        console.log(`Groq het nhip, xoay khoi ${m}`);
      }
    }
    throw cuoi ?? new Error("Groq: không model nào trả lời");
  };
  return {
    messages: {
      create: (p: ThamSo) => chay("create", p),
      parse: (p: ThamSo) => chay("parse", p),
    },
  };
}
