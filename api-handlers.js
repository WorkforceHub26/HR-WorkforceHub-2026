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

// 1.1 Clear Approvers LINE & Mapping
export async function handleClearApproverLine(req, res) {
  try {
    let bodyData = {};
    if (typeof req.body === 'object' && req.body !== null) {
      bodyData = req.body;
    } else if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch (e) {}
    } else {
      bodyData = await parseJsonBody(req);
    }

    const { department_id, employee_ids } = bodyData;
    const { url, serviceKey } = getSupabaseConfig();
    const targetEmpIds = new Set(Array.isArray(employee_ids) ? employee_ids.filter(Boolean).map(String) : []);

    // If department_id is supplied, look up the supervisor and manager of that department
    if (department_id) {
      try {
        const appRes = await fetch(`${url}/rest/v1/department_approvers?department_id=eq.${department_id}&select=supervisor_id,manager_id`, {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        });
        if (appRes.ok) {
          const appData = await appRes.json();
          if (Array.isArray(appData)) {
            appData.forEach(row => {
              if (row.supervisor_id) targetEmpIds.add(String(row.supervisor_id));
              if (row.manager_id) targetEmpIds.add(String(row.manager_id));
            });
          }
        }
      } catch (err) {
        console.warn("Lookup department approvers warning:", err);
      }

      // Delete department_approvers record
      try {
        await fetch(`${url}/rest/v1/department_approvers?department_id=eq.${department_id}`, {
          method: 'DELETE',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        });
      } catch (delErr) {
        console.warn("Delete department approvers record warning:", delErr);
      }
    }

    // Clear line_id and delete tokens for each target employee
    const clearedList = [];
    for (const empId of targetEmpIds) {
      try {
        // Clear in-memory tokens
        for (const [t, data] of memoryLineTokens.entries()) {
          if (String(data.employee_id) === String(empId)) {
            memoryLineTokens.delete(t);
          }
        }

        // Delete line_link_tokens from DB
        await fetch(`${url}/rest/v1/line_link_tokens?employee_id=eq.${empId}`, {
          method: 'DELETE',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        });

        // Set line_id to null on employees table
        const updRes = await fetch(`${url}/rest/v1/employees?id=eq.${empId}`, {
          method: 'PATCH',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ line_id: null })
        });

        if (updRes.ok) {
          clearedList.push(empId);
          console.log(`✅ [LINE ID Cleared]: Cleared LINE ID for Employee ID ${empId}`);
        }
      } catch (updErr) {
        console.warn("Clear employee line_id warning for:", empId, updErr);
      }
    }

    return sendJson(res, 200, { success: true, clearedEmployees: clearedList });
  } catch (err) {
    console.error("Error in handleClearApproverLine:", err);
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

async function getLineAccessToken() {
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return process.env.LINE_CHANNEL_ACCESS_TOKEN;
  }
  try {
    const { url, serviceKey } = getSupabaseConfig();
    const resp = await fetch(`${url}/rest/v1/system_settings?setting_key=eq.line_oa_config&select=setting_value`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0 && data[0].setting_value?.channel_access_token) {
        return data[0].setting_value.channel_access_token;
      }
    }
  } catch (err) {
    console.warn("⚠️ [LINE Token Fetch Error]:", err);
  }
  return null;
}

// Helper Functions
async function replyLine(replyToken, text) {
  const token = await getLineAccessToken();
  if (!token) {
    console.warn("LINE Channel Access Token is not configured in process.env or system_settings");
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
  const token = await getLineAccessToken();
  if (!token) {
    console.warn("LINE Channel Access Token is not configured in process.env or system_settings");
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

/**
 * 🔒 Handle Recording Login Activity to 'login_logs' table in Supabase
 * Records User ID, Timestamp, and Device Info for audit purposes.
 */
export async function handleRecordLoginLog(req, res) {
  try {
    let bodyData = {};
    if (typeof req.body === 'object' && req.body !== null) {
      bodyData = req.body;
    } else if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch (e) {}
    } else {
      bodyData = await parseJsonBody(req);
    }

    const userId = bodyData.user_id || bodyData.userId || bodyData.employee_id || bodyData.employeeId;
    if (!userId) {
      return sendJson(res, 400, { error: 'Missing user identifier for login audit log' });
    }

    // Extract client IP address from request headers
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = forwardedFor ? String(forwardedFor).split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || 'Unknown IP');

    const timestamp = bodyData.timestamp || bodyData.client_timestamp || new Date().toISOString();
    const deviceInfo = bodyData.device_info || bodyData.deviceInfo || {};
    
    // Enrich device_info with server-observed headers if not already specified
    if (typeof deviceInfo === 'object' && deviceInfo !== null) {
      deviceInfo.server_ip = clientIp;
      if (!deviceInfo.user_agent && req.headers['user-agent']) {
        deviceInfo.user_agent = req.headers['user-agent'];
      }
    }

    const employeeId = bodyData.employee_id || (String(userId).length === 36 ? userId : null);
    const loginMethod = bodyData.login_method || bodyData.method || 'password';

    const record = {
      user_id: String(userId),
      employee_id: employeeId,
      employee_code: bodyData.employee_code || '',
      full_name: bodyData.full_name || '',
      role: bodyData.role || '',
      timestamp: timestamp,
      device_info: deviceInfo,
      ip_address: clientIp,
      login_method: loginMethod,
      status: bodyData.status || 'success',
      metadata: bodyData.metadata || { source: 'api' },
      created_at: timestamp
    };

    const { url, serviceKey } = getSupabaseConfig();
    let insertSuccess = false;
    let dbResult = null;

    // 1. Try insert into 'login_logs' table in Supabase via REST with service_role key
    try {
      const resp = await fetch(`${url}/rest/v1/login_logs`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(record)
      });

      if (resp.ok) {
        dbResult = await resp.json();
        insertSuccess = true;
        console.log(`✅ [Login Audit Log] Recorded to 'login_logs': User ${userId} (${loginMethod}) from ${clientIp}`);
      } else {
        const errText = await resp.text();
        console.warn(`⚠️ [Login Audit Log] Supabase 'login_logs' status ${resp.status}:`, errText);
      }
    } catch (dbErr) {
      console.warn("⚠️ [Login Audit Log] Supabase direct insert error:", dbErr.message);
    }

    // 2. Fallback to 'hr_admin_management_logs' if 'login_logs' is pending creation
    if (!insertSuccess) {
      try {
        await fetch(`${url}/rest/v1/hr_admin_management_logs`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            actor_id: employeeId,
            actor_name: bodyData.full_name || bodyData.employee_code || 'User',
            action_category: 'LOGIN_AUDIT',
            action_type: `LOGIN_${String(loginMethod).toUpperCase()}`,
            target_identifier: bodyData.employee_code || String(userId),
            description: `เข้าสู่ระบบสำเร็จผ่าน ${loginMethod} [IP: ${clientIp}]`,
            payload_after: record
          })
        });
        console.log("ℹ️ [Login Audit Log] Recorded into fallback audit table (hr_admin_management_logs)");
      } catch (fallbackErr) {
        console.warn("⚠️ [Login Audit Log] Fallback logging error:", fallbackErr.message);
      }
    }

    return sendJson(res, 200, {
      success: true,
      message: 'Login activity logged successfully',
      log: record,
      persisted_to_login_logs: insertSuccess,
      ip: clientIp
    });
  } catch (err) {
    console.error("❌ Error in handleRecordLoginLog:", err);
    return sendJson(res, 500, { error: err.message });
  }
}

/**
 * 📋 Handle Fetching Recent Login Logs for Audit Review with Date and Search Filtering
 */
export async function handleGetLoginLogs(req, res) {
  try {
    const { url, serviceKey } = getSupabaseConfig();
    const reqUrl = new URL(req.url, 'http://localhost');
    const limit = Math.min(Math.max(parseInt(reqUrl.searchParams.get('limit') || '100', 10), 1), 500);
    const startDate = reqUrl.searchParams.get('startDate'); // YYYY-MM-DD
    const endDate = reqUrl.searchParams.get('endDate');     // YYYY-MM-DD
    const search = reqUrl.searchParams.get('search');

    let queryParams = `select=*&order=timestamp.desc&limit=${limit}`;
    if (startDate) {
      queryParams += `&timestamp=gte.${encodeURIComponent(startDate + 'T00:00:00.000Z')}`;
    }
    if (endDate) {
      queryParams += `&timestamp=lte.${encodeURIComponent(endDate + 'T23:59:59.999Z')}`;
    }
    if (search) {
      queryParams += `&or=(user_id.ilike.*${encodeURIComponent(search)}*,full_name.ilike.*${encodeURIComponent(search)}*,employee_code.ilike.*${encodeURIComponent(search)}*,ip_address.ilike.*${encodeURIComponent(search)}*)`;
    }

    // 1. Try querying 'login_logs'
    try {
      const resp = await fetch(`${url}/rest/v1/login_logs?${queryParams}`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          return sendJson(res, 200, { success: true, source: 'login_logs', data });
        }
      }
    } catch (e) {}

    // 2. Query fallback from 'hr_admin_management_logs'
    try {
      let fallbackParams = `action_category=eq.LOGIN_AUDIT&select=*&order=created_at.desc&limit=${limit}`;
      if (startDate) {
        fallbackParams += `&created_at=gte.${encodeURIComponent(startDate + 'T00:00:00.000Z')}`;
      }
      if (endDate) {
        fallbackParams += `&created_at=lte.${encodeURIComponent(endDate + 'T23:59:59.999Z')}`;
      }

      const resp = await fetch(`${url}/rest/v1/hr_admin_management_logs?${fallbackParams}`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const mapped = data.map(item => item.payload_after || {
          user_id: item.actor_id,
          full_name: item.actor_name,
          employee_code: item.target_identifier,
          timestamp: item.created_at,
          device_info: { description: item.description },
          login_method: item.action_type
        });
        return sendJson(res, 200, { success: true, source: 'hr_admin_management_logs_fallback', data: mapped });
      }
    } catch (e) {}

    return sendJson(res, 200, { success: true, source: 'empty', data: [] });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

// 🧹 Purge login logs older than 90 days from 'login_logs' table
export async function handlePurgeLoginLogs(req, res) {
  try {
    const { url, serviceKey } = getSupabaseConfig();
    
    // Calculate the date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const isoString = ninetyDaysAgo.toISOString();

    console.log(`🧹 [Purge Login Logs] Initiated. Purging logs older than: ${isoString}`);

    // Delete from 'login_logs' table in Supabase via REST
    const resp = await fetch(`${url}/rest/v1/login_logs?timestamp=lt.${encodeURIComponent(isoString)}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation'
      }
    });

    if (resp.ok) {
      const data = await resp.json();
      const count = Array.isArray(data) ? data.length : 0;
      console.log(`✅ [Purge Login Logs] Successfully purged ${count} logs older than 90 days from 'login_logs'.`);
      return sendJson(res, 200, { success: true, count, dateLimit: isoString });
    } else {
      const errText = await resp.text();
      console.error(`❌ [Purge Login Logs] Failed to delete from Supabase:`, resp.status, errText);
      return sendJson(res, resp.status || 500, { success: false, error: errText });
    }
  } catch (err) {
    console.error("Error in handlePurgeLoginLogs:", err);
    return sendJson(res, 500, { success: false, error: err.message });
  }
}


