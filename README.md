# Portfolio

Personal portfolio — plain HTML, CSS and JavaScript. No build step, no
dependencies: open `index.html`, or serve the folder statically.

Live at https://mridulgoyal-16.github.io/portfolio/

## Structure

- `index.html` — the whole page. Three tab panels: Work, Visuals, Hello.
- `styles.css` — all styling. Desktop-first; breakpoints at 1300, 1100 and 600px.
- `script.js` — three small scripts: the tabs, the Work hover preview, and the
  Visuals masonry (measures image heights and turns them into grid row spans).
- `assets/` — images actually served by the site. Source art lives outside the
  repo; see `.gitignore`.

## Editing

`index.html` links `styles.css` and `script.js` with a `?v=N` cache buster.
**Bump both numbers whenever you edit either file**, or returning visitors get
new HTML with an old stylesheet.

## Local preview

Any static server works, e.g.

    python3 -m http.server 4321

then open http://localhost:4321
