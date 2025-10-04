export async function analyzeWithAI(payload){
  const r = await fetch("/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if(!r.ok) throw new Error("triage failed");
  return await r.json();
}
