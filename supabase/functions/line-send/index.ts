import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";

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
    const { to, message, flexMessage } = await req.json();

    if (!to) {
      throw new Error("Missing 'to' parameter (LINE User ID)");
    }

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured.");
    }

    const messages = [];

    if (flexMessage) {
      messages.push(flexMessage);
    } else if (message) {
      messages.push({
        type: "text",
        text: message
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
