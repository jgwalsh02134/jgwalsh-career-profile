export const onRequestGet: PagesFunction<{ LIBRARY: R2Bucket }> = async (ctx) => {
  const { LIBRARY } = ctx.env;
  // Catch-all param named "path" because the file is [[path]].ts
  const key = ctx.params.path as string | undefined;
  if (!key) return new Response("Missing key", { status: 400 });

  try {
    const obj = await LIBRARY.get(key);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();

    // Content type: prefer stored httpMetadata, else generic
    const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
    headers.set("Content-Type", contentType);

    // Disposition: inline by default with filename
    if (obj.httpMetadata?.contentDisposition) {
      headers.set("Content-Disposition", obj.httpMetadata.contentDisposition);
    } else {
      const filename = key.split("/").pop() || "download";
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
    }

    // Optional: simple caching (adjust to your needs)
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(obj.body, { headers, status: 200 });
  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
};


