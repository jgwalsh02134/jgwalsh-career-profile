/* Global navigation interactions with accessible mobile menu focus trapping */
(function () {
  const focusableSelector = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const getFocusable = (panel) => {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(focusableSelector)).filter((node) => !node.hasAttribute('disabled'));
  };

  const closeMenu = (container, panel, toggle, lastFocus) => {
    if (!panel || !toggle) return;
    panel.classList.add('hidden');
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    container?.classList.remove('is-nav-open');
    document.body.classList.remove('overflow-hidden');
    requestAnimationFrame(() => {
      (lastFocus && typeof lastFocus.focus === 'function') ? lastFocus.focus() : toggle.focus();
    });
  };

  const bindMenu = (container) => {
    const toggle = container?.querySelector('[data-menu-toggle]');
    if (!toggle) return;

    const panelId = toggle.getAttribute('aria-controls');
    const panel = container.querySelector(`#${panelId}`) || document.getElementById(panelId);
    if (!panel) return;

    panel.classList.add('hidden');
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-expanded', 'false');

    let lastFocus = null;

    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable(panel);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(container, panel, toggle, lastFocus);
      }
    };

    const handleClickOutside = (event) => {
      if (!container.contains(event.target)) {
        closeMenu(container, panel, toggle, lastFocus);
      }
    };

    const openMenu = () => {
      lastFocus = document.activeElement;
      panel.classList.remove('hidden');
      panel.removeAttribute('hidden');
      container.classList.add('is-nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      panel.setAttribute('aria-expanded', 'true');
      document.body.classList.add('overflow-hidden');
      const focusable = getFocusable(panel);
      if (focusable.length) {
        requestAnimationFrame(() => focusable[0].focus());
      }
      panel.addEventListener('keydown', trapFocus);
      document.addEventListener('keydown', handleEscape, { once: true });
      document.addEventListener('click', handleClickOutside, { once: true, capture: true });
    };

    const toggleMenu = () => {
      const isHidden = panel.classList.contains('hidden');
      if (isHidden) {
        openMenu();
      } else {
        closeMenu(container, panel, toggle, lastFocus);
      }
    };

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      toggleMenu();
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(container, panel, toggle, lastFocus);
      }
    });

    panel.addEventListener('transitionend', () => {
      if (!panel.classList.contains('hidden')) {
        panel.removeAttribute('hidden');
      }
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('[data-mobile-menu-container]');
    containers.forEach(bindMenu);
  });
})();
