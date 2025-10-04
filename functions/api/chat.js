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
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      const text = await r.text();
      return jsonShape(text ? `Upstream non-JSON response (${r.status}).` : "Empty response from upstream.", r.ok ? 200 : r.status || 502);
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content ?? data?.error?.message ?? "";
    if (!text) return jsonShape("No content available. Try rephrasing your question.", r.ok ? 200 : r.status || 500);
    return new Response(JSON.stringify({ choices: [{ message: { content: String(text) } }] }), {
      status: r.ok ? 200 : r.status || 500,
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
