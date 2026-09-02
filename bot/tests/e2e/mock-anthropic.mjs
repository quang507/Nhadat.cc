// Model giả: trả theo kịch bản đặt ở globalThis.__model, ghi lại mọi lượt gọi.
const usage = () => ({ input_tokens: 120, output_tokens: 30, cache_creation_input_tokens: 0, cache_read_input_tokens: 5000 });
export default class Anthropic {
  constructor() {
    this.messages = {
      create: async (params) => {
        globalThis.__calls.push({ kind: "create", params });
        const text = globalThis.__model?.create?.(params) ?? "Dạ em ghi nhận rồi ạ.";
        return { content: [{ type: "text", text }], usage: usage() };
      },
      parse: async (params) => {
        globalThis.__calls.push({ kind: "parse", params });
        const out = globalThis.__model?.parse?.(params) ?? null;
        return { stop_reason: "end_turn", parsed_output: out, content: [], usage: usage() };
      },
    };
  }
}
