// Minimal ambient type (Cloudflare Pages provides this at runtime)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type PagesFunction = (ctx: any) => Promise<Response> | Response;

/**
 * Basic Auth gate for selected routes.
 * Protects `/about` and `/about.html` until the page is ready.
 *
 * Configure credentials in the Pages project environment:
 * - ABOUT_BASIC_USER
 * - ABOUT_BASIC_PASS
 */
export const onRequest: PagesFunction = async ({ request, env, next }: any) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const protectedPaths = new Set(["/about", "/about/", "/about.html"]);
  if (!protectedPaths.has(pathname)) {
    return next();
  }

  const unauthorized = () =>
    new Response("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Restricted", charset="UTF-8"',
        "Cache-Control": "no-store"
      }
    });

  const expectedUser = String(env.ABOUT_BASIC_USER || "");
  const expectedPass = String(env.ABOUT_BASIC_PASS || "");

  // If credentials are not configured, default to deny access
  if (!expectedUser || !expectedPass) {
    return unauthorized();
  }

  const authHeader = request.headers.get("Authorization") || "";
  const match = /^Basic\s+(.+)$/i.exec(authHeader || "");
  if (!match) {
    return unauthorized();
  }

  let user = "";
  let pass = "";
  try {
    const decoded = atob(match[1]);
    const idx = decoded.indexOf(":");
    if (idx === -1) return unauthorized();
    user = decoded.slice(0, idx);
    pass = decoded.slice(idx + 1);
  } catch {
    return unauthorized();
  }

  if (user !== expectedUser || pass !== expectedPass) {
    return unauthorized();
  }

  // Auth OK → continue to static asset or any downstream function
  return next();
};


