export async function onRequestGet({ env }) {
  try {
    const list = await env.PRIVATE_ACTIVITY.list({ prefix: "event:" });
    const activities = await Promise.all(
      list.keys.map(async (key) => {
        const data = await env.PRIVATE_ACTIVITY.get(key.name, { type: "json" });
        return data;
      })
    );
    return Response.json({ activities: activities.filter(Boolean).reverse() });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch activity" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
