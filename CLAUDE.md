# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static personal site — plain HTML, CSS, and JS with **no build step, no framework, no
dependencies**. Deployed on Vercel as static files (`.vercel/project.json` has
`framework: null` and no build/install command). Edit the files, and what's on disk is
what ships.

## Commands

- **Preview locally:** `python3 -m http.server 4173` from the repo root, then open
  `http://localhost:4173`.
- There is **no lint, build, or test pipeline** for the site — pages are hand-authored.

## Architecture

**Page model.** Each top-level `*.html` (`index`, `writing`, `scraps`, `workbench`,
`about`) is a standalone document that hand-repeats the same `<head>`: it loads
`assets/theme.js` (in `<head>`, before anything else), the Courier Prime font,
`assets/style.css`, and the favicon. A per-page `<body class="…">` (e.g. `home`,
`scraps-page`) is the hook that page-specific CSS keys off of. Long-form pieces live in
`articles/`, start from `articles/_template.html`, and use `assets/article.css`. When you
add a page, replicate that `<head>` and add it to the nav in `index.html`.

**Theming.** `assets/theme.js` runs before first paint to set `html.dark-mode`, which is
what prevents a light-to-dark flash — this is why it must stay a blocking script in
`<head>` (moving it to `defer`/end-of-body brings the flash back). All design values are
CSS custom properties: a `:root` block with a `html.dark-mode` override block in
`assets/style.css` (colors, a `--space-*` scale, `--container`). The active scheme is
persisted in `localStorage['color-scheme']`; the backtick `` ` `` key cycles
OS → dark → light; `window.__applyScheme` is the shared re-apply hook. (The other keyboard
hook on the site is the scraps filter, below — `l/r/w/s/n` and Escape. Both listen on
`document` and neither stops propagation, so they coexist.)

**Scraps.** A dated log, not a scrapbook. `scraps.html` ships an empty
`<div id="scraps-log">`; `assets/scraps.js` sorts the `SCRAPS` array from
`assets/scraps-data.js` newest-first, groups it into months, and renders it. **Every visual
difference between two rows comes from their data** — there is deliberately no per-entry
styling field. Don't reintroduce one.

Schema: `kind` (required — `listen`/`read`/`watch`/`signal`/`note`, defined once in `KINDS`
in `scraps.js`), `title` (required), and optional `date`, `link`, `note`. A `date` is
`"YYYY-MM-DD"`, or `"YYYY-MM"` when only the month is known, or **the key is left out
entirely** when it isn't known — absence is the encoding, never `""` or `null`. Unknown days
print `--`; undated entries collect in a trailing group. Dates are parsed by regex, never
`new Date()`, which would shift months in non-UTC timezones. Repeated dates blank the visible
day but keep the full date for screen readers.

Hidden interaction: `l/r/w/s/n` filters by kind (same key toggles off), Escape clears, and
the state is mirrored in the URL as `#kind=read`. The visible filter legend is built only
from kinds actually present in the data.

`editor.html` is a local-only GUI for the data (reached via the `>` before "Built in
Mathikere" in the scraps footer, not the nav). It reuses `renderLogInto()` for a live
preview, and writes `scraps-data.js` via the File System Access API in Chrome/Edge, or falls
back to a download you move into `assets/` yourself.

**Home page.** `index.html` has an inline typewriter animation for the site title
(`<h1 id="site-name">`), which uses the `.cursor` / `@keyframes blink` styles.

## Notes

- Claude plans and executes changes directly in this repo — no delegation harness.
- `tools/orchestrator/` is an old delegated-execution experiment that is **no longer
  wired into the workflow**; leave it be (it can be deleted later). Ignore its README and
  prompts when doing work here.
