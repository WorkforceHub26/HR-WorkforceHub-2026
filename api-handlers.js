import { URL } from 'url';

// Shared in-memory token store for LINE linking
const memoryLineTokens = new Map();

function getSupabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://pgogmhqjdchakcytsomx.supabase.co";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;
  return { url, anonKey, serviceKey };
}

// 1. Create LINE Link Code
export async function handleCreateLineLink(req, res) {
  try {
    let bodyData = {};
    if (typeof req.body === 'object' && req.body !== null) {
      bodyData = req.body;
    } else if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch (e) {}
    } else {
      bodyData = await parseJsonBody(req);
    }

    const employee_id = bodyData.employee_id || bodyData.employeeId;
    if (!employee_id) {
      return sendJson(res, 400, { error: 'Missing employee_id' });
    }

    // ล้าง token เก่าของ employee คนนี้ใน memory
    for (const [t, data] of memoryLineTokens.entries()) {
      if (String(data.employee_id) === String(employee_id)) {
        memoryLineTokens.delete(t);
      }
    }

    // สุ่มรหัส 6 หลัก
    const token = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    const expiresAt = new Date(expiresAtMs).toISOString();

    // บันทึกลง Memory Cache
    memoryLineTokens.set(token, {
      employee_id: String(employee_id),
      expires_at: expiresAtMs
    });

    console.log(`🔑 [LINE Link Created]: Employee ID ${employee_id} -> Token: ${token}`);

    // พยายามลองบันทึกลง Supabase DB ด้วย
    const { url, serviceKey } = getSupabaseConfig();
    try {
      // ลบ token เก่าใน DB ก่อน
      await fetch(`${url}/rest/v1/line_link_tokens?employee_id=eq.${employee_id}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });

      // บันทึก token ใหม่ (รองรับทั้งคอลัมน์ token และ link_code เพื่อให้เข้ากับ Supabase Edge Function)
      const dbRes = await fetch(`${url}/rest/v1/line_link_tokens`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          employee_id: employee_id,
          token: token,
          link_code: token,
          expires_at: expiresAt
        })
      });

      if (!dbRes.ok) {
        const errText = await dbRes.text();
        console.warn("⚠️ [Supabase DB Insert line_link_tokens Failed]:", dbRes.status, errText);
      } else {
        console.log("✅ [Supabase DB Insert line_link_tokens Success]: Token saved to DB.");
      }
    } catch (dbErr) {
      console.warn("DB insert token warning:", dbErr);
    }

    return sendJson(res, 200, { success: true, token, expires_at: expiresAt });
  } catch (err) {
    console.error("Error in handleCreateLineLink:", err);
    return sendJson(res, 500, { error: err.message });
  }
}

// 2. LINE Webhook
export async function handleLineWebhook(req, res) {
  try {
    let bodyData = {};
    if (typeof req.body === 'object' && req.body !== null) {
      bodyData = req.body;
    } else if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch (e) {}
    } else {
      bodyData = await parseJsonBody(req);
    }

    const events = bodyData.events;
    if (!events || !Array.isArray(events)) {
      return sendJson(res, 200, { status: "ok" });
    }

    const { url, serviceKey } = getSupabaseConfig();

    for (const event of events) {
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        const text = (event.message.text || '').trim();
        const userId = event.source?.userId;
        const replyToken = event.replyToken;

        console.log(`📩 [LINE Webhook Received]: Text="${text}" from User="${userId}"`);

        // ค้นหาตัวเลข 6 หลักในข้อความ
        const match = text.match(/\b\d{6}\b/);
        if (match) {
          const code = match[0];
          let matchedEmpId = null;

          // 1) ค้นหาจาก Memory Cache
          const memData = memoryLineTokens.get(code);
          if (memData) {
            if (Date.now() <= memData.expires_at) {
              matchedEmpId = memData.employee_id;
            } else {
              console.warn(`⏳ [LINE Link Expired]: Code ${code} in memory expired.`);
            }
            memoryLineTokens.delete(code);
          }

          // 2) ถ้าไม่เจอใน Memory ลองค้นหาจาก Supabase DB
          if (!matchedEmpId) {
            try {
              const tokenRes = await fetch(`${url}/rest/v1/line_link_tokens?or=(token.eq.${code},link_code.eq.${code})&select=*`, {
                headers: {
                  'apikey': serviceKey,
                  'Authorization': `Bearer ${serviceKey}`
                }
              });
              const tokens = await tokenRes.json();
              if (Array.isArray(tokens) && tokens.length > 0) {
                const tokenData = tokens[0];
                if (new Date(tokenData.expires_at) > new Date()) {
                  matchedEmpId = tokenData.employee_id;
                }
                // ลบ token ที่ใช้แล้ว
                await fetch(`${url}/rest/v1/line_link_tokens?id=eq.${tokenData.id}`, {
                  method: 'DELETE',
                  headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`
                  }
                });
              }
            } catch (dbFetchErr) {
              console.warn("DB Token fetch error:", dbFetchErr);
            }
          }

          // 3) อัปเดตข้อมูลพนักงาน
          if (matchedEmpId) {
            console.log(`✅ [LINE Link Success]: Connecting Employee ${matchedEmpId} to LINE User ${userId}`);
            
            const updateRes = await fetch(`${url}/rest/v1/employees?id=eq.${matchedEmpId}`, {
              method: 'PATCH',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({ line_id: userId })
            });

            if (!updateRes.ok) {
              const errTxt = await updateRes.text();
              console.error("Failed to update employee line_id in Supabase:", errTxt);
            }

            if (replyToken) {
              await replyLine(replyToken, "✅ เชื่อมต่อระบบ HR เรียบร้อยแล้ว! คุณจะได้รับการแจ้งเตือนใบลาผ่านช่องทางนี้");
            }
          } else {
            console.warn(`❌ [LINE Link Failed]: Invalid or expired code "${code}"`);
            if (replyToken) {
              await replyLine(replyToken, "❌ รหัสเชื่อมต่อไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่จากหน้าระบบ");
            }
          }
        }
      }
    }

    return sendJson(res, 200, { status: "ok" });
  } catch (err) {
    console.error("Error in handleLineWebhook:", err);
    return sendJson(res, 200, { status: "error", error: err.message });
  }
}

// 3. Send Notification
export async function handleSendNotification(req, res) {
  try {
    let bodyData = {};
    if (typeof req.body === 'object' && req.body !== null) {
      bodyData = req.body;
    } else if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch (e) {}
    } else {
      bodyData = await parseJsonBody(req);
    }

    const { employee_id, title, message, flexMessage, recipientLineId } = bodyData;
    if ((!employee_id && !recipientLineId) || !title || !message) {
      return sendJson(res, 400, { error: "Missing required fields" });
    }

    const { url, serviceKey } = getSupabaseConfig();

    let lineId = recipientLineId || "";
    if (!lineId && employee_id) {
      try {
        const empRes = await fetch(`${url}/rest/v1/employees?id=eq.${employee_id}&select=line_id`, {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        });
        const emps = await empRes.json();
        if (Array.isArray(emps) && emps.length > 0) {
          lineId = emps[0].line_id || "";
        }
      } catch (fetchErr) {
        console.warn("Error fetching employee line_id:", fetchErr);
      }
    }

    if (lineId) {
      await sendLinePush(lineId, `🔔 ${title}\n\n${message}`, flexMessage);
    }

    return sendJson(res, 200, { success: true, lineSent: Boolean(lineId) });
  } catch (err) {
    console.error("Error in handleSendNotification:", err);
    return sendJson(res, 500, { error: err.message });
  }
}

// Helper Functions
async function replyLine(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN is not configured in process.env");
    return;
  }

  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: text }]
      })
    });
  } catch (e) {
    console.error("Reply Line Error:", e);
  }
}

async function sendLinePush(to, message, flexMessage = null) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN is not configured in process.env");
    return;
  }

  try {
    const messages = [];
    if (flexMessage && typeof flexMessage === 'object') {
      messages.push(flexMessage);
    } else {
      messages.push({ type: "text", text: message });
    }

    const resp = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to: to,
        messages: messages
      })
    });

    if (!resp.ok && flexMessage) {
      const errText = await resp.text();
      console.warn("⚠️ [LINE Push] Flex message push response not OK:", errText, "Falling back to text message...");
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          to: to,
          messages: [{ type: "text", text: message }]
        })
      });
    }
  } catch (error) {
    console.error("Error sending LINE push:", error);
  }
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
