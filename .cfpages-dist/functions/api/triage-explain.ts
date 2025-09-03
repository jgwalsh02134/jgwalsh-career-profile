// Minimal ambient type (Cloudflare Pages provides this at runtime)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type PagesFunction = (ctx: any) => Promise<Response> | Response;

export const onRequestPost: PagesFunction = async ({ request, env }: any) => {
  try {
  console.log('[triage-explain] POST received');
    const { narrative = "", band = {}, subscores = {}, hits = [], dampeners = [] } =
      await request.json().catch(() => ({}));

    // Minimal PII redaction (deterministic)
    const redacted = String(narrative)
      .replace(/\b\d{3}[-.\s]?\d{2,3}[-.\s]?\d{4}\b/g, "[REDACTED-PHONE]")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED-EMAIL]");

    const system = [
      "You write operational explanations for a behavioral threat-intake screen.",
      "Do NOT change any numeric scores or band labels. Use provided indicators only.",
      "Be concise and directive. Label any inference as 'suggested; needs corroboration'.",
      "Return compact JSON ONLY: { executive, rationales:{btam,trap18,hcr20,lexical,protective},",
      "plan:{immediate,next_24_72,follow_up}, caveats }"
    ].join(" ");

    const payload = { narrative: redacted, band, subscores, hits, dampeners };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: system },
            { role: "user", content: JSON.stringify(payload) }
        ]
      })
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return new Response(JSON.stringify({ error: "llm_error", detail }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    let json: any = {};
    try { json = JSON.parse(content || "{}"); }
    catch { json = { executive: content || "" }; }

  console.log('[triage-explain] success band=%s chars=%d', band?.label, String(narrative||'').length);
  return new Response(JSON.stringify(json), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (e: any) {
  console.error('[triage-explain] error', e);
    return new Response(JSON.stringify({ error: "server_error", detail: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
