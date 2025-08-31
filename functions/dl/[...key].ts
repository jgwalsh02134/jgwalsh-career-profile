export const onRequestGet: PagesFunction<{ LIBRARY: R2Bucket }> = async (ctx) => {
  const { LIBRARY } = ctx.env;
  const key = ctx.params.key as string | undefined;
  if (!key) return new Response("Missing key", { status: 400 });

  try {
    const obj = await LIBRARY.get(key);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", obj.httpMetadata?.contentType || "application/pdf");
    headers.set("Content-Length", String(obj.size));
    headers.set("Content-Disposition", `inline; filename="${key.split('/').pop()}"`);
    return new Response(obj.body, { headers });
  } catch (err) {
    return new Response("Error fetching object", { status: 500 });
  }
};


