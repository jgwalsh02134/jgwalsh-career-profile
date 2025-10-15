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

  const closeMenu = (container, panel, toggle, backdrop, lastFocus, handlers) => {
    if (!panel || !toggle) return;

    panel.classList.add('hidden');
    panel.setAttribute('hidden', '');
    panel.dataset.state = 'closed';
    panel.setAttribute('aria-expanded', 'false');

    toggle.setAttribute('aria-expanded', 'false');
    toggle.dataset.state = 'closed';

    container?.classList.remove('is-nav-open');
    document.body.classList.remove('overflow-hidden');

    if (backdrop) {
      backdrop.classList.add('hidden');
      backdrop.setAttribute('hidden', '');
    }

    panel.removeEventListener('keydown', handlers.trapFocus);
    document.removeEventListener('keydown', handlers.handleEscape, true);

    if (backdrop) {
      backdrop.removeEventListener('click', handlers.handleBackdropClick, true);
    }

    requestAnimationFrame(() => {
      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      } else {
        toggle.focus();
      }
    });
  };

  const bindMenu = (container) => {
    const toggle = container?.querySelector('[data-menu-toggle]');
    if (!toggle) return;

    const panelId = toggle.getAttribute('aria-controls');
    const panel = container.querySelector(`#${panelId}`) || document.getElementById(panelId);
    if (!panel) return;

    let backdrop = container.querySelector('[data-menu-backdrop]');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.setAttribute('data-menu-backdrop', '');
      backdrop.className = 'mobile-menu-backdrop hidden';
      backdrop.setAttribute('hidden', '');
      container.appendChild(backdrop);
    }

    panel.classList.add('hidden');
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-expanded', 'false');
    panel.dataset.state = 'closed';
    toggle.dataset.state = 'closed';

    let lastFocus = null;

    const handlers = {
      trapFocus: null,
      handleEscape: null,
      handleBackdropClick: null,
    };

    handlers.trapFocus = (event) => {
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

    handlers.handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(container, panel, toggle, backdrop, lastFocus, handlers);
      }
    };

    handlers.handleBackdropClick = (event) => {
      if (event.target === backdrop) {
        event.preventDefault();
        closeMenu(container, panel, toggle, backdrop, lastFocus, handlers);
      }
    };

    const openMenu = () => {
      lastFocus = document.activeElement;
      panel.classList.remove('hidden');
      panel.removeAttribute('hidden');
      panel.dataset.state = 'open';
      container.classList.add('is-nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.dataset.state = 'open';
      panel.setAttribute('aria-expanded', 'true');
      document.body.classList.add('overflow-hidden');
      const focusable = getFocusable(panel);
      if (focusable.length) {
        requestAnimationFrame(() => focusable[0].focus());
      }
      panel.addEventListener('keydown', handlers.trapFocus);
      document.addEventListener('keydown', handlers.handleEscape, true);
      if (backdrop) {
        backdrop.classList.remove('hidden');
        backdrop.removeAttribute('hidden');
        backdrop.addEventListener('click', handlers.handleBackdropClick, true);
      }
    };

    const toggleMenu = () => {
      const isHidden = panel.classList.contains('hidden');
      if (isHidden) {
        openMenu();
      } else {
        closeMenu(container, panel, toggle, backdrop, lastFocus, handlers);
      }
    };

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      toggleMenu();
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        toggleMenu();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(container, panel, toggle, backdrop, lastFocus, handlers);
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
