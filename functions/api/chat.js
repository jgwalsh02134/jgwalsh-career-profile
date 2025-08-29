export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://jgwalsh.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { messages } = await request.json();

    // Optional early guard: if no messages provided, return a friendly default
    if (!Array.isArray(messages) || messages.length === 0) {
      const defaultReply = "Hello! Ask me about the projects on this page.";
      return new Response(JSON.stringify({ choices: [{ message: { content: defaultReply } }] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "https://jgwalsh.com",
        },
      });
    }

    const defaultPrompt = `
You are the onsite assistant for https://jgwalsh.com/projects.
Be concise and helpful. Prefer site-relative links (/projects-folder/...).
If unsure, say so and point to the closest on-site resource.
Keep answers to 2–5 sentences unless asked for detail.`;

    const sysPrompt = env.CHATBOT_SYSTEM_PROMPT || defaultPrompt;

    // Use Responses API so we can call gpt-5-mini
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_CHATBOT_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: sysPrompt }]
          },
          ...(Array.isArray(messages) ? messages.map(m => ({
            role: m.role,
            content: [{ type: "input_text", text: String(m.content ?? "") }]
          })) : [])
        ]
      }),
    });

    const raw = await r.json();
    console.log("DEBUG raw OpenAI response:", JSON.stringify(raw, null, 2));

    // Minimal server-side logging (visible in Cloudflare Pages → Deployments → View logs)
    try { console.log("OpenAI raw:", JSON.stringify(raw)); } catch {}

    let text = "";
    if (typeof raw.output_text === "string" && raw.output_text.trim().length) {
      text = raw.output_text.trim();
    } else if (Array.isArray(raw.output) && raw.output[0]?.content?.[0]?.text) {
      text = String(raw.output[0].content[0].text).trim();
    } else if (raw.error?.message) {
      text = `Error: ${raw.error.message}`;
    }
    if (!text) {
      text = "Sorry—no content was returned. Try rephrasing, or ask me about a specific page (e.g., “Where is the résumé?”).";
    }

    // Always normalize to a chat/completions-like shape for the frontend
    return new Response(JSON.stringify({
      choices: [{ message: { content: text } }]
    }), {
      status: r.ok ? 200 : (r.status || 500),
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "https://jgwalsh.com",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "bad request" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "https://jgwalsh.com",
      },
    });
  }
}


