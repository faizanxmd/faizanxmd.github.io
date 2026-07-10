# Review checklist (v1)

Walk every item before a verdict. Any "no" → revise (or block, if it needs a
human/orchestrator decision).

## Correctness
- [ ] Every acceptance criterion in the brief is demonstrably met.
- [ ] `git diff` matches the report's `changed_files` — no unlisted edits,
      no listed-but-missing edits.
- [ ] Edge cases implied by the brief are handled, not just the happy path.

## Verification
- [ ] Every `verification_command` appears in `commands_run` with exit code 0
      (or a justified non-zero).
- [ ] I re-ran the verification commands myself and they pass.
- [ ] Tests exist where the brief asked for them, and they test behavior,
      not implementation trivia.

## Scope control
- [ ] No files outside `files_in_scope` were touched without justification.
- [ ] `scope_deviations` is empty, or every deviation is acceptable.
- [ ] No unrelated refactors, dependency changes, or formatting sweeps.

## Risk & honesty
- [ ] No destructive operations (git resets, deletions of user work).
- [ ] `assumptions` are all acceptable; none should have been a question.
- [ ] `questions` and `blockers` are empty, or answered before approval.
- [ ] Nothing security-sensitive was changed without my direct review.

## Maintainability
- [ ] Code reads like the surrounding code (style, naming, idiom).
- [ ] No dead code, debug output, or commented-out blocks left behind.
