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
      // location.search has to be carried through by hand. Writing just
      // "#visuals" — or the bare pathname for Work — throws the query away,
      // so clicking any tab silently dropped ?d=3 and the next reload came
      // back as a different design.
      var name = tab.id.replace(/^tab-/, "");
      var url  = location.pathname + location.search + (name === "work" ? "" : "#" + name);
      history.replaceState(null, "", url);
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
   Which desktop direction to draw. index.html ships the card design, so
   the plain URL needs no script at all; the flag only moves away from it.

     (none)  cards — each project's own picture, one per row (.d3)
     ?d=1    the original — client names, travelling pill (no class)
     ?d=2    a list of headings, one thumbnail pinned alongside (.d2)
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var d = new URLSearchParams(location.search).get("d");
  if (d === "1") document.body.classList.remove("d3");
  else if (d === "2") document.body.classList.replace("d3", "d2");
})();


/* ---------------------------------------------------------------
   D2's one sizing rule. The card should be as wide as the widest heading,
   so that the blurb wraps to a second and third line inside it. A grid
   column left to size itself would instead stretch to the longest blurb and
   put each on one line, so the width is measured here and handed over.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  if (!document.body.classList.contains("d2")) return;

  var work   = document.querySelector(".work");
  var titles = Array.prototype.slice.call(document.querySelectorAll(".project-title"));
  if (!work || !titles.length) return;

  function measure() {
    var link = titles[0].closest(".project-link");

    /* Every heading is measured through one hidden probe rather than in
       place. Measuring the real headings is circular: they sit in a card
       whose width is the thing being decided, so once a title wraps it
       reports the width of its longest line and the card shrinks to fit
       that — which wraps it further. The probe is absolutely positioned
       and nowrap, so nothing can constrain it, and it sits inside a card
       so it inherits the right font. */
    var probe = document.createElement("span");
    probe.className = "project-title";
    probe.style.cssText = "position:absolute;left:-9999px;top:0;" +
                          "white-space:nowrap;width:auto;visibility:hidden;";
    link.appendChild(probe);

    var widest = 0;
    titles.forEach(function (title) {
      probe.textContent = title.textContent;
      var width = probe.getBoundingClientRect().width;
      if (width > widest) widest = width;
    });

    link.removeChild(probe);
    if (!widest) return;                       // panel hidden; nothing to read

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
   Cards.

   Two jobs:

   1. Each project becomes a card with its own thumbnail — below 1100px on
      any direction, and at every width on D3, which is that same card
      brought up to the desktop. Rather than a second copy of every image in
      the markup, which would download whether it was shown or not, the very
      same <figure> is moved out of #preview and into its card, and moved
      back when the layout no longer wants it there.
   2. Hover cannot pick the highlighted card on a touch screen, so scrolling
      does: whichever card is nearest the middle of the screen is the selected
      one, and the highlight walks down the list as you go. That part is for
      narrow screens only — on D3 the pointer does the picking.
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

  function wantsCards() {
    return narrow.matches || document.body.classList.contains("d3");
  }

  function place() {
    var inCards = wantsCards();
    links.forEach(function (link) {
      var fig = figures[link.dataset.preview];
      if (!fig) return;
      if (inCards) {
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


/* ---------------------------------------------------------------
   Work carousel.

   The row scrolls on its own — trackpad, touch, shift+wheel, keyboard. This
   only adds the two arrows and the counter, and reads the scroll position
   rather than keeping an index of its own, so a flick, a drag and a click all
   agree on which card is showing.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var row     = document.getElementById("cases");
  var readout = document.getElementById("cases-index");
  var total   = document.getElementById("cases-total");
  if (!row) return;

  var cards  = Array.prototype.slice.call(row.querySelectorAll(".case"));
  var arrows = Array.prototype.slice.call(document.querySelectorAll(".cases-arrow"));
  if (!cards.length) return;

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Counted, not typed into the markup: adding or removing a card should not
  // need the total changed in a second place.
  if (total) total.textContent = pad(cards.length);

  // Nearest card to the row's left edge wins. Comparing against the row rather
  // than the viewport means this still reads correctly while the row is being
  // dragged and no card is exactly in place.
  function currentIndex() {
    var left = row.getBoundingClientRect().left;
    var best = 0;
    var bestDistance = Infinity;
    cards.forEach(function (card, i) {
      var distance = Math.abs(card.getBoundingClientRect().left - left);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  function sync() {
    var i = currentIndex();
    if (readout) readout.textContent = pad(i + 1);

    // Measured against the real scroll extent, not the index: at the right-hand
    // end the last card is already flush and nothing more can move, even though
    // currentIndex() still reports the second-to-last card.
    var max = row.scrollWidth - row.clientWidth;
    arrows.forEach(function (arrow) {
      var forward = Number(arrow.dataset.step) > 0;
      arrow.disabled = forward ? row.scrollLeft >= max - 1 : row.scrollLeft <= 1;
    });
  }

  arrows.forEach(function (arrow) {
    arrow.addEventListener("click", function () {
      var step = Number(arrow.dataset.step) || 1;
      var next = Math.min(Math.max(currentIndex() + step, 0), cards.length - 1);
      row.scrollTo({
        left: cards[next].offsetLeft - cards[0].offsetLeft,
        behavior: "smooth"
      });
    });
  });

  var queued = false;
  row.addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; sync(); });
  }, { passive: true });

  window.addEventListener("resize", sync);
  document.addEventListener("tabchange", sync);
  sync();
})();


/* ---------------------------------------------------------------
   Comics carousel.

   One frame in view, advancing every three seconds and looping. The track
   is a plain scroller in the markup, so swipe, trackpad and keyboard already
   work; this adds the timer, the dots and mouse dragging.

   The timer holds whenever the reader is doing something — hovering, mid-drag,
   focused inside, or on another tab — and never runs at all if the system
   asks for reduced motion.
   --------------------------------------------------------------- */

(function () {
  "use strict";

  var DELAY = 3000;

  var track = document.getElementById("comics-track");
  var dotsBox = document.getElementById("comics-dots");
  if (!track) return;

  var slides = Array.prototype.slice.call(track.querySelectorAll(".comic"));
  if (slides.length < 2) return;

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  function offsetOf(i) {
    return slides[i].offsetLeft - slides[0].offsetLeft;
  }

  function currentIndex() {
    var x = track.scrollLeft;
    var best = 0;
    var bestDistance = Infinity;
    slides.forEach(function (slide, i) {
      var distance = Math.abs(offsetOf(i) - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  function goTo(i, instant) {
    track.scrollTo({
      left: offsetOf(i),
      behavior: instant || calm.matches ? "auto" : "smooth"
    });
  }

  /* Dots ------------------------------------------------------- */

  var dots = [];
  if (dotsBox) {
    // One constant, two places: the CSS reads the same number for the fill
    // animation, so the bar cannot finish early or late.
    dotsBox.style.setProperty("--comic-delay", DELAY + "ms");

    slides.forEach(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "comics-dot";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Comic " + (i + 1) + " of " + slides.length);
      dot.appendChild(document.createElement("span")).className = "comics-dot-fill";
      dot.addEventListener("click", function () {
        goTo(i);
        restart();                       // a deliberate jump resets the clock
      });
      dotsBox.appendChild(dot);
      dots.push(dot);
    });
  }

  // The fill animation starts when a dot becomes selected, but returning to a
  // dot that is ALREADY selected — a drag that lands back where it began —
  // changes nothing in the CSS, so the bar would keep its old progress. This
  // takes the animation off and forces a reflow before putting it back.
  function rewind(dot) {
    if (!dot) return;
    var fill = dot.firstChild;
    if (!fill) return;
    fill.style.animation = "none";
    void fill.offsetWidth;
    fill.style.animation = "";
  }

  var shown = -1;
  function paint() {
    var i = currentIndex();
    if (i === shown) return;
    shown = i;
    dots.forEach(function (dot, n) {
      dot.setAttribute("aria-selected", n === i ? "true" : "false");
    });
    rewind(dots[i]);
  }

  var queued = false;
  track.addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; paint(); });
  }, { passive: true });

  /* The timer -------------------------------------------------- */

  var timer = null;
  var held = 0;                          // reasons to stay put, not a boolean:
                                         // hover and focus can overlap, and a
                                         // single flag would let whichever
                                         // ended first restart the timer.

  function tick() {
    // The wrap from the last frame back to the first is instant. Animating it
    // rewinds the whole row, which reads as a glitch rather than a step.
    var next = currentIndex() + 1;
    if (next >= slides.length) goTo(0, true);
    else goTo(next);
  }

  function paused(is) {
    if (dotsBox) dotsBox.classList.toggle("is-paused", is);
  }

  function run() {
    if (timer) return;
    // Bail with the bar parked, not running: a tab opened in the background
    // would otherwise animate a countdown that no timer is keeping.
    if (held || calm.matches || document.hidden) { paused(true); return; }
    timer = setInterval(tick, DELAY);
    paused(false);
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    paused(true);
  }

  function hold()    { held++; stop(); }
  function release() { held = Math.max(0, held - 1); run(); }

  // A deliberate jump — a dot click, or letting go of a drag — restarts both
  // the clock and the bar, so the reader gets a full interval on what they
  // just chose rather than the tail of the last one.
  function restart() {
    stop();
    rewind(dots[currentIndex()]);
    run();
  }

  track.addEventListener("mouseenter", hold);
  track.addEventListener("mouseleave", release);
  track.addEventListener("focusin", hold);
  track.addEventListener("focusout", release);
  if (dotsBox) {
    dotsBox.addEventListener("mouseenter", hold);
    dotsBox.addEventListener("mouseleave", release);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else run();
  });
  if (calm.addEventListener) calm.addEventListener("change", function () {
    if (calm.matches) stop(); else run();
  });

  /* Drag ------------------------------------------------------- */

  var dragging = false;
  var startX = 0;
  var startScroll = 0;
  var moved = 0;

  track.addEventListener("pointerdown", function (event) {
    // Touch and trackpad already scroll this natively; hijacking them would
    // fight the browser's own momentum.
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragging = true;
    moved = 0;
    startX = event.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("is-dragging");
    track.setPointerCapture(event.pointerId);
    hold();
  });

  track.addEventListener("pointermove", function (event) {
    if (!dragging) return;
    var dx = event.clientX - startX;
    moved = Math.abs(dx);
    track.scrollLeft = startScroll - dx;
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("is-dragging");
    if (track.hasPointerCapture && track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    // Snap by hand: scroll-snap is off during the drag, so nothing else will.
    goTo(currentIndex());
    release();
    // Back to a full interval on whatever they landed on. paint() cannot do
    // this when the drag ends on the slide it started from — the index never
    // changed, so nothing there fires.
    rewind(dots[currentIndex()]);
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  // A drag that travelled is not a click. Without this, letting go over a
  // comic that later becomes a link would follow it.
  track.addEventListener("click", function (event) {
    if (moved > 5) { event.preventDefault(); event.stopPropagation(); }
  }, true);

  paint();
  run();
})();
