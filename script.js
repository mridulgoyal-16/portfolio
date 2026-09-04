/* ---------------------------------------------------------------
   Hover interaction for the Work list.

   Two coupled pieces, both modelled on nelson.co:

   1. A single highlight element ("the pill") that TRAVELS between
      projects rather than each card owning its own hover state. It
      leans into the direction of travel and settles flat.
   2. A preview pinned to the right of the list. It does not follow
      the cursor — only its contents change, via a fade + blur.

   Nothing is shown at rest.
   --------------------------------------------------------------- */

/* ---------------------------------------------------------------
   Tabs. Work and Hello are populated; Visuals is still an empty
   "Coming soon" panel. The selected tab is mirrored into the URL hash so
   a panel can be linked to and survives a reload.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.nav-item[role="tab"]'));
  if (!tabs.length) return;

  function panelFor(tab) {
    return document.getElementById(tab.getAttribute("aria-controls"));
  }

  function select(tab, updateHash) {
    tabs.forEach(function (other) {
      var isSelected = other === tab;
      var panel = panelFor(other);
      other.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (panel) panel.hidden = !isSelected;
    });

    if (updateHash) {
      var name = tab.id.replace(/^tab-/, "");
      history.replaceState(null, "", name === "work" ? location.pathname : "#" + name);
    }

    // Leaving Work with a project hovered would strand the highlight.
    document.dispatchEvent(new CustomEvent("tabchange"));
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () { select(tab, true); });
  });

  // Left/right arrows move between tabs, as expected of a tablist.
  document.querySelector(".nav").addEventListener("keydown", function (event) {
    var i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    var next = event.key === "ArrowRight" ? i + 1
             : event.key === "ArrowLeft"  ? i - 1
             : -1;
    if (next === -1) return;
    event.preventDefault();
    var target = tabs[(next + tabs.length) % tabs.length];
    target.focus();
    select(target, true);
  });

  var fromHash = document.getElementById("tab-" + location.hash.replace(/^#/, ""));
  select(fromHash || tabs[0], false);
})();


(function () {
  "use strict";

  var work    = document.querySelector(".work");
  var glass   = document.getElementById("glass");
  var preview = document.getElementById("preview");
  var list    = document.getElementById("projects");
  if (!work || !glass || !preview || !list) return;

  var links = Array.prototype.slice.call(document.querySelectorAll(".project-link"));

  var panels = {};
  Array.prototype.forEach.call(preview.querySelectorAll(".preview-panel"), function (panel) {
    panels[panel.dataset.preview] = panel;
  });

  var PERSPECTIVE = 900;   // px, for the travel tilt
  var TILT_PER_PX = 0.03;  // degrees of lean per px travelled
  var TILT_MAX    = 5;     // degrees
  var TILT_SETTLE = 130;   // ms before the lean relaxes to flat

  var activeLink = null;
  var lastY      = null;   // previous pill top, for travel direction
  var settleTimer;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function transform(x, y, tilt) {
    return "perspective(" + PERSPECTIVE + "px) translate3d(" + x + "px, " + y + "px, 0) rotateX(" + tilt + "deg)";
  }

  function moveGlassTo(link) {
    var workRect = work.getBoundingClientRect();
    var rect     = link.getBoundingClientRect();
    var x = rect.left - workRect.left;
    var y = rect.top  - workRect.top;

    // First appearance: land in place instead of flying in from the origin.
    var isFirstPlacement = lastY === null;
    if (isFirstPlacement) glass.classList.add("is-placing");

    var tilt = isFirstPlacement ? 0 : clamp((y - lastY) * TILT_PER_PX, -TILT_MAX, TILT_MAX);

    glass.style.width     = rect.width + "px";
    glass.style.height    = rect.height + "px";
    glass.style.transform = transform(x, y, -tilt);

    if (isFirstPlacement) {
      void glass.offsetWidth;               // flush, so the next move animates
      glass.classList.remove("is-placing");
    }

    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      glass.style.transform = transform(x, y, 0);
    }, TILT_SETTLE);

    lastY = y;
    glass.classList.add("is-visible");
  }

  function showPanel(key) {
    Object.keys(panels).forEach(function (k) {
      panels[k].classList.toggle("is-active", k === key);
    });
    preview.setAttribute("aria-hidden", "false");
  }

  function clearPanels() {
    Object.keys(panels).forEach(function (k) {
      panels[k].classList.remove("is-active");
    });
    preview.setAttribute("aria-hidden", "true");
  }

  function activate(link) {
    if (link === activeLink) return;
    activeLink = link;
    moveGlassTo(link);
    showPanel(link.dataset.preview);
  }

  function deactivate() {
    activeLink = null;
    lastY = null;
    glass.classList.remove("is-visible");
    clearPanels();
  }

  links.forEach(function (link) {
    link.addEventListener("pointerenter", function () { activate(link); });
    link.addEventListener("focus",        function () { activate(link); });
  });

  // Cleared on leaving the whole section, not the list. The list is only as
  // wide as its widest card, so a diagonal mouse path between two projects
  // can clip outside it — watching the list alone makes the pill flicker.
  work.addEventListener("pointerleave", deactivate);
  work.addEventListener("focusout", function (event) {
    if (!work.contains(event.relatedTarget)) deactivate();
  });

  // Switching tabs hides the list mid-hover, so no pointerleave ever
  // fires — clear the highlight and preview by hand.
  document.addEventListener("tabchange", deactivate);

  window.addEventListener("resize", function () {
    if (!activeLink) return;
    lastY = null;              // moveGlassTo reads this as a first placement,
    moveGlassTo(activeLink);   // so it re-seats without animating or leaning
  });
})();


/* ---------------------------------------------------------------
   Visuals masonry.

   CSS grid can span an image across two columns but cannot pack items of
   different heights; CSS multicol can pack them but only spans "all" columns.
   So: grid for the layout, and this to close the gap — each image's measured
   height becomes a grid-row span. Rows are 1px with no row gap, so a span of
   N is exactly N pixels, and the 36px rhythm is the image's own margin.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var grid = document.querySelector(".visuals-grid");
  if (!grid) return;

  var images = Array.prototype.slice.call(grid.querySelectorAll("img"));

  function layout() {
    // The panel starts hidden, where everything measures zero. offsetParent
    // is null until it is actually shown, so bail rather than write junk.
    if (!grid.offsetParent) return;

    var styles = getComputedStyle(grid);
    var rowHeight = parseFloat(styles.gridAutoRows) || 1;

    images.forEach(function (img) {
      var gap = parseFloat(getComputedStyle(img).marginBottom) || 0;
      var height = img.getBoundingClientRect().height;
      if (!height) return;               // not laid out yet; the load handler retries
      img.style.gridRowEnd = "span " + Math.max(1, Math.ceil((height + gap) / rowHeight));
    });
  }

  images.forEach(function (img) {
    if (!img.complete) img.addEventListener("load", layout);
  });

  window.addEventListener("resize", layout);
  document.addEventListener("tabchange", layout);   // fires once the panel is visible
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
})();
