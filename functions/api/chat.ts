export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: corsHeaders() });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json();
    const apiKey = env.OPENAI_CHATBOT_KEY; // used by /projects chatbot
    if (!apiKey) return json({ error: "Missing OPENAI_CHATBOT_KEY" }, 500);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    return new Response(r.body, {
      status: r.status,
      headers: { ...corsHeaders(), "Content-Type": r.headers.get("content-type") || "application/json" }
    });
  } catch (e: any) {
    return json({ error: e?.message || "chat error" }, 500);
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}
export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: corsHeaders() });
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json();
    const apiKey = env.OPENAI_CHATBOT_KEY; // for /projects chatbot
    if (!apiKey) return json({ error: "Missing OPENAI_CHATBOT_KEY" }, 500);
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}", "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return new Response(r.body, { status: r.status, headers: { ...corsHeaders(), "Content-Type": r.headers.get("content-type") || "application/json" }});
  } catch (e: any) { return json({ error: e?.message || "chat error" }, 500); }
};
function corsHeaders(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type, Authorization" } }
function json(data:unknown,status=200){ return new Response(JSON.stringify(data),{status,headers:{...corsHeaders(),"Content-Type":"application/json"}}) }
