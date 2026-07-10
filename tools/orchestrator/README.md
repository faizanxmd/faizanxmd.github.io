# Orchestrator — Fable 5 plans & reviews, Grok executes

A minimal, zero-dependency harness for delegated coding work. **Fable 5**
(Claude, the orchestrator) owns task intent, architecture, quality standards,
and final approval. **Grok CLI** (headless, the executor) does the coding work
from briefs Fable writes, and answers with a schema-validated completion
report that Fable reviews before anything is called done.

Requires Node ≥ 18 and an authenticated `grok` CLI (`grok login`).

## The loop

```
user task
   │
   ▼
Fable: new ──▶ fill brief ──▶ brief (validate)          [created → briefed]
   │
   ▼
run ──▶ prompt rendered, handoff logged, grok invoked    [briefed → executing]
   │        grok edits files, runs verification,
   │        emits JSON completion report
   ▼
report captured + schema-validated                       [executing → reported]
   │
   ▼
Fable reviews: checklist + git diff + re-runs verification
   ├─ approve ─────────────────────────────────────────▶ [reported → approved]  ✅ user summary
   ├─ revise ──▶ revision-N.json ──▶ run (resumes grok session, loops)
   └─ block ───▶ needs a decision ──▶ new brief ──▶ run (loops)
```

## Commands

All from the repo root:

```sh
node tools/orchestrator/orchestrate.mjs new "<title>" [--cwd <dir>]
node tools/orchestrator/orchestrate.mjs brief <id> [--file <brief.json>]
node tools/orchestrator/orchestrate.mjs run <id>
node tools/orchestrator/orchestrate.mjs report <id>
node tools/orchestrator/orchestrate.mjs review <id> --approve [--notes "..."]
node tools/orchestrator/orchestrate.mjs review <id> --revise --file <revision.json> [--notes "..."]
node tools/orchestrator/orchestrate.mjs review <id> --block [--notes "..."]
node tools/orchestrator/orchestrate.mjs status [<id>]
node tools/orchestrator/orchestrate.mjs log <id>
```

## Layout

- `orchestrate.mjs` — CLI + command implementations (importable for tests)
- `config.json` — executor settings: command, model, max turns, permission
  mode, timeout, extra args. Edit here, not in code.
- `lib/grok.mjs` — provider adapter; the **only** module that shells out to
  the executor. Swap executors by replacing this file + config.
- `lib/state.mjs` — task store + explicit state machine
- `lib/prompts.mjs`, `lib/validate.mjs` — prompt rendering, schema checking
- `prompts/v1/` — versioned templates: `orchestrator.md` (Fable's manual),
  `executor.md` (Grok's rules), `review-checklist.md`, and the three JSON
  schemas (brief / report / revision). To evolve prompts, copy `v1` → `v2`
  and bump `prompt_version` in config.
- `tasks/<id>/` — explicit task state (gitignored): `task.json` (status,
  round, history, executor session), `brief-N.json`, `prompt-N.md`,
  `raw-N.txt`, `report-N.json`, `revision-N.json`, `review-N.md`, and
  `log.jsonl` (every orchestrator↔executor handoff).

## Task states

`created → briefed → executing → reported → approved`, with loops:
`reported → revision_requested → executing` (fix round, resumes the executor's
session), `reported → blocked → briefed` (needs an orchestrator/user decision,
then a fresh brief), and `executing → failed → executing|briefed` (retry).
Illegal transitions throw. If a run is killed mid-execution the task can be
left in `executing`; fix by editing `task.json` status to `failed`, then re-run.

## Tests

```sh
node --test 'tools/orchestrator/test/*.test.mjs'
```

Covers state transitions, prompt rendering, schema validation, adapter arg
construction, tolerant output parsing, and the full loop (brief → run →
revise → run → approve) against a fake executor.

## Notes

- The executor runs with `--permission-mode auto` by default: file edits and
  routine commands are auto-approved (`acceptEdits` is not enough — headless
  runs stall and come back `stopReason: "Cancelled"` when a shell command
  needs approval). Tighten or loosen in `config.json`.
- `--json-schema` constrains grok's final answer to the completion report
  schema; the parser still tolerates fenced/embedded JSON as a fallback.
- Revision rounds pass `--resume <sessionId>` so the executor keeps its
  working context instead of rediscovering the codebase.
