import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { TaskStore, assertTransition, TRANSITIONS } from '../lib/state.mjs';

function tmpStore() {
  return new TaskStore(fs.mkdtempSync(path.join(os.tmpdir(), 'orch-state-')));
}

test('legal transition chain: created -> briefed -> executing -> reported -> approved', () => {
  const store = tmpStore();
  const task = store.create('demo task');
  assert.equal(task.status, 'created');
  for (const to of ['briefed', 'executing', 'reported', 'approved']) {
    store.transition(task, to);
  }
  const reloaded = store.load(task.id);
  assert.equal(reloaded.status, 'approved');
  assert.equal(reloaded.history.length, 4);
});

test('illegal transitions throw', () => {
  assert.throws(() => assertTransition('created', 'reported'), /illegal transition/);
  assert.throws(() => assertTransition('approved', 'briefed'), /illegal transition/);
  assert.throws(() => assertTransition('briefed', 'approved'), /illegal transition/);
  assert.throws(() => assertTransition('nope', 'briefed'), /unknown status/);
});

test('every declared target status is itself a known status', () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    for (const to of targets) {
      assert.ok(to in TRANSITIONS, `${from} -> ${to}: "${to}" missing from machine`);
    }
  }
});

test('revision loop statuses: reported -> revision_requested -> executing', () => {
  const store = tmpStore();
  const task = store.create('loop');
  for (const to of ['briefed', 'executing', 'reported', 'revision_requested', 'executing', 'reported']) {
    store.transition(task, to);
  }
  assert.equal(store.load(task.id).status, 'reported');
});

test('handoff log records every transition', () => {
  const store = tmpStore();
  const task = store.create('logged');
  store.transition(task, 'briefed', 'brief attached');
  const lines = fs
    .readFileSync(store.filePath(task.id, 'log.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  assert.equal(lines[0].event, 'task_created');
  assert.ok(lines.some((l) => l.event === 'transition' && l.detail.includes('created -> briefed')));
});

test('instructionFile picks brief for fresh rounds and revision for revision rounds', () => {
  const store = tmpStore();
  const task = store.create('picker');
  fs.writeFileSync(store.filePath(task.id, 'brief-1.json'), '{}');
  assert.equal(store.instructionFile(task).kind, 'brief');
  task.round = 2;
  fs.writeFileSync(store.filePath(task.id, 'revision-2.json'), '{}');
  assert.equal(store.instructionFile(task).kind, 'revision');
  task.round = 3;
  assert.throws(() => store.instructionFile(task), /no brief-3/);
});
