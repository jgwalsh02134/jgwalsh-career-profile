// Clean single implementation (chat/completions)
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const apiKey = env.OPENAI_CHATBOT_KEY; // for /projects chatbot
    if (!apiKey) return json({ error: "Missing OPENAI_CHATBOT_KEY" }, 500);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    return new Response(r.body, {
      status: r.status,
      headers: { ...corsHeaders(), "Content-Type": r.headers.get("content-type") || "application/json" }
    });
  } catch (e) {
    return json({ error: e?.message || "chat error" }, 500);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}
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
Be concise and helpful. Prefer site-relative links (/projects/...).
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
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: sysPrompt },
          ...(Array.isArray(messages) ? messages : [])
        ]
      }),
    });

    const ct = r.headers.get("content-type") || "";
    if (!ct.toLowerCase().startsWith("application/json")) {
      const peek = await r.text();
      try { console.error("Upstream non-JSON response:", peek.slice(0, 400)); } catch {}
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Sorry—an upstream service returned an unexpected response. Please try again." } }]
      }), {
        status: r.ok ? 200 : (r.status || 502),
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "https://jgwalsh.com",
        },
      });
    }

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


