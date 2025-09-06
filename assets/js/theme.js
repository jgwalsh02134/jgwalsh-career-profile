(function () {
  const root = document.documentElement, LS = 'theme';
  const btn = document.getElementById('theme-toggle');
  const btnM = document.getElementById('theme-toggle-mobile');
  /* Theme toggle + mobile menu wiring (site-wide) */
  (function () {
    const root = document.documentElement, LS = 'theme';
    const prefers = matchMedia('(prefers-color-scheme: dark)');

    const btn = document.getElementById('theme-toggle');
    const btnM = document.getElementById('theme-toggle-mobile');
    const mmb = document.getElementById('mobile-menu-button');
    const mm = document.getElementById('mobile-menu');

    const get = () => { try { const v = localStorage.getItem(LS); if (v === 'light' || v === 'dark') return v; } catch { } return prefers.matches ? 'dark' : 'light'; };
    const set = t => {
      t === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
      btn?.setAttribute('aria-pressed', String(t === 'dark'));
      btnM?.setAttribute('aria-pressed', String(t === 'dark'));
      try { localStorage.setItem(LS, t); } catch { }
    };
    const toggle = () => set(root.classList.contains('dark') ? 'light' : 'dark');

    // init
    set(get());

    // follow OS only if user didn’t choose explicitly
    prefers.addEventListener?.('change', () => {
      try { if (!localStorage.getItem(LS)) set(prefers.matches ? 'dark' : 'light'); } catch { }
    });

    btn?.addEventListener('click', toggle);
    btnM?.addEventListener('click', toggle);

    // mobile menu
    mmb?.addEventListener('click', () => {
      const open = !mm.classList.toggle('hidden');
      mmb.setAttribute('aria-expanded', String(open));
    });
  })();
})();


