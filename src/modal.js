// Accessible modal helper (vanilla JS)
(function () {
  const FOCUSABLE = 'a[href], area[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"])';
  const modal = document.getElementById('globalModal');
  const dialog = document.getElementById('globalModalDialog');
  const titleEl = document.getElementById('globalModalTitle');
  const contentEl = document.getElementById('globalModalContent');
  const closeBtn = document.getElementById('globalModalClose');
  let lastFocused = null;

  function isNode(o) { return o && o.nodeType; }

  function openModal(title, content) {
    if (!modal || !dialog) return;
    lastFocused = document.activeElement;
    titleEl.textContent = title || '';

    // Set content safely: accept string (text) or Node
    while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild);
    if (typeof content === 'string') {
      contentEl.textContent = content;
    } else if (isNode(content)) {
      contentEl.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(item => { if (isNode(item)) contentEl.appendChild(item); });
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    // focus dialog for keyboard users
    dialog.focus();
    trapFocus();
  }

  function closeModal() {
    if (!modal || !dialog) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    releaseFocus();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function trapFocus() {
    document.addEventListener('focus', maintainFocus, true);
    document.addEventListener('keydown', handleKeydown);
  }

  function releaseFocus() {
    document.removeEventListener('focus', maintainFocus, true);
    document.removeEventListener('keydown', handleKeydown);
  }

  function maintainFocus(e) {
    if (!dialog.contains(e.target)) {
      e.stopPropagation();
      dialog.focus();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // close when clicking backdrop
  if (modal) {
    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) closeModal();
    });
  }

  // expose API
  window.openModal = openModal;
  window.closeModal = closeModal;
})();
