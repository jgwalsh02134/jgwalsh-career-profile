export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // Utility: decode JWT (no verification, Access already enforces policy)
  const decodeJwt = (token) => {
    try {
      const [, payload] = token.split('.');
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  };

  // Resolve user email from Access headers / JWT / cookie
  const getUserEmail = () => {
    const emailHeader = request.headers.get('cf-access-authenticated-user-email');
    if (emailHeader) return emailHeader;
    const tokenHeader = request.headers.get('cf-access-jwt-assertion') || request.headers.get('CF-Access-Jwt-Assertion');
    if (tokenHeader) {
      const payload = decodeJwt(tokenHeader);
      return payload?.email || null;
    }
    const cookie = request.headers.get('cookie') || '';
    const m = cookie.match(/CF_Authorization=([^;]+)/);
    if (m) {
      const payload = decodeJwt(m[1]);
      return payload?.email || null;
    }
    return null;
  };

  const email = getUserEmail();
  if (!email) {
    return new Response('Unauthorized', { status: 401 });
  }

  const notesPrefix = `note:${email}:`;

  if (request.method === 'GET') {
    // List notes for user
    const list = await env.PRIVATE_ACTIVITY.list({ prefix: notesPrefix });
    const notes = await Promise.all(
      list.keys.map(async (k) => {
        const value = await env.PRIVATE_ACTIVITY.get(k.name, { type: 'json' });
        if (!value) return null;
        return value;
      })
    );
    const filtered = notes.filter(Boolean).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return Response.json({ notes: filtered });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    const title = String(body?.title ?? '').trim();
    const content = String(body?.body ?? '').trim();
    if (!title || !content) {
      return new Response('Both title and body are required', { status: 400 });
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const note = { id, title, body: content, timestamp: Date.now() };
    const key = `${notesPrefix}${id}`;
    await env.PRIVATE_ACTIVITY.put(key, JSON.stringify(note), { metadata: { email } });
    return Response.json({ ok: true, note }, { status: 201 });
  }

  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, cf-access-jwt-assertion, CF-Access-Jwt-Assertion',
      },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
};


