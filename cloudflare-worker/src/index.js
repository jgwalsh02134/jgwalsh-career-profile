export default {
	async fetch(request, env, ctx) {
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
		if (decoded.exp * 1000 < now) {
		  return new Response("Session expired", { status: 403 });
		}
  
		return new Response(JSON.stringify({
		  email: decoded.email || "unknown",
		  iat: new Date(decoded.iat * 1000).toISOString(),
		  exp: new Date(decoded.exp * 1000).toISOString(),
		  remaining: Math.floor((decoded.exp * 1000 - now) / 1000)
		}), {
		  headers: { "Content-Type": "application/json" }
		});
  
	  } catch (err) {
		return new Response("Invalid token", { status: 400 });
	  }
	}
  }