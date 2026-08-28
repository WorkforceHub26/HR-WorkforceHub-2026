import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// --- LINE Webhook & Linking Logic ---
app.post('/api/line-webhook', async (req, res) => {
  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    return res.sendStatus(200);
  }

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      // Check if text is a 6-digit linking code
      if (/^\d{6}$/.test(text)) {
        try {
          // Dynamic import for supabase to avoid top-level issues if needed, 
          // but we can assume we'll use fetch directly to Supabase REST API for simplicity in server.ts
          const SUPABASE_URL = process.env.SUPABASE_URL || "https://pgogmhqjdchakcytsomx.supabase.co";
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
            continue;
          }

          // 1. Find token
          const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/line_link_tokens?link_code=eq.${text}&used_at=is.null&select=*`, {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
          });
          const tokens = await tokenRes.json();

          if (tokens && tokens.length > 0) {
            const tokenData = tokens[0];
            const employeeId = tokenData.employee_id;

            // Check expiry
            if (new Date(tokenData.expires_at) > new Date()) {
              // 2. Update employee line_id
              await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${employeeId}`, {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ line_id: userId })
              });

              // 3. Mark token as used
              await fetch(`${SUPABASE_URL}/rest/v1/line_link_tokens?id=eq.${tokenData.id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ used_at: new Date().toISOString() })
              });

              await replyLine(replyToken, "✅ เชื่อมต่อระบบ HR เรียบร้อยแล้ว! คุณจะได้รับการแจ้งเตือนใบลาผ่านช่องทางนี้");
            } else {
              await replyLine(replyToken, "❌ รหัสเชื่อมต่อหมดอายุแล้ว กรุณาขอรหัสใหม่จากหน้าโปรไฟล์");
            }
          } else {
            // Not a linking code or already used, ignore or send help
          }
        } catch (err) {
          console.error("Webhook Error:", err);
        }
      }
    }
  }
  res.sendStatus(200);
});

async function replyLine(replyToken, text) {
  const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!LINE_ACCESS_TOKEN) return;

  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
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

// ฟังก์ชันส่ง Push Message ไปยัง LINE
async function sendLinePush(to: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
    return;
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
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
    const data = await response.json();
    console.log("LINE Push Response:", data);
  } catch (error) {
    console.error("Error sending LINE push:", error);
  }
}

// API สำหรับส่งแจ้งเตือน (เรียกจาก Client-side)
app.post("/api/send-notification", async (req, res) => {
  const { employee_id, title, message } = req.body;

  if (!employee_id || !title || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1. ดึงข้อมูล LINE ID ของพนักงาน
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("line_id")
      .eq("id", employee_id)
      .single();

    if (empError) {
        console.error("Error fetching employee line_id:", empError);
    }

    // 2. ถ้ามี LINE ID ให้ส่ง LINE ทันที
    if (employee && employee.line_id) {
      await sendLinePush(employee.line_id, `🔔 ${title}\n\n${message}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error in /api/send-notification:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the 'dist' directory
app.use(express.static(join(__dirname, 'dist')));

// Fallback to index.html for SPA routing (if needed)
app.use((req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
