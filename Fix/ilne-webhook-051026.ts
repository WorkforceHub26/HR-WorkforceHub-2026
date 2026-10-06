import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_CHANNEL_SECRET =
  Deno.env.get("LINE_CHANNEL_SECRET") ?? "";

const LINE_CHANNEL_ACCESS_TOKEN =
  Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ======================================================
// ตรวจสอบ LINE Signature
// ======================================================
async function verifySignature(
  body: string,
  signature: string
): Promise<boolean> {

  if (!LINE_CHANNEL_SECRET || !signature) {
    return false;
  }

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LINE_CHANNEL_SECRET),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );

  const calculatedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signed))
  );

  return calculatedSignature === signature;
}

// ======================================================
// ตอบข้อความกลับ LINE
// ======================================================
async function replyLine(
  replyToken: string,
  message: string
) {

  if (!replyToken || !LINE_CHANNEL_ACCESS_TOKEN) {
    return;
  }

  const response = await fetch(
    "https://api.line.me/v2/bot/message/reply",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },

      body: JSON.stringify({
        replyToken,

        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    }
  );

  if (!response.ok) {

    console.error(
      "LINE reply error:",
      response.status,
      await response.text()
    );
  }
}

// ======================================================
// LINE WEBHOOK
// ======================================================
Deno.serve(async (req) => {

  // ----------------------------------------------------
  // ใช้สำหรับทดสอบว่า Function ทำงานหรือไม่
  // ----------------------------------------------------
  if (req.method !== "POST") {

    return new Response(
      JSON.stringify({
        message: "LINE webhook is running",
      }),
      {
        status: 200,

        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {

    // ==================================================
    // 1. อ่าน Raw Body
    // สำคัญ: ต้องอ่านก่อนแปลง JSON
    // ==================================================
    const rawBody = await req.text();

    const signature =
      req.headers.get("x-line-signature") ?? "";

    // ==================================================
    // 2. ตรวจสอบ Signature จาก LINE
    // ==================================================
    const validSignature =
      await verifySignature(
        rawBody,
        signature
      );

    if (!validSignature) {

      console.error(
        "❌ Invalid LINE signature"
      );

      return new Response(
        JSON.stringify({
          error: "Invalid signature",
        }),
        {
          status: 401,

          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ==================================================
    // 3. แปลงข้อมูลจาก LINE
    // ==================================================
    const body = JSON.parse(rawBody);

    // LINE อาจส่งหลาย Event พร้อมกัน
    for (const event of body.events ?? []) {

      // ----------------------------------------------
      // สนใจเฉพาะข้อความประเภท Text
      // ----------------------------------------------
      if (
        event.type !== "message" ||
        event.message?.type !== "text"
      ) {
        continue;
      }

      const lineUserId =
        event.source?.userId ?? "";

      const replyToken =
        event.replyToken ?? "";

      const messageText =
        String(
          event.message?.text ?? ""
        ).trim();

      if (!lineUserId) {
        continue;
      }

      // ==================================================
      // 4. ต้องเป็นรหัส 6 หลัก
      // ==================================================
      if (!/^\d{6}$/.test(messageText)) {

        await replyLine(
          replyToken,
          "กรุณาส่งรหัสเชื่อม LINE จำนวน 6 หลัก ที่ได้รับจากระบบค่ะ"
        );

        continue;
      }

      // ==================================================
      // 5. ค้นหารหัสเชื่อม LINE
      // ==================================================
      const {
        data: linkToken,
        error: tokenError,
      } = await supabase
        .from("line_link_tokens")
        .select(
          "id, employee_id, link_code, expires_at, used_at"
        )
        .eq(
          "link_code",
          messageText
        )
        .is(
          "used_at",
          null
        )
        .maybeSingle();

      if (tokenError) {

        console.error(
          "❌ Token query error:",
          tokenError
        );

        await replyLine(
          replyToken,
          "เกิดข้อผิดพลาดในการตรวจสอบรหัส กรุณาลองใหม่อีกครั้งค่ะ"
        );

        continue;
      }

      // ==================================================
      // 6. ไม่พบรหัส
      // ==================================================
      if (!linkToken) {

        await replyLine(
          replyToken,
          "ไม่พบรหัสนี้ หรือรหัสถูกใช้งานไปแล้ว กรุณาขอรหัสใหม่จากผู้ดูแลระบบค่ะ"
        );

        continue;
      }

      // ==================================================
      // 7. ตรวจสอบวันหมดอายุ
      // ==================================================
      const expiresAt =
        new Date(
          linkToken.expires_at
        ).getTime();

      if (
        !Number.isFinite(expiresAt) ||
        expiresAt < Date.now()
      ) {

        await replyLine(
          replyToken,
          "รหัสเชื่อม LINE หมดอายุแล้ว กรุณาขอรหัสใหม่จากผู้ดูแลระบบค่ะ"
        );

        continue;
      }

      // ==================================================
      // 8. ตรวจสอบว่า LINE นี้
      // ถูกผูกกับพนักงานคนอื่นแล้วหรือไม่
      //
      // *** ตารางจริงของเราใช้ employees.line_id ***
      // ==================================================
      const {
        data: existingEmployee,
        error: existingError,
      } = await supabase
        .from("employees")
        .select(
          "id, full_name"
        )
        .eq(
          "line_id",
          lineUserId
        )
        .neq(
          "id",
          linkToken.employee_id
        )
        .maybeSingle();

      if (existingError) {

        console.error(
          "❌ Existing LINE query error:",
          existingError
        );

        await replyLine(
          replyToken,
          "เกิดข้อผิดพลาดในการตรวจสอบบัญชี LINE ค่ะ"
        );

        continue;
      }

      if (existingEmployee) {

        await replyLine(
          replyToken,
          "LINE บัญชีนี้ถูกเชื่อมกับพนักงานคนอื่นแล้ว กรุณาติดต่อผู้ดูแลระบบค่ะ"
        );

        continue;
      }

      // ==================================================
      // 9. ตรวจสอบว่าพนักงานตาม Token มีจริง
      // ==================================================
      const {
        data: employee,
        error: employeeError,
      } = await supabase
        .from("employees")
        .select(
          "id, full_name, employee_code"
        )
        .eq(
          "id",
          linkToken.employee_id
        )
        .maybeSingle();

      if (
        employeeError ||
        !employee
      ) {

        console.error(
          "❌ Employee query error:",
          employeeError
        );

        await replyLine(
          replyToken,
          "ไม่พบข้อมูลพนักงาน กรุณาติดต่อผู้ดูแลระบบค่ะ"
        );

        continue;
      }

      // ==================================================
      // 10. บันทึก LINE User ID
      //
      // *** ใช้ employees.line_id ***
      // ==================================================
      const {
        error: updateEmployeeError,
      } = await supabase
        .from("employees")
        .update({
          line_id: lineUserId,
        })
        .eq(
          "id",
          linkToken.employee_id
        );

      if (updateEmployeeError) {

        console.error(
          "❌ Employee update error:",
          updateEmployeeError
        );

        await replyLine(
          replyToken,
          "ไม่สามารถเชื่อมบัญชี LINE ได้ กรุณาติดต่อผู้ดูแลระบบค่ะ"
        );

        continue;
      }

      // ==================================================
      // 11. ทำเครื่องหมายว่ารหัสถูกใช้แล้ว
      // ==================================================
      const {
        error: usedError,
      } = await supabase
        .from("line_link_tokens")
        .update({
          used_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          linkToken.id
        );

      if (usedError) {

        console.error(
          "⚠️ Token used update error:",
          usedError
        );
      }

      // ==================================================
      // 12. ตอบกลับเมื่อเชื่อมสำเร็จ
      // ==================================================
      const employeeName =
        employee.full_name || "พนักงาน";

      await replyLine(
        replyToken,
        `✅ เชื่อมบัญชี LINE สำเร็จ\n\n${employeeName}\nสามารถรับการแจ้งเตือนจากระบบใบลาออนไลน์ได้แล้วค่ะ`
      );

      console.log(
        "✅ LINE linked:",
        employee.id,
        employeeName
      );
    }

    // ==================================================
    // LINE ต้องได้รับ HTTP 200
    // ==================================================
    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,

        headers: {
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {

    console.error(
      "❌ Webhook error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Internal server error",
      }),
      {
        status: 500,

        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});