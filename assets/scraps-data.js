// ─────────────────────────────────────────────────────────────────────────
// SCRAPS — the log. One record per thing.
//
//   date   OPTIONAL. "2026-07-30" if you know the day. "2026-07" if you only
//          know the month. LEAVE THE KEY OUT if you don't know at all — the
//          page prints "--" and says nothing it can't back up. Never guess.
//   kind   REQUIRED. listen | read | watch | signal | note
//   title  REQUIRED.
//   link   optional. the thing itself.
//   note   optional. your own words. leave it out rather than pad it —
//          an empty note is the page's default, not a gap.
//
// The dates below are the month a thing landed on this site (from git), not
// when it was found. The day was never recorded, so it prints "--". The line
// under the page title says so.
//
// (This file can also be edited by editor.html — the > in the footer.)
// ─────────────────────────────────────────────────────────────────────────

const SCRAPS = [
    // ── new stuff goes here, at the top. copy a line, fill it in. ────────
    // { date: "2026-07-30", kind: "listen", title: "", link: "" },
    // { date: "2026-07-30", kind: "read",   title: "", link: "", note: "" },
    // { date: "2026-07-30", kind: "watch",  title: "", link: "" },
    // { date: "2026-07-30", kind: "signal", title: "", link: "" },
    // { date: "2026-07-30", kind: "note",   title: "" },

    {
        date: "2026-07",
        kind: "listen",
        title: "no surprises",
    },
    {
        date: "2026-02",
        kind: "listen",
        title: "ants in my room",
        link: "https://www.youtube.com/watch?v=McvdQYzlLM8",
    },
    {
        date: "2026-01",
        kind: "listen",
        title: "Bitter Sweet Symphony",
        link: "https://youtu.be/1lyu1KKwC74",
    },
    {
        date: "2026-01",
        kind: "listen",
        title: "Rubber Soul",
        link: "https://youtube.com/playlist?list=PLL-NbN8uTOigsPnqWhPLWJ4ADAkmNbrQI",
        note: "the beatles, 1965",
    },
    {
        date: "2026-01",
        kind: "listen",
        title: "Far From Any Road",
        link: "https://www.youtube.com/watch?v=TRJ_s2G76Hg",
    },
    {
        date: "2026-01",
        kind: "read",
        title: "Beej's Guide to C",
        link: "https://beej.us/guide/bgc/",
    },
    {
        date: "2026-01",
        kind: "read",
        title: "The Stand",
        link: "https://en.wikipedia.org/wiki/The_Stand",
        note: "stephen king",
    },
    {
        date: "2026-01",
        kind: "read",
        title: "Sapiens",
        link: "https://en.wikipedia.org/wiki/Sapiens:_A_Brief_History_of_Humankind",
    },
    {
        date: "2026-01",
        kind: "signal",
        title: "What's Going On Here?",
        link: "https://grahamduncan.blog/whats-going-on-here/",
        note: "graham duncan",
    },
    {
        date: "2026-01",
        kind: "signal",
        title: "Lil Mo",
        link: "https://robinhome.vercel.app/",
    },
];
