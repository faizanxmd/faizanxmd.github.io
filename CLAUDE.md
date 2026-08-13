# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Faizan's personal site. **Deliberately tiny**: plain HTML and one CSS file, no JavaScript,
no build step, no dependencies. Deployed on Vercel as static files — what's on disk is
what ships.

The owner is a novice programmer. Every change must keep the code simple enough
for them to read and edit unassisted. Small amounts of JavaScript are acceptable
only if the code is explained to the owner well enough that they understand and
can edit it themselves. No frameworks, build tools, data files, or clever
abstractions.

## Layout

- `index.html` — the whole site: name, a one-line tagline with the social links
  and email, and plain `<ul>` lists (Writing, Good links). Adding an entry =
  copying an `<li>` line.
- `style.css` — the only stylesheet, shared by every page. One theme only, a
  warm Solarized-style light palette. No dark mode — the owner removed it
  deliberately; do not add it back.
- `articles/*.html` — long-form pieces. Each is a standalone page that links
  `../style.css` and starts with a `← back` link. To add one, copy
  `articles/us-election.html` and add an `<li>` under Writing in `index.html`.
- `assets/` — favicon and photos only.

## Commands

- **Preview locally:** `python3 -m http.server 4173` from the repo root, then open
  `http://localhost:4173`.
- No lint, build, or test pipeline.
