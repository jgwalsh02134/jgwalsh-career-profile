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

    const sysPrompt = `
You are the onsite assistant for https://jgwalsh.com/projects.
Be concise and helpful. Prefer site-relative links (e.g., /projects-folder/...).
If unsure, say so and offer the closest on-site resource.
Keep answers short (2–5 sentences) unless the user asks for detail.`;

    const body = {
      model: "gpt-5-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: sysPrompt },
        ...(Array.isArray(messages) ? messages : []),
      ],
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_CHATBOT_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
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


