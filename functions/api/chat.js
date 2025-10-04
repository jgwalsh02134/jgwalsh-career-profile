export async function onRequestOptions() {
  return new Response(null, { headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }});
}
export async function onRequestPost({ request, env }) {
  try {
    const apiKey = env.OPENAI_CHATBOT_KEY;
    if (!apiKey) return json({ error: "Missing OPENAI_CHATBOT_KEY" }, 500);
    const body = await request.json();
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return new Response(r.body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return json({ error: e?.message || "chat error" }, 500);
  }
}
function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status, headers: {
      "Content-Type":"application/json",
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"POST,OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type, Authorization"
    }
  });
}
