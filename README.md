# mysite

My personal site. Plain HTML and one CSS file. No JavaScript, no build step,
no dependencies.

Live at https://faizanxmd.github.io/ — pushing to `main` publishes it.
What's on disk is what ships.

## Files

- `index.html` — the homepage. Name, links, and two lists.
- `style.css` — the only stylesheet, shared by every page.
- `articles/` — one HTML file per piece of writing.
- `assets/` — favicon and images.

## How to change things

**Add a link:** open `index.html`, copy an `<li>` line, change the URL and text.

**Add an article:** copy `articles/us-election.html` to a new name, replace the
title and the text, then add an `<li>` for it under Writing in `index.html`.

**Change how it looks:** everything is in `style.css`. It's short — read it.

## Preview before pushing

```
python3 -m http.server 4173
```

Then open http://localhost:4173.

## The rule

Keep it simple enough that I can read and edit every line myself. If a change
needs a framework, a build tool, or a config file, it's the wrong change.
