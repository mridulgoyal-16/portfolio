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
   D2 — the desktop treatment. index.html carries the class, so this only
   takes it off again for ?d=1, which keeps the old design reachable.

   All of the look lives in styles.css under .d2. The one thing CSS cannot
   do is the sizing rule: the card should be as wide as the widest heading,
   so that the blurb wraps to a second and third line inside it. A grid
   column left to size itself would instead stretch to the longest blurb and
   put each on one line, so the width is measured here and handed over.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  if (new URLSearchParams(location.search).get("d") === "1") {
    document.body.classList.remove("d2");
    return;
  }

  var work   = document.querySelector(".work");
  var titles = Array.prototype.slice.call(document.querySelectorAll(".project-title"));
  if (!work || !titles.length) return;

  function measure() {
    // Clear the width first: with it applied the headings may already be
    // wrapping, and a wrapped heading measures narrower than it wants to be.
    work.style.removeProperty("--d2-card-w");

    var widest = 0;
    titles.forEach(function (title) {
      // A Range around the text, not the element's own box. The heading is a
      // stretched flex child, so its rectangle is the card's width and tells
      // us nothing about how much room the words actually want.
      var range = document.createRange();
      range.selectNodeContents(title);
      var width = range.getBoundingClientRect().width;
      if (width > widest) widest = width;
    });
    if (!widest) return;                       // panel hidden; nothing to read

    var link  = titles[0].closest(".project-link");
    var style = getComputedStyle(link);
    var frame = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
              + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);

    work.style.setProperty("--d2-card-w", Math.ceil(widest + frame) + "px");
  }

  window.addEventListener("resize", measure);
  document.addEventListener("tabchange", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
})();


/* ---------------------------------------------------------------
   Work list on narrow screens.

   Two jobs, both only below 1100px:

   1. Each project becomes a card with its own thumbnail. Rather than a second
      copy of every image in the markup — which would download on desktop too,
      hidden or not — the very same <figure> is moved out of #preview and into
      its card, and moved back on the way up.
   2. Hover cannot pick the highlighted card on a touch screen, so scrolling
      does: whichever card is nearest the middle of the screen is the selected
      one, and the highlight walks down the list as you go.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var narrow  = window.matchMedia("(max-width: 1100px)");
  var preview = document.getElementById("preview");
  var panel   = document.getElementById("panel-work");
  var links   = Array.prototype.slice.call(document.querySelectorAll(".project-link"));
  if (!preview || !panel || !links.length) return;

  var figures = {};
  Array.prototype.forEach.call(preview.querySelectorAll(".preview-panel"), function (fig) {
    figures[fig.dataset.preview] = fig;
  });

  var current = null;
  var queued  = false;

  function place() {
    links.forEach(function (link) {
      var fig = figures[link.dataset.preview];
      if (!fig) return;
      if (narrow.matches) {
        // Ahead of the title, and only if it is not already there — moving a
        // node that is already in place would still restart image decoding.
        if (fig.parentNode !== link) link.insertBefore(fig, link.firstChild);
      } else if (fig.parentNode !== preview) {
        preview.appendChild(fig);
      }
    });
  }

  function clear() {
    if (!current) return;
    current.classList.remove("is-current");
    current = null;
  }

  function pick() {
    queued = false;

    // offsetParent is null while the Work panel is hidden, where every
    // rectangle measures zero and the first card would always win.
    if (!narrow.matches || !panel.offsetParent) return clear();

    var doc = document.documentElement;
    var best;

    // At the ends of the page the middle of the screen cannot reach the first
    // or last card — there is no room left to scroll — so they would never be
    // selectable. Hand them the highlight outright.
    if (window.scrollY <= 2) {
      best = links[0];
    } else if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
      best = links[links.length - 1];
    } else {
      var middle = window.innerHeight / 2;
      var bestDistance = Infinity;
      links.forEach(function (link) {
        var rect = link.getBoundingClientRect();
        var distance = Math.abs((rect.top + rect.bottom) / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = link;
        }
      });
    }

    if (best === current) return;
    if (current) current.classList.remove("is-current");
    if (best) best.classList.add("is-current");
    current = best;
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(pick);
  }

  function sync() {
    place();
    pick();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", sync);
  document.addEventListener("tabchange", sync);
  if (narrow.addEventListener) narrow.addEventListener("change", sync);
  else narrow.addListener(sync);          // Safari < 14

  sync();
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
