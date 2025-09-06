/* Theme toggle + mobile drawer (singleton) */
(function () {
  if (window.__themeInit) return; window.__themeInit = true;
  const root = document.documentElement, LS = 'theme', $ = id => document.getElementById(id);
  const btn = $('theme-toggle'), btnM = $('theme-toggle-mobile');
  const mmb = $('mobile-menu-button'), mm = $('mobile-menu');
  const prefers = matchMedia('(prefers-color-scheme: dark)');

  const reflect = () => {
    const on = root.classList.contains('dark');
    btn?.setAttribute('aria-pressed', String(on)); btnM?.setAttribute('aria-pressed', String(on));
  };
  const set = t => { t === 'dark' ? root.classList.add('dark') : root.classList.remove('dark'); reflect(); try { localStorage.setItem(LS, t); } catch { } };
  const get = () => { try { const v = localStorage.getItem(LS); if (v === 'light' || v === 'dark') return v; } catch { } return prefers.matches ? 'dark' : 'light'; };
  const toggle = () => set(root.classList.contains('dark') ? 'light' : 'dark');
  const bindOnce = (el, ev, fn) => { if (!el || el.dataset.bound === '1') return; el.addEventListener(ev, fn, { passive: true }); el.dataset.bound = '1'; };

  set(get());
  prefers.addEventListener?.('change', () => { try { if (!localStorage.getItem(LS)) set(prefers.matches ? 'dark' : 'light'); } catch { } });

  bindOnce(btn, 'click', toggle);
  bindOnce(btnM, 'click', toggle);
  bindOnce(mmb, 'click', () => { const open = !mm.classList.toggle('hidden'); mmb.setAttribute('aria-expanded', String(open)); });

  new MutationObserver(reflect).observe(root, { attributes: true, attributeFilter: ['class'] });
})();
