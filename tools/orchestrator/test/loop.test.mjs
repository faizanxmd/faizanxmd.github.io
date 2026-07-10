import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeContext, cmdNew, cmdBrief, cmdRun, cmdReview } from '../orchestrate.mjs';

const ORCH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function tmpContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-loop-'));
  fs.copyFileSync(path.join(ORCH_DIR, 'config.json'), path.join(root, 'config.json'));
  fs.cpSync(path.join(ORCH_DIR, 'prompts'), path.join(root, 'prompts'), { recursive: true });
  return makeContext(root);
}

function fakeExec(reportOverrides = {}) {
  const calls = [];
  const exec = (cfg, opts) => {
    calls.push(opts);
    const report = {
      task_id: 'overwritten-below',
      round: calls.length,
      status: 'completed',
      summary: `round ${calls.length} done`,
      changed_files: [{ path: 'index.html', change: 'edited' }],
      commands_run: [{ command: 'true', exit_code: 0 }],
      blockers: [],
      assumptions: [],
      questions: [],
      scope_deviations: [],
      ...reportOverrides,
    };
    return {
      envelope: { text: JSON.stringify(report), sessionId: `sess-${calls.length}` },
      report,
      rawStdout: JSON.stringify(report),
    };
  };
  return { exec, calls };
}

function fillBrief(ctx, id) {
  const file = ctx.store.filePath(id, 'brief-1.json');
  const brief = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(brief, {
    goal: 'demo goal',
    acceptance_criteria: ['works'],
    verification_commands: ['true'],
  });
  fs.writeFileSync(file, JSON.stringify(brief, null, 2));
}

test('full loop: new -> brief -> run -> revise -> run -> approve', () => {
  const ctx = tmpContext();
  const { exec, calls } = fakeExec();

  const { task } = cmdNew(ctx, 'demo loop task');
  fillBrief(ctx, task.id);
  cmdBrief(ctx, task.id);
  assert.equal(ctx.store.load(task.id).status, 'briefed');

  const r1 = cmdRun(ctx, task.id, { exec });
  assert.equal(r1.task.status, 'reported');
  assert.equal(r1.task.executor.session_id, 'sess-1');
  assert.ok(fs.existsSync(ctx.store.filePath(task.id, 'report-1.json')));
  assert.equal(calls[0].sessionId, null, 'round 1 must not resume a session');

  const revisionFile = path.join(ctx.root, 'rev.json');
  fs.writeFileSync(
    revisionFile,
    JSON.stringify({
      task_id: task.id,
      round: 2,
      verdict: 'revise',
      issues: [{ severity: 'major', description: 'missing test', required_fix: 'add it' }],
    })
  );
  cmdReview(ctx, task.id, { verdict: 'revise', file: revisionFile, notes: 'no test coverage' });
  let t = ctx.store.load(task.id);
  assert.equal(t.status, 'revision_requested');
  assert.equal(t.round, 2);

  const r2 = cmdRun(ctx, task.id, { exec });
  assert.equal(r2.task.status, 'reported');
  assert.equal(calls[1].sessionId, 'sess-1', 'revision round must resume the executor session');
  const prompt2 = fs.readFileSync(ctx.store.filePath(task.id, 'prompt-2.md'), 'utf8');
  assert.match(prompt2, /Revision request \(round 2\)/);
  assert.match(prompt2, /missing test/);
  assert.match(prompt2, /demo goal/, 'revision prompt keeps the original brief');

  cmdReview(ctx, task.id, { verdict: 'approve', notes: 'lgtm' });
  t = ctx.store.load(task.id);
  assert.equal(t.status, 'approved');

  const log = fs
    .readFileSync(ctx.store.filePath(task.id, 'log.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  assert.equal(log.filter((l) => l.event === 'handoff_to_executor').length, 2);
  assert.equal(log.filter((l) => l.event === 'report_received').length, 2);
  assert.equal(log.filter((l) => l.event === 'review').length, 2);
});

test('block -> re-brief opens a new round with the new brief in the prompt', () => {
  const ctx = tmpContext();
  const { exec } = fakeExec({ status: 'blocked', blockers: ['ambiguous target'], summary: 'need guidance' });

  const { task } = cmdNew(ctx, 'blocked task');
  fillBrief(ctx, task.id);
  cmdBrief(ctx, task.id);
  cmdRun(ctx, task.id, { exec });
  cmdReview(ctx, task.id, { verdict: 'block', notes: 'answering executor question' });
  assert.equal(ctx.store.load(task.id).status, 'blocked');

  const newBrief = path.join(ctx.root, 'brief2.json');
  fs.writeFileSync(
    newBrief,
    JSON.stringify({
      task_id: task.id,
      round: 2,
      goal: 'clarified goal',
      acceptance_criteria: ['works'],
      verification_commands: ['true'],
    })
  );
  cmdBrief(ctx, task.id, { file: newBrief });
  const t = ctx.store.load(task.id);
  assert.equal(t.status, 'briefed');
  assert.equal(t.round, 2);

  const { exec: exec2 } = fakeExec();
  cmdRun(ctx, task.id, { exec: exec2 });
  const prompt = fs.readFileSync(ctx.store.filePath(task.id, 'prompt-2.md'), 'utf8');
  assert.match(prompt, /clarified goal/);
  assert.doesNotMatch(prompt, /Revision request/);
});

test('guards: cannot run unbriefed, cannot review unreported, cannot re-approve', () => {
  const ctx = tmpContext();
  const { exec } = fakeExec();
  const { task } = cmdNew(ctx, 'guard task');
  assert.throws(() => cmdRun(ctx, task.id, { exec }), /cannot run a task in status "created"/);
  assert.throws(() => cmdReview(ctx, task.id, { verdict: 'approve' }), /cannot review/);
  fillBrief(ctx, task.id);
  cmdBrief(ctx, task.id);
  cmdRun(ctx, task.id, { exec });
  cmdReview(ctx, task.id, { verdict: 'approve' });
  assert.throws(() => cmdReview(ctx, task.id, { verdict: 'approve' }), /cannot review/);
});

test('executor failure marks the task failed and allows retry', () => {
  const ctx = tmpContext();
  const { task } = cmdNew(ctx, 'flaky task');
  fillBrief(ctx, task.id);
  cmdBrief(ctx, task.id);
  const boom = () => {
    throw new Error('executor exploded');
  };
  assert.throws(() => cmdRun(ctx, task.id, { exec: boom }), /executor exploded/);
  assert.equal(ctx.store.load(task.id).status, 'failed');
  const { exec } = fakeExec();
  const { task: t } = cmdRun(ctx, task.id, { exec });
  assert.equal(t.status, 'reported');
});

test('invalid executor report fails validation', () => {
  const ctx = tmpContext();
  const { task } = cmdNew(ctx, 'bad report');
  fillBrief(ctx, task.id);
  cmdBrief(ctx, task.id);
  const exec = () => ({
    envelope: { text: '{}', sessionId: 's' },
    report: { task_id: task.id, round: 1, status: 'completed' },
    rawStdout: '{}',
  });
  assert.throws(() => cmdRun(ctx, task.id, { exec }), /failed validation[\s\S]*summary/);
  assert.equal(ctx.store.load(task.id).status, 'failed');
});
