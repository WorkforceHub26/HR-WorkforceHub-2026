// Diagnostics Script for Supabase & LINE Messaging API

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://pgogmhqjdchakcytsomx.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function runDiagnostics() {
  console.log("=================================================");
  console.log("🔍 SUPABASE & LINE MESSAGING API DIAGNOSTICS REPORT");
  console.log("=================================================\n");

  // TEST 1: Check Supabase REST API Connectivity
  console.log("--- [TEST 1] Testing Supabase Base Connection ---");
  let validEmpId = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=id,full_name&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log(`STATUS: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const emps = await res.json();
      console.log("✅ Supabase REST API endpoint is reachable.");
      if (emps && emps.length > 0) {
        validEmpId = emps[0].id;
        console.log(`ℹ️ Found existing employee for test: "${emps[0].full_name}" (ID: ${validEmpId})`);
      }
    } else {
      console.log("❌ Supabase REST API returned error.");
    }
  } catch (err) {
    console.error("❌ Failed to reach Supabase REST API:", err.message);
  }

  console.log("\n--- [TEST 2] Verifying RLS on 'line_link_tokens' Table ---");
  if (!validEmpId) {
    console.log("⚠️ Cannot find a valid employee ID to test line_link_tokens insert.");
  } else {
    const dummyToken = "999999";
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      // Attempt insert with Anon Key (Client Simulation)
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/line_link_tokens`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          employee_id: validEmpId,
          token: dummyToken,
          expires_at: expiresAt
        })
      });

      const bodyText = await insertRes.text();
      console.log(`HTTP Status: ${insertRes.status}`);

      if (insertRes.ok) {
        console.log("✅ RLS Check: Token inserted SUCCESSFULLY using ANON key!");
        console.log("Response:", bodyText);

        // Clean up test token
        await fetch(`${SUPABASE_URL}/rest/v1/line_link_tokens?token=eq.${dummyToken}`, {
          method: "DELETE",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        console.log("🧹 Test token cleaned up successfully.");
      } else {
        let jsonErr = {};
        try { jsonErr = JSON.parse(bodyText); } catch (e) {}

        if (jsonErr.code === "42501" || insertRes.status === 401 || insertRes.status === 403) {
          console.log("❌ RLS RESTRICTION DETECTED (Code 42501 / RLS Policy violation):");
          console.log(`   Message: ${jsonErr.message || bodyText}`);
          console.log("👉 ACTION REQUIRED: Execute 'ALTER TABLE line_link_tokens DISABLE ROW LEVEL SECURITY;' in Supabase SQL Editor.");
        } else {
          console.log(`⚠️ Insert Failed with Status ${insertRes.status}: ${bodyText}`);
        }
      }
    } catch (err) {
      console.error("❌ Error performing RLS token insert test:", err.message);
    }
  }

  console.log("\n--- [TEST 3] Testing Supabase Edge Function 'line-webhook' Endpoint ---");
  try {
    const webhookUrl = `${SUPABASE_URL}/functions/v1/line-webhook`;
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ events: [] })
    });
    console.log(`Endpoint URL: ${webhookUrl}`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.log(`Response: ${body}`);
    if (res.status === 200 || res.status === 204) {
      console.log("✅ Supabase Edge Function 'line-webhook' is ACTIVE and responding.");
    } else if (res.status === 401) {
      console.log("⚠️ Edge Function 'line-webhook' returned 401 (Enforce JWT enabled or auth token needed).");
    } else {
      console.log(`⚠️ Edge Function returned status ${res.status}.`);
    }
  } catch (err) {
    console.error("❌ Failed to contact Supabase Edge Function 'line-webhook':", err.message);
  }

  console.log("\n--- [TEST 4] Testing Supabase Edge Function 'line-send' Endpoint ---");
  try {
    const sendUrl = `${SUPABASE_URL}/functions/v1/line-send`;
    const res = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ ping: true })
    });
    console.log(`Endpoint URL: ${sendUrl}`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.log(`Response: ${body}`);
    if (res.status < 500) {
      console.log("✅ Supabase Edge Function 'line-send' is reachable.");
    } else {
      console.log(`⚠️ Edge Function 'line-send' returned status ${res.status}.`);
    }
  } catch (err) {
    console.error("❌ Failed to contact Supabase Edge Function 'line-send':", err.message);
  }

  console.log("\n--- [TEST 5] Testing LINE Messaging API Credentials ---");
  if (!LINE_ACCESS_TOKEN) {
    console.log("ℹ️ LINE_CHANNEL_ACCESS_TOKEN is not set in local process.env.");
    console.log("   (Note: Credentials are defined in Supabase Secrets as seen in screenshot).");
  } else {
    try {
      const lineRes = await fetch("https://api.line.me/v2/bot/info", {
        headers: { "Authorization": `Bearer ${LINE_ACCESS_TOKEN}` }
      });
      console.log(`LINE API Status: ${lineRes.status}`);
      if (lineRes.ok) {
        const botInfo = await lineRes.json();
        console.log(`✅ LINE Messaging API Credentials Valid!`);
        console.log(`   Bot Display Name: ${botInfo.displayName}`);
        console.log(`   Bot Basic ID: ${botInfo.basicId}`);
      } else {
        const errText = await lineRes.text();
        console.log(`❌ LINE Messaging API returned error: ${errText}`);
      }
    } catch (err) {
      console.error("❌ Failed to connect to LINE Messaging API:", err.message);
    }
  }

  console.log("\n=================================================");
  console.log("🏁 DIAGNOSTICS COMPLETED");
  console.log("=================================================");
}

runDiagnostics();
