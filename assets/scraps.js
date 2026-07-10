// ─────────────────────────────────────────────────────────────────────────
// SCRAPS RENDERER — turns the SCRAPS data (from scraps-data.js) into cards.
//
// The page's HTML just has an empty <div id="scraps-desk">. This script fills
// it in: for every scrap in the list, it builds one card and drops it in.
// ─────────────────────────────────────────────────────────────────────────

// The "messy pile" look. Instead of hand-tilting each card by position
// (the old, brittle way), we cycle through these wobble values by index — so
// ANY number of scraps gets a natural-looking tilt automatically.
const TILTS  = [-2.1, 2.4, 1.1, -1.8, 0.8, -2.6, 1.6, -0.9, 2.0, -1.4]; // degrees
const NUDGES = ["0.5rem", "3rem", "0rem", "-1.2rem", "0.5rem",          // vertical
                "2.2rem", "-0.9rem", "0rem", "0.9rem", "3rem"];          // scatter

// Build one card (a DOM element) from one scrap record.
function buildScrap(scrap, index) {
  const card = document.createElement("article");

  // Base class + one "scrap--name" class for each style in the list.
  card.className = "scrap";
  (scrap.style || []).forEach(function (name) {
    card.classList.add("scrap--" + name);
  });

  // A full-row card: "center" or "right".
  if (scrap.layout === "center") card.classList.add("scrap--wide", "scrap--wide-center");
  if (scrap.layout === "right")  card.classList.add("scrap--wide", "scrap--wide-right");

  // Feed this card its tilt + vertical nudge via CSS variables. (We use
  // variables, not a direct transform, so the hover-straighten effect in the
  // CSS can still override it.)
  card.style.setProperty("--tilt", TILTS[index % TILTS.length] + "deg");
  card.style.setProperty("--nudge", NUDGES[index % NUDGES.length]);

  // The little tag chip (skip it if the scrap has no tag).
  if (scrap.tag) {
    const tag = document.createElement("span");
    tag.className = "scrap-tag";
    tag.textContent = scrap.tag;
    card.appendChild(tag);
  }

  // The title. If there's a link, it's a clickable <a>; otherwise plain <p>.
  const title = document.createElement(scrap.link ? "a" : "p");
  title.className = "scrap-title";
  title.textContent = scrap.title;
  if (scrap.link) title.href = scrap.link;
  card.appendChild(title);

  // The optional italic note underneath.
  if (scrap.note) {
    const note = document.createElement("p");
    note.className = "scrap-note";
    note.textContent = scrap.note;
    card.appendChild(note);
  }

  // The optional faint secondary link (e.g. "wiki →").
  if (scrap.ghost) {
    const ghost = document.createElement("a");
    ghost.className = "scrap-ghost-link";
    ghost.textContent = scrap.ghost.text;
    ghost.href = scrap.ghost.link;
    card.appendChild(ghost);
  }

  return card;
}

// Fill the desk: build every scrap and add it to the page.
function renderScraps() {
  const desk = document.getElementById("scraps-desk");
  if (!desk) return;               // safety: do nothing if the desk isn't here
  desk.innerHTML = "";             // start empty
  SCRAPS.forEach(function (scrap, index) {
    desk.appendChild(buildScrap(scrap, index));
  });
}

renderScraps();
