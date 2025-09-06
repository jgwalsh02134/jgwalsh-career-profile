/* Site-wide theme toggle + mobile menu wiring (singleton, idempotent) */
(function () {
  if (window.__themeInit) return; // prevent duplicate binding
  window.__themeInit = true;

  const root = document.documentElement;
  const LS = 'theme';
  const $ = id => document.getElementById(id);

  const btn = $('theme-toggle');
  const btnM = $('theme-toggle-mobile');
  const mmb = $('mobile-menu-button');
  const mm = $('mobile-menu');
  const prefers = matchMedia('(prefers-color-scheme: dark)');

  const get = () => {
    try { const v = localStorage.getItem(LS); if (v === 'light' || v === 'dark') return v; } catch { }
    return prefers.matches ? 'dark' : 'light';
  };

  const reflect = () => {
    const on = root.classList.contains('dark');
    btn?.setAttribute('aria-pressed', String(on));
    btnM?.setAttribute('aria-pressed', String(on));
  };

  const set = (t) => {
    if (t === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    reflect();
    try { localStorage.setItem(LS, t); } catch { }
  };

  const toggle = () => set(root.classList.contains('dark') ? 'light' : 'dark');

  const bindOnce = (el, type, fn) => { if (!el || el.dataset.bound === '1') return; el.addEventListener(type, fn, { passive: true }); el.dataset.bound = '1'; };

  // Initialize theme from storage / OS
  set(get());

  prefers.addEventListener?.('change', () => { try { if (!localStorage.getItem(LS)) set(prefers.matches ? 'dark' : 'light'); } catch { } });

  bindOnce(btn, 'click', toggle);
  bindOnce(btnM, 'click', toggle);
  bindOnce(mmb, 'click', () => { const open = !mm.classList.toggle('hidden'); mmb.setAttribute('aria-expanded', String(open)); });

  new MutationObserver(reflect).observe(root, { attributes: true, attributeFilter: ['class'] });
})();
