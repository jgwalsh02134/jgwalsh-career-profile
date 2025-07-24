export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      const userEmail = request.headers.get('cf-access-authenticated-user-email');
      if (!userEmail) {
        return new Response('Unauthorized', { status: 401 });
      }
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return new Response('No file provided', { status: 400 });
      }
      console.log(`Received file ${file.name} (${file.size} bytes) from ${userEmail}`);
      return new Response(JSON.stringify({ success: true, fileName: file.name }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/CF_Authorization=([^;]+)/);

    if (!match) {
      return new Response("Unauthorized: No token", { status: 401 });
    }

    const token = match[1];
    try {
      const [, payload] = token.split(".");
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));

      const now = Date.now();
      const expires = decoded.exp * 1000;

      if (expires < now) {
        return new Response(JSON.stringify({
          status: "expired",
          reason: "Token has expired",
          exp: new Date(expires).toISOString()
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        status: "valid",
        email: decoded.email || "unknown",
        iat: new Date(decoded.iat * 1000).toISOString(),
        exp: new Date(expires).toISOString(),
        remaining: Math.floor((expires - now) / 1000),
        aud: decoded.aud || null,
        iss: decoded.iss || null
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response("Invalid token", { status: 400 });
    }
  }
}
