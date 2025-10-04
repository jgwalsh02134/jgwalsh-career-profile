export async function onRequestOptions() { return new Response(null, { headers: cors() }); }
export async function onRequestPost({ request, env }) {
  try {
    const apiKey = env.OPENAI_CHATBOT_KEY;
    if (!apiKey) return jsonShape("Missing OPENAI_CHATBOT_KEY", 500);
    const incoming = await request.json().catch(() => ({}));
    const messages = Array.isArray(incoming?.messages) ? incoming.messages : [];
    const model = incoming?.model || "gpt-4o-mini";
    const sys = incoming?.system || "You are the onsite assistant for https://jgwalsh.com/projects. Be concise, use site-relative links when possible.";
    const payload = {
      model,
      messages: [{ role: "system", content: sys }, ...messages].slice(-30),
      temperature: typeof incoming?.temperature === "number" ? incoming.temperature : 0.2,
    };
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const upstreamText = await upstream.text();
    let parsed; try { parsed = JSON.parse(upstreamText); } catch { parsed = null; }
    const replyText = parsed?.choices?.[0]?.message?.content ?? parsed?.error?.message ?? upstreamText ?? "No content returned.";
    return new Response(JSON.stringify({ choices: [{ message: { content: String(replyText) } }] }), {
      status: upstream.ok ? 200 : upstream.status || 500,
      headers: { "Content-Type": "application/json", ...cors() },
    });
  } catch (e) { return jsonShape(e?.message || "chat error", 500); }
}
function cors(){ return {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};}
function jsonShape(text, status=200){
  return new Response(JSON.stringify({ choices: [{ message: { content: String(text) } }] }), {
    status, headers: { "Content-Type": "application/json", ...cors() }
  });
}
