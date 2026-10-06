// ============================================================================
// LINE Webhook — ผูกบัญชี LINE กับพนักงานด้วยรหัส 6 หลัก
// URL: https://<project>.supabase.co/functions/v1/line-webhook
//
// Deploy (ต้องปิดการตรวจ JWT เพราะ LINE ไม่ได้ส่ง JWT มา):
//   supabase functions deploy line-webhook --no-verify-jwt
//   หรือในหน้า Supabase > Edge Functions > line-webhook > Settings > ปิด "Enforce JWT verification"
//
// Secrets ที่ใช้:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (Supabase ใส่ให้อัตโนมัติ)
//   LINE_CHANNEL_ACCESS_TOKEN               (ตัวเดียวกับ line-send; ไม่มีจะอ่านจาก system_settings.line_oa_config)
//   LINE_CHANNEL_SECRET                     (ไม่บังคับ — ถ้าใส่จะตรวจลายเซ็นว่ามาจาก LINE จริง)
//
// หลักการ:
//   • รหัสใช้ได้ครั้งเดียว อายุตาม expires_at — ใช้แล้ว "ทำเครื่องหมาย used_at" (ไม่ลบ) เพื่อให้ตอบซ้ำได้ถูกต้อง
//   • ส่งรหัสเดิมซ้ำจาก LINE บัญชีเดิม (หรือ LINE ส่ง event ซ้ำ) → ตอบว่า "เชื่อมต่อเรียบร้อยแล้ว" ไม่ใช่ "ถูกใช้ไปแล้ว"
//   • รหัสถูกใช้โดย LINE บัญชีอื่น → แจ้งให้ขอรหัสใหม่
//   • ตรวจสิทธิ์ผูก LINE (เฉพาะผู้อนุมัติ/HR หรือเปิดให้ทุกคน) ตอนผูกจริง
// ============================================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ENV_LINE_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const LINE_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";

const MSG = {
  linked: (name: string) => `✅ เชื่อมต่อ LINE กับระบบ HR เรียบร้อยแล้ว${name ? `\nบัญชี: ${name}` : ""}\nคุณจะได้รับแจ้งเตือนใบลาผ่านช่องทางนี้`,
  alreadyLinked: (name: string) => `✅ บัญชี LINE นี้เชื่อมต่อเรียบร้อยแล้ว${name ? `\nบัญชี: ${name}` : ""}\nไม่ต้องส่งรหัสซ้ำ`,
  usedByOther: "⚠️ รหัสนี้ถูกใช้ไปแล้วกับ LINE บัญชีอื่น\nกรุณากด \"สร้างรหัสผูก LINE\" ในระบบเพื่อขอรหัสใหม่",
  notFound: "❌ ไม่พบรหัสนี้ในระบบ\nกรุณาตรวจสอบตัวเลข หรือกด \"สร้างรหัสผูก LINE\" ในระบบเพื่อขอรหัสใหม่",
  expired: "⏱️ รหัสหมดอายุแล้ว (ใช้ได้ 15 นาที)\nกรุณากด \"สร้างรหัสผูก LINE\" ในระบบเพื่อขอรหัสใหม่",
  notAllowed: "ℹ️ ขณะนี้การแจ้งเตือนผ่าน LINE เปิดให้เฉพาะผู้อนุมัติใบลา (หัวหน้างาน / ผู้จัดการ) ที่ HR ตั้งค่าไว้\nหากต้องการใช้งานกรุณาติดต่อฝ่ายบุคคล",
  error: "⚠️ ระบบขัดข้องชั่วคราว กรุณาส่งรหัสอีกครั้งในอีกสักครู่",
  hello: "สวัสดีค่ะ 👋 นี่คือ LINE แจ้งเตือนของระบบใบลา\nหากต้องการรับแจ้งเตือน ให้ขอรหัส 6 หลักจากระบบ (ปุ่ม \"สร้างรหัสผูก LINE\") แล้วพิมพ์รหัสส่งมาที่แชตนี้",
};

// --------------------------------------------------------------------------- Supabase REST
const H = () => ({ apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" });
async function get(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) throw new Error(`GET ${path.split("?")[0]} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function patch(path: string, body: unknown, returnRows = false) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...H(), Prefer: returnRows ? "return=representation" : "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path.split("?")[0]} ${r.status}: ${await r.text()}`);
  return returnRows ? r.json() : null;
}

// --------------------------------------------------------------------------- LINE
let cachedToken = "";
async function lineToken() {
  if (ENV_LINE_TOKEN) return ENV_LINE_TOKEN;
  if (cachedToken) return cachedToken;
  try {
    const rows = await get("system_settings?setting_key=eq.line_oa_config&select=setting_value");
    cachedToken = rows?.[0]?.setting_value?.channel_access_token || "";
  } catch (_) { /* ignore */ }
  return cachedToken;
}

async function reply(replyToken: string | undefined, text: string) {
  if (!replyToken) return;
  const token = await lineToken();
  if (!token) { console.error("No LINE channel access token configured"); return; }
  const r = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!r.ok) console.error("LINE reply failed:", r.status, await r.text());
}

async function validSignature(raw: string, signature: string | null) {
  if (!LINE_SECRET) return true; // ไม่ได้ตั้ง secret → ข้ามการตรวจ
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(LINE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return b64 === signature;
}

// --------------------------------------------------------------------------- สิทธิ์ผูก LINE (เหมือน api-handlers.js checkLineEligibility)
async function isEligible(empId: string) {
  const eid = encodeURIComponent(empId);
  const safe = (p: Promise<unknown>) => p.catch(() => []);
  const [settings, emp, appr, personal, dept, chain] = await Promise.all([
    safe(get("system_settings?setting_key=eq.line_notification_settings&select=setting_value")),
    get(`employees?id=eq.${eid}&select=id,role,employee_code,status`),
    safe(get(`department_approvers?or=(supervisor_id.eq.${eid},manager_id.eq.${eid})&select=id&limit=1`)),
    safe(get(`employees?or=(l1_approver_id.eq.${eid},l2_approver_id.eq.${eid},l3_approver_id.eq.${eid})&select=id&limit=1`)),
    safe(get(`departments?or=(approver_id.eq.${eid},backup_approver_id.eq.${eid})&select=id&limit=1`)),
    safe(get(`approval_chain_steps?approver_ids=cs.%7B${eid}%7D&select=id&limit=1`)),
  ]) as unknown as Array<Array<Record<string, any>>>;
  if (!emp?.length) return false;
  if (settings?.[0]?.setting_value?.allow_all_employees === true) return true;
  const role = String(emp[0].role || "").toLowerCase();
  const code = String(emp[0].employee_code || "").toLowerCase();
  if (["admin", "superadmin", "hr", "hr_manager"].includes(role) || code === "admin" || code === "superadmin" || code.startsWith("hr-")) return true;
  // ผู้บริหารที่ตั้งไว้ในระบบ
  try {
    const ex = await get("system_settings?setting_key=eq.leave_executive_approver&select=employee_id");
    if (String(ex?.[0]?.employee_id || "") === empId) return true;
  } catch (_) { /* ignore */ }
  return [appr, personal, dept, chain].some((rows) => Array.isArray(rows) && rows.length > 0);
}

// --------------------------------------------------------------------------- ผูกรหัส
async function handleCode(code: string, userId: string): Promise<string> {
  const rows = await get(
    `line_link_tokens?or=(token.eq.${code},link_code.eq.${code})&select=id,employee_id,expires_at,used_at,created_at&order=created_at.desc&limit=5`,
  ) as Array<Record<string, any>>;
  if (!rows.length) {
    // ไม่พบรหัส แต่ LINE นี้ผูกอยู่แล้ว → ตอบว่าเชื่อมแล้ว (กรณีส่งรหัสซ้ำหลังรหัสถูกล้าง)
    const linked = await get(`employees?line_id=eq.${encodeURIComponent(userId)}&select=full_name&limit=1`).catch(() => []);
    return linked?.length ? MSG.alreadyLinked(linked[0].full_name || "") : MSG.notFound;
  }
  const tok = rows.find((r) => !r.used_at) || rows[0];
  const empRows = await get(`employees?id=eq.${tok.employee_id}&select=id,full_name,line_id`) as Array<Record<string, any>>;
  const emp = empRows[0];
  if (!emp) return MSG.notFound;

  if (tok.used_at) {
    // ใช้ไปแล้ว: ถ้าเป็น LINE บัญชีเดียวกัน = สำเร็จอยู่แล้ว
    return String(emp.line_id || "") === userId ? MSG.alreadyLinked(emp.full_name || "") : MSG.usedByOther;
  }
  if (new Date(tok.expires_at).getTime() < Date.now()) {
    return String(emp.line_id || "") === userId ? MSG.alreadyLinked(emp.full_name || "") : MSG.expired;
  }
  if (!(await isEligible(String(emp.id)))) return MSG.notAllowed;

  // จองรหัสแบบ atomic (กัน LINE ส่ง event ซ้ำพร้อมกัน)
  const claimed = await patch(
    `line_link_tokens?id=eq.${tok.id}&used_at=is.null`,
    { used_at: new Date().toISOString() },
    true,
  ) as Array<unknown>;
  if (!claimed?.length) {
    const fresh = await get(`employees?id=eq.${emp.id}&select=line_id`).catch(() => []);
    return String(fresh?.[0]?.line_id || "") === userId ? MSG.alreadyLinked(emp.full_name || "") : MSG.usedByOther;
  }

  await patch(`employees?id=eq.${emp.id}`, { line_id: userId });
  // รหัสอื่นที่ยังไม่ใช้ของคนนี้ → หมดอายุทันที
  await patch(`line_link_tokens?employee_id=eq.${emp.id}&used_at=is.null`, { expires_at: new Date().toISOString() }).catch(() => {});
  console.log(`LINE linked: employee ${emp.id} -> ${userId}`);
  return MSG.linked(emp.full_name || "");
}

// --------------------------------------------------------------------------- main
serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-line-signature")))) {
    console.warn("Invalid LINE signature");
    return new Response("invalid signature", { status: 401 });
  }
  let body: Record<string, any> = {};
  try { body = JSON.parse(raw || "{}"); } catch (_) { /* ignore */ }
  const events: Array<Record<string, any>> = Array.isArray(body.events) ? body.events : [];

  for (const ev of events) {
    try {
      const userId = ev.source?.userId;
      if (ev.type === "follow") { await reply(ev.replyToken, MSG.hello); continue; }
      if (ev.type !== "message" || ev.message?.type !== "text" || !userId) continue;
      const text = String(ev.message.text || "").replace(/\s+/g, "");
      const m = text.match(/(?<!\d)\d{6}(?!\d)/);
      if (!m) continue; // ข้อความอื่น ๆ ไม่ตอบ
      let answer: string;
      try { answer = await handleCode(m[0], userId); }
      catch (err) { console.error("link error:", err); answer = MSG.error; }
      await reply(ev.replyToken, answer);
    } catch (err) {
      console.error("event error:", err);
    }
  }
  // ตอบ 200 เสมอ เพื่อไม่ให้ LINE ส่งซ้ำ
  return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
});
