// Supabase giả trong bộ nhớ: đủ để chat-reply chạy trọn đường, ghi lại mọi truy vấn.
import { randomUUID } from "node:crypto";

const singular = (t) => t.replace(/s$/, "");
const now = () => new Date().toISOString();

export class FakeDB {
  constructor() {
    this.t = {};
    for (const n of ["sellers","buyers","conversations","messages","listings","listing_facts","info_requests",
      "reminders","viewings","deals","inbound_ledger","bot_prompts","projects","listing_photos_v","bot_errors","bot_usage","ledger_log"]) this.t[n] = [];
    this.seq = 0; this.log = [];
  }
  rows(n) {
    if (n === "listing_missing_facts") return this.missingFacts();
    return this.t[n] ?? (this.t[n] = []);
  }
  // FR-144/FR-140: view thiếu-thông-tin — chỉ tin còn cho_thong_tin
  missingFacts() {
    const REQ = ["gia","dien_tich","phuong","phap_ly","loai_bds","so_phong_ngu","hinh_anh"];
    const out = [];
    for (const l of this.t.listings) {
      if (l.status !== "cho_thong_tin") continue;
      const have = new Set(this.t.listing_facts.filter((f) => f.listing_id === l.id).map((f) => f.question));
      if (l.price_raw) have.add("gia"); if (l.area_m2) have.add("dien_tich"); if (l.ward) have.add("phuong");
      if (l.property_type && l.property_type !== "chua_ro") have.add("loai_bds"); if (l.bedrooms) have.add("so_phong_ngu");
      REQ.forEach((k, i) => { if (!have.has(k)) out.push({ listing_id: l.id, fact_key: k, priority: i + 1 }); });
    }
    return out;
  }
  insert(table, row) {
    const r = { id: randomUUID(), created_at: now(), ...row };
    if (table === "messages") {
      if (r.zalo_msg_id && this.t.messages.some((m) => m.zalo_msg_id === r.zalo_msg_id)) {
        return { error: { code: "23505", message: "duplicate key value violates unique constraint messages_zalo_msg_id_key" } };
      }
      r.seq = ++this.seq;
      if (globalThis.__afterInsertMsg && r.sender === 'buyer') { const h = globalThis.__afterInsertMsg; globalThis.__afterInsertMsg = null; this.rows('messages').push(r); h(this, r); return { data: r }; }
    }
    if (table === "listings") {
      r.code = r.code ?? `BDS-Q5-${String(this.t.listings.length + 1).padStart(4, "0")}`;
      r.status = r.status ?? "cho_thong_tin";
      if (r.price_raw && r.price_vnd == null) r.price_vnd = parseVnd(r.price_raw);
    }
    this.rows(table).push(r);
    return { data: r };
  }
}
// đủ cho "5 tỷ 8", "5,5 tỷ", "800 triệu"
export function parseVnd(s) {
  const t = String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  let m = /(\d+)\s*ty\s*(\d)(?!\d)/.exec(t); if (m) return +m[1] * 1e9 + +m[2] * 1e8;
  m = /(\d+(?:[.,]\d+)?)\s*(ty|ti)/.exec(t); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1e9);
  m = /(\d+(?:[.,]\d+)?)\s*(trieu|tr)/.exec(t); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1e6);
  return null;
}

function parseSelect(sel) {
  const items = []; let depth = 0, cur = "";
  for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { items.push(cur.trim()); cur = ""; } else cur += ch; }
  if (cur.trim()) items.push(cur.trim());
  return items.map((it) => {
    const m = /^([a-z_]+)(!inner)?\((.*)\)$/.exec(it);
    return m ? { embed: m[1], inner: !!m[2], cols: m[3].split(",").map((s) => s.trim()) } : { col: it };
  });
}

class Builder {
  constructor(db, table) { this.db = db; this.table = table; this.filters = []; this.op = "select"; this.sel = "*"; this.embedFilters = []; }
  select(cols = "*", opts = {}) { if (this.op === "select") { this.sel = cols; this.count = opts.count; this.head = opts.head; } else this.returning = cols; return this; }
  insert(p) { this.op = "insert"; this.payload = p; return this; }
  update(p) { this.op = "update"; this.payload = p; return this; }
  _f(kind, col, val) { (col.includes(".") ? this.embedFilters : this.filters).push({ kind, col, val }); return this; }
  eq(c, v) { return this._f("eq", c, v); } neq(c, v) { return this._f("neq", c, v); } in(c, v) { return this._f("in", c, v); }
  gte(c, v) { return this._f("gte", c, v); } lte(c, v) { return this._f("lte", c, v); } gt(c, v) { return this._f("gt", c, v); } lt(c, v) { return this._f("lt", c, v); }
  not(c, op, v) { return this._f("not_" + op, c, v); } ilike(c, v) { return this._f("ilike", c, v); }
  order(c, o = {}) { this.ord = { c, asc: o.ascending !== false }; return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  single() { this.mode = "single"; return this; }
  static test(f, row) {
    const v = row[f.col];
    switch (f.kind) {
      case "eq": return v === f.val; case "neq": return v !== f.val; case "in": return f.val.includes(v);
      case "gte": return v != null && v >= f.val; case "lte": return v != null && v <= f.val; case "gt": return v > f.val; case "lt": return v < f.val;
      case "not_is": return f.val === null ? v != null : v !== f.val;
      case "ilike": { const p = "^" + String(f.val).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$"; return new RegExp(p, "i").test(String(v ?? "")); }
    }
    return true;
  }
  embedOf(row, embed) {
    const fk = singular(embed) + "_id";
    if (fk in row) return { one: true, rows: this.db.rows(embed).filter((r) => r.id === row[fk]) };
    const back = singular(this.table) + "_id";
    return { one: false, rows: this.db.rows(embed).filter((r) => r[back] === row.id) };
  }
  run() {
    const db = this.db; const t = this.table;
    db.log.push({ table: t, op: this.op, filters: this.filters, embedFilters: this.embedFilters, payload: this.payload, sel: this.sel });
    if (this.op === "insert") {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload]; const out = [];
      for (const p of arr) { const r = db.insert(t, p); if (r.error) return { data: null, error: r.error }; out.push(r.data); }
      return this.mode === "single" ? { data: out[0], error: null } : { data: out, error: null };
    }
    let rows = db.rows(t).filter((r) => this.filters.every((f) => Builder.test(f, r)));
    if (this.op === "update") { rows.forEach((r) => Object.assign(r, this.payload)); return { data: rows, error: null }; }
    const items = parseSelect(this.sel);
    // lọc theo embed (vd listings.seller_id) + !inner
    rows = rows.filter((r) => {
      for (const it of items) if (it.embed) {
        const e = this.embedOf(r, it.embed);
        const ok = e.rows.filter((er) => this.embedFilters.filter((f) => f.col.startsWith(it.embed + ".")).every((f) => Builder.test({ ...f, col: f.col.split(".")[1] }, er)));
        if (it.inner && ok.length === 0) return false;
      }
      return true;
    });
    if (this.ord) rows.sort((a, b) => (a[this.ord.c] > b[this.ord.c] ? 1 : a[this.ord.c] < b[this.ord.c] ? -1 : 0) * (this.ord.asc ? 1 : -1));
    if (this.lim != null) rows = rows.slice(0, this.lim);
    if (this.head) return { data: null, count: rows.length, error: null };
    const proj = rows.map((r) => {
      const o = {};
      for (const it of items) {
        if (it.col === "*") Object.assign(o, r);
        else if (it.col) o[it.col] = r[it.col];
        else {
          const e = this.embedOf(r, it.embed);
          const ok = e.rows.filter((er) => this.embedFilters.filter((f) => f.col.startsWith(it.embed + ".")).every((f) => Builder.test({ ...f, col: f.col.split(".")[1] }, er)));
          const pick = (er) => Object.fromEntries(it.cols.map((c) => [c, er[c]]));
          o[it.embed] = e.one ? (ok[0] ? pick(ok[0]) : null) : ok.map(pick);
        }
      }
      return o;
    });
    if (this.mode === "maybe") return { data: proj[0] ?? null, error: null };
    if (this.mode === "single") return proj[0] ? { data: proj[0], error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } };
    return { data: proj, error: null, count: this.count ? proj.length : undefined };
  }
  then(res, rej) { try { return Promise.resolve(this.run()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); } }
}

class RpcCall {
  constructor(db, name, args) { this.db = db; this.name = name; this.args = args; }
  single() { this.mode = "single"; return this; } maybeSingle() { this.mode = "maybe"; return this; }
  run() {
    const db = this.db; const a = this.args ?? {}; db.log.push({ rpc: this.name, args: a });
    const R = globalThis.__rpc ?? {};
    if (R[this.name]) return R[this.name](db, a);
    switch (this.name) {
      case "get_secret": return { data: null, error: null };
      case "log_loi": db.t.bot_errors.push({ at: now(), source: a.p_source, detail: a.p_detail, status_code: a.p_code }); return { data: null, error: null };
      case "cong_token": db.t.bot_usage.push(a); return { data: null, error: null };
      case "bump_model_quota": return { data: true, error: null };
      case "claim_inbound": {
        let l = db.t.inbound_ledger.find((x) => x.zalo_msg_id === a.p_msg_id);
        if (!l) { l = { zalo_msg_id: a.p_msg_id, status: "received", attempts: 1, reply: null }; db.t.inbound_ledger.push(l); return { data: { r_state: "received", r_attempts: 1 }, error: null }; }
        if (l.status === "completed") return { data: { r_state: "completed", r_reply: l.reply, r_sent_at: l.sent_at ?? null }, error: null };
        l.attempts++; return { data: { r_state: "received", r_attempts: l.attempts }, error: null };
      }
      case "bao_hong_inbound": { const l = db.t.inbound_ledger.find((x) => x.zalo_msg_id === a.p_msg_id); if (l) { l.status = "failed"; l.detail = a.p_detail; } return { data: null, error: null }; }
      case "ensure_buyer_conversation": {
        let b = db.t.buyers.find((x) => x.zalo_user_id === a.p_zalo_user_id);
        if (!b) b = db.insert("buyers", { zalo_user_id: a.p_zalo_user_id, name: null, preferences: {} }).data;
        let c = db.t.conversations.filter((x) => x.buyer_id === b.id).sort((x, y) => (x.started_at < y.started_at ? 1 : -1))[0];
        if (!c) c = db.insert("conversations", { buyer_id: b.id, channel: a.p_channel, started_at: now(), human_touch_at: null, ctv_id: null }).data;
        return { data: { b_id: b.id, b_name: b.name, b_prefs: b.preferences, c_id: c.id }, error: null };
      }
      case "ensure_seller_conversation": {
        let c = db.t.conversations.find((x) => x.seller_id === a.p_seller_id);
        if (!c) c = db.insert("conversations", { seller_id: a.p_seller_id, channel: a.p_channel, started_at: now(), human_touch_at: null }).data;
        return { data: { c_id: c.id, c_human_touch_at: c.human_touch_at }, error: null };
      }
      case "mo_ho_so_nguoi_ban": {
        let s = db.t.sellers.find((x) => x.zalo_user_id === a.p_zalo_user_id);
        if (!s) s = db.insert("sellers", { zalo_user_id: a.p_zalo_user_id, seller_type: a.p_seller_type ?? "ccrb", name: null, active_listing_id: null }).data;
        else if (s.seller_type === "unknown") s.seller_type = a.p_seller_type ?? "ccrb";
        const row = { id: s.id, name: s.name, active_listing_id: s.active_listing_id, seller_type: s.seller_type };
        return { data: this.mode ? row : [row], error: null };
      }
      case "merge_buyer_prefs": { const b = db.t.buyers.find((x) => x.id === a.p_buyer_id); if (b) b.preferences = { ...(b.preferences ?? {}), ...(a.p_delta ?? {}) }; return { data: null, error: null }; }
      case "ghi_fact_listing": {
        const l = db.t.listings.find((x) => x.id === a.p_listing_id); if (!l) return { data: null, error: { message: "listing khong ton tai" } };
        db.insert("listing_facts", { listing_id: l.id, question: a.p_question, answer: a.p_answer, source: a.p_source });
        if (a.p_question === "gia") { l.price_raw = a.p_answer; l.price_vnd = parseVnd(a.p_answer); }
        if (a.p_question === "phuong") l.ward = a.p_answer;
        if (a.p_question === "dien_tich") l.area_m2 = parseFloat(a.p_answer);
        if (a.p_question === "so_phong_ngu") l.bedrooms = parseInt(a.p_answer, 10);
        if (l.status === "cho_thong_tin" && l.price_raw && l.area_m2 && l.ward) l.status = "dang_ban";
        return { data: null, error: null };
      }
      case "guess_property_type_answer": { const t = String(a.p_text).toLowerCase(); return { data: /nhà phố|nha pho/.test(t) ? "nha_pho" : /chung cư|chung cu/.test(t) ? "chung_cu" : null, error: null }; }
      case "mark_listing_interest": { let n = 0; for (const l of db.t.listings) if (a.p_codes.includes(l.code) && ["dang_ban", "dang_quan_tam"].includes(l.status)) { l.status = "dang_quan_tam"; n++; } return { data: n, error: null }; }
      case "match_projects": return { data: [], error: null };
    }
    return { data: null, error: { message: `rpc ${this.name} chưa giả lập` } };
  }
  then(res, rej) { try { return Promise.resolve(this.run()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); } }
}

export function createClient() {
  const db = globalThis.__db;
  return { from: (t) => new Builder(db, t), rpc: (n, a) => new RpcCall(db, n, a) };
}
