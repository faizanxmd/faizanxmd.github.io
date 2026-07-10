import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTemplates, renderExecutorPrompt } from '../lib/prompts.mjs';
import { validate } from '../lib/validate.mjs';

const promptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prompts', 'v1');
const templates = loadTemplates(promptsDir);

const brief = {
  task_id: 't-001-x',
  round: 1,
  goal: 'Add a footer to index.html',
  acceptance_criteria: ['footer element exists'],
  verification_commands: ['grep -c "<footer" index.html'],
};

test('round-1 prompt contains executor rules, brief, and report schema', () => {
  const prompt = renderExecutorPrompt({ templates, brief, round: 1 });
  assert.match(prompt, /You are the EXECUTOR/);
  assert.match(prompt, /Add a footer to index\.html/);
  assert.match(prompt, /CompletionReport\.v1/);
  assert.match(prompt, /task_id: "t-001-x", round: 1/);
  assert.doesNotMatch(prompt, /Revision request/);
});

test('revision prompt includes issues and keeps the brief', () => {
  const revision = {
    task_id: 't-001-x',
    round: 2,
    verdict: 'revise',
    issues: [{ severity: 'major', description: 'footer unstyled', required_fix: 'use site tokens' }],
  };
  const prompt = renderExecutorPrompt({ templates, brief, revision, round: 2 });
  assert.match(prompt, /Revision request \(round 2\)/);
  assert.match(prompt, /footer unstyled/);
  assert.match(prompt, /Add a footer to index\.html/);
});

test('brief schema accepts a full brief and rejects a gutted one', () => {
  assert.deepEqual(validate(templates.briefSchema, brief), []);
  const errors = validate(templates.briefSchema, { task_id: 't', round: 'one' });
  assert.ok(errors.some((e) => e.includes('missing required property "goal"')));
  assert.ok(errors.some((e) => e.includes('.round: expected integer')));
});

test('report schema enforces status enum and changed_files shape', () => {
  const report = {
    task_id: 't-001-x',
    round: 1,
    status: 'completed',
    summary: 'done',
    changed_files: [{ path: 'index.html', change: 'added footer' }],
    commands_run: [{ command: 'grep -c "<footer" index.html', exit_code: 0 }],
    blockers: [],
    assumptions: [],
    questions: [],
    scope_deviations: [],
  };
  assert.deepEqual(validate(templates.reportSchema, report), []);
  const bad = { ...report, status: 'perfect', changed_files: [{ path: 'index.html' }] };
  const errors = validate(templates.reportSchema, bad);
  assert.ok(errors.some((e) => e.includes('not in enum')));
  assert.ok(errors.some((e) => e.includes('missing required property "change"')));
});
