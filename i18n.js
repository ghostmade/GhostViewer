// i18n.js — tiny DOM bootstrap that applies chrome.i18n.getMessage() to elements
// declaring data-i18n / data-i18n-attr / data-i18n-placeholder / data-i18n-title.
//
// Used by both popup.html and player.html. The script is intentionally
// dependency-free and synchronous so translated text is in place before paint.

(function () {
  function t(key) {
    if (!key) return "";
    const msg = chrome.i18n.getMessage(key);
    return msg || key;   // fall back to the key itself so missing translations are visible
  }

  function applyTo(root) {
    // Plain text content
    for (const el of root.querySelectorAll("[data-i18n]")) {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    }
    // title="" attribute
    for (const el of root.querySelectorAll("[data-i18n-title]")) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    }
    // placeholder="" attribute (inputs)
    for (const el of root.querySelectorAll("[data-i18n-placeholder]")) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    }
    // aria-label="" attribute (icon-only buttons)
    for (const el of root.querySelectorAll("[data-i18n-aria-label]")) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    }
  }

  // Expose a tiny global so JS code can format messages with placeholders.
  // Usage: gvI18n("playerErrLoad", "Network error")
  window.gvI18n = function (key, ...args) {
    if (!args.length) return t(key);
    return chrome.i18n.getMessage(key, args.map(String)) || key;
  };

  // Apply immediately and synchronously. We rely on this script being placed
  // at the end of <body> in popup.html and player.html — by the time the
  // script tag is reached, all data-i18n elements already exist in the DOM.
  //
  // Doing this here (instead of waiting for DOMContentLoaded) is critical:
  // player.js / popup.js run AFTER i18n.js and set dynamic text on some of
  // the same elements (e.g. #channel-name → actual channel name). If we
  // deferred to DCL, the i18n bootstrap would fire AFTER those assignments
  // and overwrite them with the static fallback strings.
  applyTo(document);
})();
