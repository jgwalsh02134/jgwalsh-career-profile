/* Navigation disclosure toggle */
(function () {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;

  const btn = doc.getElementById('nav-toggle');
  const nav = doc.getElementById('primary-nav');
  if (!btn || !nav) return;

  const win = typeof window !== 'undefined' ? window : null;
  const mq = win && typeof win.matchMedia === 'function'
    ? win.matchMedia('(min-width: 768px)')
    : null;
  const isDesktop = () => mq ? mq.matches : false;

  let lastFocus = null;
  let backdrop = null;
  let ignoreClick = false;

  const firstFocusable = () => nav.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
  const handleBackdropClick = () => closeNav();

  function addBackdrop() {
    if (isDesktop() || backdrop) return;
    backdrop = doc.createElement('div');
    backdrop.className = 'fixed inset-0 z-40 bg-black/30';
    backdrop.setAttribute('data-backdrop', '');
    backdrop.addEventListener('click', handleBackdropClick, { passive: true });
    doc.body.appendChild(backdrop);
  }

  function removeBackdrop() {
    if (!backdrop) return;
    backdrop.removeEventListener('click', handleBackdropClick);
    backdrop.remove();
    backdrop = null;
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closeNav();
    }
  }

  function openNav() {
    if (isDesktop()) return;
    lastFocus = doc.activeElement;
    nav.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    doc.body.classList.add('overflow-hidden');
    const el = firstFocusable();
    if (el && typeof el.focus === 'function') el.focus();
    doc.addEventListener('keydown', onKeydown);
    addBackdrop();
  }

  function closeNav(options = {}) {
    const { focus = true, keepVisible = false } = options;
    nav.hidden = !keepVisible;
    btn.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('overflow-hidden');
    doc.removeEventListener('keydown', onKeydown);
    removeBackdrop();
    if (focus) {
      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      } else {
        btn.focus();
      }
    }
    lastFocus = null;
  }

  function toggle() {
    if (isDesktop()) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    expanded ? closeNav() : openNav();
  }

  btn.setAttribute('aria-expanded', 'false');

  btn.addEventListener('pointerup', (event) => {
    const type = typeof event.pointerType === 'string' ? event.pointerType : 'mouse';
    if (type === 'mouse') return;
    ignoreClick = true;
    toggle();
    if (win && typeof win.setTimeout === 'function') {
      win.setTimeout(() => { ignoreClick = false; }, 0);
    }
  });

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    toggle();
  });

  nav.addEventListener('click', (event) => {
    if (btn.getAttribute('aria-expanded') !== 'true') return;
    const target = event.target.closest('a,button');
    if (!target) return;
    closeNav();
  }, { capture: true });

  const header = btn.closest('header');
  if (header && getComputedStyle(header).overflow !== 'visible') {
    header.style.overflow = 'visible';
  }

  function syncNav(context) {
    const matches = context?.matches ?? isDesktop();
    if (matches) {
      closeNav({ focus: false, keepVisible: true });
    } else if (btn.getAttribute('aria-expanded') !== 'true') {
      nav.hidden = true;
    }
  }

  if (!isDesktop()) {
    nav.hidden = true;
  }

  if (mq) {
    syncNav(mq);
    const listener = (event) => syncNav(event);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', listener);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(listener);
    }
  } else {
    nav.hidden = false;
  }
})();
