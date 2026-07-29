// ─────────────────────────────────────────────────────────────────────────
// SCRAPS RENDERER — turns the SCRAPS data (from scraps-data.js) into a log.
//
// The page's HTML has an empty <div id="scraps-log">. This script sorts the
// entries newest-first, groups them by month, and fills it in. Everything you
// see is derived from the data — there is no per-entry styling field, on
// purpose. If two rows look different, it's because their data differs.
//
// Hidden feature: press l / r / w / s / n to filter by kind, Escape to clear.
// ─────────────────────────────────────────────────────────────────────────

// The whole vocabulary, in one place. editor.html imports this to build its
// dropdown, so the two files can't drift apart.
const KINDS = [
    { key: "listen", hotkey: "l" },
    { key: "read", hotkey: "r" },
    { key: "watch", hotkey: "w" },
    { key: "signal", hotkey: "s" },
    { key: "note", hotkey: "n" },
];

const KIND_KEYS = KINDS.map(function (k) { return k.key; });

const HOTKEY_MAP = KINDS.reduce(function (map, k) {
    map[k.hotkey] = k.key;
    return map;
}, {});

const MONTH_NAMES = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
];

// ── dates ────────────────────────────────────────────────────────────────

// Pull a date apart by hand instead of using new Date(). Parsing "2026-01"
// with Date() treats it as UTC midnight, which lands on the previous day for
// anyone west of Greenwich — entries would silently file into the wrong month.
function parseDate(entry) {
    const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(entry.date || "");
    if (!match) return { ym: null, day: null, sortKey: null };

    const ym = match[1] + "-" + match[2];
    const day = match[3] || null;
    // A month-only entry sorts as day "00" so it trails the days we do know.
    return { ym: ym, day: day, sortKey: ym + "-" + (day || "00") };
}

function monthLabel(ym) {
    const parts = ym.split("-");
    return MONTH_NAMES[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

// "23 january 2026" — what a screen reader hears, spelled out in full.
function spokenDate(ym, day) {
    if (!ym) return "no date recorded";
    if (!day) return "day not recorded, " + monthLabel(ym);
    return parseInt(day, 10) + " " + monthLabel(ym);
}

// ── shaping the data ─────────────────────────────────────────────────────

// A typo in the data file shouldn't produce an unstyled, unfilterable row.
function normalizeKind(kind) {
    return KIND_KEYS.indexOf(kind) === -1 ? "signal" : kind;
}

function sortEntries(list) {
    const dated = [];
    const undated = [];

    list.forEach(function (entry) {
        const parsed = parseDate(entry);
        (parsed.sortKey ? dated : undated).push({ entry: entry, parsed: parsed });
    });

    // Array.prototype.sort is stable, so entries sharing a date keep the order
    // they appear in the data file.
    dated.sort(function (a, b) {
        return a.parsed.sortKey < b.parsed.sortKey ? 1 : a.parsed.sortKey > b.parsed.sortKey ? -1 : 0;
    });

    return dated.concat(undated);
}

function groupByMonth(sorted) {
    const groups = [];
    let current = null;

    sorted.forEach(function (row) {
        const ym = row.parsed.ym;
        if (!current || current.ym !== ym) {
            current = {
                ym: ym,
                label: ym ? monthLabel(ym) : "undated",
                rows: [],
            };
            groups.push(current);
        }
        current.rows.push(row);
    });

    return groups;
}

// ── building the DOM ─────────────────────────────────────────────────────

// One row. `prevDateStr` is the raw date string of the row before it — when
// they match we blank the visible day, the way a ledger doesn't reprint the
// same date down a column. This is cosmetic only: the spoken date below is
// always complete, so nothing is lost to a screen reader.
function buildRow(entry, prevDateStr) {
    const row = document.createElement("li");
    row.className = "log-row";

    const parsed = parseDate(entry);
    const repeated = Boolean(entry.date) && entry.date === prevDateStr;

    // A <time> only when there's a real date to put in datetime=".
    const day = document.createElement(parsed.ym ? "time" : "span");
    day.className = "log-day";
    if (parsed.ym) day.setAttribute("datetime", entry.date);

    const dayVisible = document.createElement("span");
    dayVisible.setAttribute("aria-hidden", "true");
    dayVisible.textContent = repeated ? "" : parsed.day ? parsed.day : "--";
    day.appendChild(dayVisible);

    const daySpoken = document.createElement("span");
    daySpoken.className = "sr-only";
    daySpoken.textContent = spokenDate(parsed.ym, parsed.day);
    day.appendChild(daySpoken);

    row.appendChild(day);

    const kind = document.createElement("span");
    kind.className = "log-kind";
    kind.textContent = normalizeKind(entry.kind);
    row.appendChild(kind);

    const title = document.createElement(entry.link ? "a" : "span");
    title.className = "log-title";
    title.textContent = entry.title;
    if (entry.link) title.href = entry.link;
    row.appendChild(title);

    if (entry.note) {
        const note = document.createElement("p");
        note.className = "log-note";
        note.textContent = entry.note;
        row.appendChild(note);
    }

    return row;
}

function buildMonth(group, index) {
    const section = document.createElement("section");
    section.className = "log-month";

    const headingId = "log-m-" + (group.ym || "undated") + "-" + index;

    const heading = document.createElement("h2");
    heading.className = "log-month-head";
    heading.id = headingId;
    heading.textContent = group.label;
    section.setAttribute("aria-labelledby", headingId);
    section.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "log-rows";

    let prevDateStr = null;
    group.rows.forEach(function (row) {
        list.appendChild(buildRow(row.entry, prevDateStr));
        prevDateStr = row.entry.date || null;
    });

    section.appendChild(list);
    return section;
}

// Render the whole log into a container. Exported so editor.html can preview
// the real thing — grouped, sorted, day-repeats suppressed — instead of a
// detached row that wouldn't show any of that.
function renderLogInto(container, entries, kindFilter) {
    if (!container) return 0;
    container.innerHTML = "";

    const matching = kindFilter
        ? entries.filter(function (e) { return normalizeKind(e.kind) === kindFilter; })
        : entries.slice();

    if (!matching.length) {
        const empty = document.createElement("p");
        empty.className = "log-empty";
        empty.textContent = kindFilter
            ? 'nothing filed under "' + kindFilter + '" yet.'
            : "nothing here yet.";
        container.appendChild(empty);
        return 0;
    }

    groupByMonth(sortEntries(matching)).forEach(function (group, index) {
        container.appendChild(buildMonth(group, index));
    });

    return matching.length;
}

// ── the page itself ──────────────────────────────────────────────────────

function initScraps() {
    const log = document.getElementById("scraps-log");
    if (!log) return;               // not the scraps page — do nothing at all

    const filterBar = document.getElementById("scraps-filter");
    const status = document.getElementById("scraps-status");

    // Only offer kinds that actually exist in the data. The chrome varies with
    // the content, never with a hand-set field — same rule as the rows.
    const counts = {};
    SCRAPS.forEach(function (entry) {
        const kind = normalizeKind(entry.kind);
        counts[kind] = (counts[kind] || 0) + 1;
    });
    const present = KINDS.filter(function (k) { return counts[k.key]; });

    let activeKind = null;
    const buttons = {};

    function readHashFilter() {
        const match = /^#kind=([a-z]+)$/.exec(location.hash || "");
        return match && counts[match[1]] ? match[1] : null;
    }

    function writeHashFilter(kind) {
        // Built from pathname rather than assigning location.hash, so clearing
        // the filter doesn't leave a bare "#" hanging in the address bar.
        const url = location.pathname + location.search + (kind ? "#kind=" + kind : "");
        try {
            // replaceState, not push — Back should leave the page, not walk
            // backwards through filter states.
            history.replaceState(null, "", url);
        } catch (err) {
            /* file:// throws SecurityError; the filter still works */
        }
    }

    function setFilter(kind, opts) {
        activeKind = kind;
        const shown = renderLogInto(log, SCRAPS, kind);

        // Note we never rebuild the filter bar itself — mutating attributes
        // in place is what keeps focus on a button after it's clicked.
        present.forEach(function (k) {
            buttons[k.key].setAttribute("aria-pressed", k.key === kind ? "true" : "false");
        });

        if (status) {
            status.textContent = kind
                ? "showing " + kind + " · " + shown + " of " + SCRAPS.length + " — esc to clear"
                : "";
        }

        if (!opts || !opts.silent) writeHashFilter(kind);
    }

    if (filterBar) {
        const label = document.createElement("span");
        label.className = "log-filter-label";
        label.textContent = "filter:";
        filterBar.appendChild(label);

        present.forEach(function (k) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "log-filter-btn";
            button.setAttribute("aria-pressed", "false");
            // Announces as "listen, button, shortcut l". The button's text
            // stays clean — writing "[l]isten" would be read out as
            // "bracket L bracket isten".
            button.setAttribute("aria-keyshortcuts", k.hotkey);

            // First letter carries the accent underline: that's how the
            // keyboard shortcut teaches itself without a tooltip.
            const first = document.createElement("span");
            first.className = "log-filter-key";
            first.textContent = k.key.charAt(0);
            button.appendChild(first);
            button.appendChild(document.createTextNode(k.key.slice(1)));

            const count = document.createElement("span");
            count.className = "log-filter-count";
            count.textContent = " " + counts[k.key];
            button.appendChild(count);

            button.addEventListener("click", function () {
                setFilter(activeKind === k.key ? null : k.key);
            });

            buttons[k.key] = button;
            filterBar.appendChild(button);
        });

        // Only reveal the bar once JS has filled it, so a no-JS visitor never
        // sees a row of controls that do nothing.
        filterBar.removeAttribute("hidden");
    }

    // Same shape as the backtick handler in theme.js, with a few more guards.
    document.addEventListener("keydown", function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;   // leave Cmd-L etc. alone

        const target = e.target;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" || target.isContentEditable)) return;

        if (e.key === "Escape") {
            if (activeKind) {
                setFilter(null);
                e.preventDefault();
            }
            return;                                       // otherwise let it through
        }

        const kind = HOTKEY_MAP[(e.key || "").toLowerCase()];
        if (!kind || !counts[kind]) return;
        setFilter(activeKind === kind ? null : kind);     // same key toggles off
    });

    window.addEventListener("hashchange", function () {
        setFilter(readHashFilter(), { silent: true });
    });

    setFilter(readHashFilter(), { silent: true });
}

initScraps();
