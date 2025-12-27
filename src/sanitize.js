// DOM Sanitization Helper
(function() {
  // Load DOMPurify if available, fallback to basic text escaping
  let DOMPurify = window.DOMPurify;
  if (!DOMPurify) {
    console.warn('DOMPurify not loaded, using basic text escaping');
    DOMPurify = {
      sanitize: function(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/[&<>"']/g, function(match) {
          const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;'
          };
          return map[match];
        });
      }
    };
  }

  // Safe DOM rendering utilities
  window.safeRender = {
    // Render list of items using DOM creation
    renderList: function(container, items, itemTemplateFn) {
      if (!container) return;
      // Clear safely
      while (container.firstChild) container.removeChild(container.firstChild);

      if (!items || items.length === 0) return;

      items.forEach(item => {
        const element = itemTemplateFn(item);
        if (element) container.appendChild(element);
      });
    },

    // Safe innerHTML with sanitization
    setInnerHTML: function(element, html) {
      if (!element) return;
      element.innerHTML = DOMPurify.sanitize(html);
    },

    // Create element with text content
    createTextElement: function(tagName, text, className) {
      const el = document.createElement(tagName);
      if (className) el.className = className;
      el.textContent = text;
      return el;
    },

    // Create element with HTML content (sanitized)
    createHTMLElement: function(tagName, html, className) {
      const el = document.createElement(tagName);
      if (className) el.className = className;
      this.setInnerHTML(el, html);
      return el;
    }
  };
})();
