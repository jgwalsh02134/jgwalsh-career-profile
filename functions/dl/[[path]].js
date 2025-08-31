/** Streams R2 object at /dl/<key> (supports slashes). Requires Pages R2 binding: LIBRARY -> resources-library */
export const onRequestGet = async (ctx) => {
  const { LIBRARY } = ctx.env || {};
  const key = ctx.params?.path;
  if (!LIBRARY) return new Response("R2 binding LIBRARY missing", { status: 500 });
  if (!key)     return new Response("Missing key", { status: 400 });

  const obj = await LIBRARY.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Content-Disposition", `inline; filename="${(key.split('/').pop()||'download')}"`);
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(obj.body, { headers });
};


