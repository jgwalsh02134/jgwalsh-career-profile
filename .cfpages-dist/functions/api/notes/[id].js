export const onRequest = async (context) => {
  const { request, env, params } = context;
  const id = params?.id;
  if (!id) return new Response('Bad Request', { status: 400 });

  // Utility
  const decodeJwt = (token) => {
    try {
      const [, payload] = token.split('.');
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
  };

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
  if (!email) return new Response('Unauthorized', { status: 401 });

  const key = `note:${email}:${id}`;

  if (request.method === 'DELETE') {
    await env.PRIVATE_ACTIVITY.delete(key);
    return new Response(null, { status: 204 });
  }

  if (request.method === 'OPTIONS') {
    const url = new URL(request.url);
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, cf-access-jwt-assertion, CF-Access-Jwt-Assertion',
      },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
};


