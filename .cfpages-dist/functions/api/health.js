export const onRequest = () => {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
};
