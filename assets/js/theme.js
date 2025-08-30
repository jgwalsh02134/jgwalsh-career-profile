(() => {
  const KEY = "theme";
  const doc = document.documentElement;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");

  const stored = localStorage.getItem(KEY);
  const initial = stored || (mql.matches ? "dark" : "light");
  doc.setAttribute("data-theme", initial);
  doc.style.colorScheme = initial;
  if(initial === "dark"){ doc.classList.add("dark"); } else { doc.classList.remove("dark"); }

  window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function render(theme){
      btn.setAttribute("aria-pressed", String(theme === "dark"));
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
    render(initial);

    btn.addEventListener("click", () => {
      const cur = doc.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = cur === "dark" ? "light" : "dark";
      doc.setAttribute("data-theme", next);
      doc.style.colorScheme = next;
      if(next === "dark"){ doc.classList.add("dark"); } else { doc.classList.remove("dark"); }
      localStorage.setItem(KEY, next);
      render(next);
    });

    mql.addEventListener?.("change", e => {
      if (!localStorage.getItem(KEY)) {
        const next = e.matches ? "dark" : "light";
        doc.setAttribute("data-theme", next);
        doc.style.colorScheme = next;
        if(next === "dark"){ doc.classList.add("dark"); } else { doc.classList.remove("dark"); }
        render(next);
      }
    });
  });
})();


