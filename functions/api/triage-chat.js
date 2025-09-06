export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // Threat Triage uses the general OPENAI_API_KEY (as requested)
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return new Response('Missing OPENAI_API_KEY', { status: 500 });

  let body;
  try { body = await request.json(); }
  catch { return new Response('Invalid JSON body', { status: 400 }); }

  const { messages = [], model = 'gpt-4o-mini', stream = false } = body;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages, temperature: 0.2, stream })
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('OpenAI upstream error (triage-chat):', res.status, txt);
      return new Response('Upstream error', { status: 502 });
    }

    const data = await res.json();
    const ORIGIN = new URL(request.url).origin;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ORIGIN
      }
    });
  } catch (err) {
    console.error('triage-chat worker error:', err);
    return new Response('Server error', { status: 500 });
  }
}

export function onRequestOptions({ request }) {
  const ORIGIN = new URL(request.url).origin;
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}
