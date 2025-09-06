/* Minimal theme toggle with persistence + ARIA */
(function () {
  const root = document.documentElement, LS = 'theme';
  const btn = document.getElementById('theme-toggle');
  const btnM = document.getElementById('theme-toggle-mobile');
  const mmb = document.getElementById('mobile-menu-button');
  const mm = document.getElementById('mobile-menu');
  const prefers = matchMedia('(prefers-color-scheme: dark)');
  const get = () => { try { const t = localStorage.getItem(LS); if (t === 'dark' || t === 'light') return t; } catch { } return prefers.matches ? 'dark' : 'light'; };
  const set = t => {
    if (t === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    btn?.setAttribute('aria-pressed', String(t === 'dark'));
    btnM?.setAttribute('aria-pressed', String(t === 'dark'));
    try { localStorage.setItem(LS, t); } catch { }
  };
  const toggle = () => set(root.classList.contains('dark') ? 'light' : 'dark');
  set(get());
  prefers.addEventListener?.('change', () => { try { if (!localStorage.getItem(LS)) set(prefers.matches ? 'dark' : 'light'); } catch { } });
  btn?.addEventListener('click', toggle); btnM?.addEventListener('click', toggle);
  mmb?.addEventListener('click', () => { const open = !mm.classList.toggle('hidden'); mmb.setAttribute('aria-expanded', String(open)); });
})();


