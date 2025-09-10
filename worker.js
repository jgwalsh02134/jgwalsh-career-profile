export default {
    async fetch(request, env) {
        // Serve static assets first
        let res = await env.ASSETS.fetch(request);
        if (res.status !== 404) return res;

        // Custom 404.html if present
        const url = new URL(request.url);
        const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
        if (notFound.status !== 404) {
            return new Response(notFound.body, { status: 404, headers: notFound.headers });
        }

        return new Response("Not found", { status: 404 });
    },
};