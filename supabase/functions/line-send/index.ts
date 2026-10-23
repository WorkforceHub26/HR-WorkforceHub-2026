import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
// ใช้ออก "ลิงก์อนุมัติจาก LINE แบบใช้ครั้งเดียว" (ช่วงที่ 3) — Supabase ใส่ค่าทั้งสองให้ Edge Function อัตโนมัติ
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LINK_PLACEHOLDER = "PVTLINKTOKEN";

// ขอลิงก์ใช้ครั้งเดียวจากฐานข้อมูล (ออกให้เฉพาะผู้อนุมัติของลำดับที่รออยู่จริง) — ไม่ได้ → คืน "none"
async function mintActionLink(leaveId: string, lineUserId: string): Promise<string> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !leaveId || !lineUserId) return "none";
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pvt_mint_action_link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_leave_id: leaveId, p_line_id: lineUserId }),
    });
    if (!res.ok) { console.warn("mint link failed:", res.status, await res.text()); return "none"; }
    const token = await res.json();
    return typeof token === "string" && /^[0-9a-f]{64}$/.test(token) ? token : "none";
  } catch (e) {
    console.warn("mint link error:", (e as Error).message);
    return "none";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // 📊 จำนวนข้อความที่ใช้ไปเดือนนี้ + โควตา (คอนโซลผู้ดูแลระบบ → การส่งข้อความ LINE)
    //    ไม่ส่งข้อความใด ๆ และไม่เปิดเผย token
    if (body && body.action === "quota") {
      if (!LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured.");
      const auth = { "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` };
      const [qRes, uRes] = await Promise.all([
        fetch("https://api.line.me/v2/bot/message/quota", { headers: auth }),
        fetch("https://api.line.me/v2/bot/message/quota/consumption", { headers: auth }),
      ]);
      const quota = await qRes.json();
      const usage = await uRes.json();
      if (!qRes.ok || !uRes.ok) throw new Error(`LINE API returned ${qRes.status}/${uRes.status}`);
      return new Response(JSON.stringify({
        success: true,
        quotaType: quota.type,                       // "limited" | "none"
        quota: quota.type === "limited" ? quota.value : null,
        used: usage.totalUsage ?? null,
        checkedAt: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { to, message, leave_id } = body;
    let { flexMessage } = body;

    if (!to) {
      throw new Error("Missing 'to' parameter (LINE User ID)");
    }

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured.");
    }

    // ปุ่มอนุมัติ/ไม่อนุมัติ: แทนที่ PVTLINKTOKEN ด้วยลิงก์ใช้ครั้งเดียวของผู้รับ (ผู้รับต้องเป็นผู้อนุมัติของใบลานั้น)
    if (flexMessage && leave_id) {
      const raw = JSON.stringify(flexMessage);
      if (raw.includes(LINK_PLACEHOLDER)) {
        const link = await mintActionLink(String(leave_id), String(to));
        flexMessage = JSON.parse(raw.split(LINK_PLACEHOLDER).join(link));
      }
    }

    const messages = [];

    // Ensure 'pending approval deadline of 2 days' notice is explicitly appended to notifications
    const deadlineNotice = "⚠️ กรุณาดำเนินการอนุมัติภายใน 2 วันทำการ";

    if (flexMessage) {
      // If it is a flex message, ensure altText (the notification popup banner) has the notice
      if (flexMessage.altText && !flexMessage.altText.includes("วันทำการ")) {
        flexMessage.altText = `${flexMessage.altText} - ${deadlineNotice}`;
      }
      messages.push(flexMessage);
    } else if (message) {
      let finalMessage = message;
      // If it's a request/approval message and doesn't have the notice yet, append it
      if ((message.includes("คำขอ") || message.includes("อนุมัติ") || message.includes("ยกเลิก")) && !message.includes("ภายใน 2 วัน")) {
        finalMessage = `${message}\n\n${deadlineNotice}`;
      }
      messages.push({
        type: "text",
        text: finalMessage
      });
    }

    if (messages.length === 0) {
      throw new Error("Missing 'message' or 'flexMessage' parameter");
    }

    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: to,
        messages: messages
      })
    });

    const lineResult = await lineResponse.json();

    if (!lineResponse.ok) {
      console.error("LINE API Error:", lineResult);
      throw new Error(`LINE API returned ${lineResponse.status}: ${JSON.stringify(lineResult)}`);
    }

    return new Response(JSON.stringify({ success: true, result: lineResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
