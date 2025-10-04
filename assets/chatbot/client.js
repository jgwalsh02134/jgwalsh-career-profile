export function mountChat({ target = document.getElementById("site-chat-root"), endpoint = "/api/chat" } = {}){
  if(!target) return;
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;width:320px;z-index:9999;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.12);background:#fff;border:1px solid #e5e7eb;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;";
  box.innerHTML = `
    <div style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600;">Ask about these projects</div>
    <div style="padding:8px 12px;color:#555">Hi! I can help you explore the projects here.</div>
    <form style="display:flex;gap:6px;padding:8px 12px 12px;">
      <input aria-label="Your question" placeholder="Type your question..." style="flex:1;padding:8px;border:1px solid #ddd;border-radius:8px" />
      <button type="submit" style="padding:8px 12px;border:1px solid #111;border-radius:8px;background:#111;color:#fff">Send</button>
    </form>`;
  const input = box.querySelector("input");
  const form = box.querySelector("form");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const msg = input.value.trim(); if(!msg) return;
    input.value = "";
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: msg }] })
    });
  });
  target.appendChild(box);
}
