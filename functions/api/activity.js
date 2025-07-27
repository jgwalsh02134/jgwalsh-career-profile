export default {
  async fetch(request, env, ctx) {
    try {
      const list = await env.PRIVATE_ACTIVITY.list({ prefix: "event:" });
      const activities = await Promise.all(
        list.keys.map(async (key) => {
          const value = await env.PRIVATE_ACTIVITY.get(key.name, { type: "json" });
          return value;
        })
      );
      return Response.json({ activities: activities.filter(Boolean).reverse() });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Failed to load activity" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
};
