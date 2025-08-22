export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // ——— Helpers ———
    const decodeJwt = (token) => {
      try {
        const [, payload] = token.split('.')
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      } catch { return null }
    }
    const getUserEmail = () => {
      const headerEmail = request.headers.get('cf-access-authenticated-user-email')
      if (headerEmail) return headerEmail
      const tokenHeader = request.headers.get('cf-access-jwt-assertion') || request.headers.get('CF-Access-Jwt-Assertion')
      if (tokenHeader) return decodeJwt(tokenHeader)?.email || null
      const cookie = request.headers.get('cookie') || ''
      const m = cookie.match(/CF_Authorization=([^;]+)/)
      if (m) return decodeJwt(m[1])?.email || null
      return null
    }

    // ——— Upload endpoint ———
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      const userEmail = request.headers.get('cf-access-authenticated-user-email');
      if (!userEmail) {
        return new Response('Unauthorized', { status: 401 });
      }
      const formData = await request.formData();
      const file = formData.get('file');
      const iv = formData.get('iv');
      const originalFileName = formData.get('originalFileName');
      if (!(file instanceof File) || !iv || !originalFileName) {
        return new Response('Missing file, IV, or original file name', { status: 400 });
      }
      // Store encrypted blob in R2 with metadata
      const arrayBuffer = await file.arrayBuffer();
      const key = `${Date.now()}-${originalFileName}`;
      await env.UPLOADS.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
        customMetadata: { iv, originalFileName }
      });
      return new Response(JSON.stringify({ success: true, originalFileName, key }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ——— Notes API ———
    if (url.pathname === '/api/notes' && request.method === 'GET') {
      const email = getUserEmail()
      if (!email) return new Response('Unauthorized', { status: 401 })
      const kv = env.NOTES_KV || env.PRIVATE_ACTIVITY
      if (!kv) return new Response('KV binding missing', { status: 500 })
      const prefix = `note:${email}:`
      const list = await kv.list({ prefix })
      const notes = await Promise.all(list.keys.map(async (k) => {
        const val = await kv.get(k.name, { type: 'json' })
        return val
      }))
      const filtered = notes.filter(Boolean).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      return new Response(JSON.stringify({ notes: filtered }), { headers: { 'Content-Type': 'application/json' }})
    }
    if (url.pathname === '/api/notes' && request.method === 'POST') {
      const email = getUserEmail()
      if (!email) return new Response('Unauthorized', { status: 401 })
      const kv = env.NOTES_KV || env.PRIVATE_ACTIVITY
      if (!kv) return new Response('KV binding missing', { status: 500 })
      let body
      try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
      const title = String(body?.title ?? '').trim()
      const content = String(body?.body ?? '').trim()
      if (!title || !content) return new Response('Both title and body are required', { status: 400 })
      const id = `${Date.now()}-${Math.random().toString(36).slice(2,10)}`
      const note = { id, title, body: content, timestamp: Date.now() }
      const key = `note:${email}:${id}`
      await kv.put(key, JSON.stringify(note))
      return new Response(JSON.stringify({ ok: true, note }), { status: 201, headers: { 'Content-Type': 'application/json' }})
    }
    if (url.pathname.startsWith('/api/notes/') && request.method === 'DELETE') {
      const email = getUserEmail()
      if (!email) return new Response('Unauthorized', { status: 401 })
      const kv = env.NOTES_KV || env.PRIVATE_ACTIVITY
      if (!kv) return new Response('KV binding missing', { status: 500 })
      const id = decodeURIComponent(url.pathname.replace('/api/notes/',''))
      const key = `note:${email}:${id}`
      await kv.delete(key)
      return new Response(null, { status: 204 })
    }

    // ——— Default: validate Access token endpoint (kept for /dashboard/api/validate route) ———
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/CF_Authorization=([^;]+)/);
    if (!match) return new Response("Unauthorized: No token", { status: 401 });
    const token = match[1];
    try {
      const [, payload] = token.split(".");
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      const now = Date.now();
      const expires = decoded.exp * 1000;
      if (expires < now) {
        return new Response(JSON.stringify({ status: "expired", reason: "Token has expired", exp: new Date(expires).toISOString() }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ status: "valid", email: decoded.email || "unknown", iat: new Date(decoded.iat * 1000).toISOString(), exp: new Date(expires).toISOString(), remaining: Math.floor((expires - now) / 1000), aud: decoded.aud || null, iss: decoded.iss || null }), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
      return new Response("Invalid token", { status: 400 });
    }
  }
}
