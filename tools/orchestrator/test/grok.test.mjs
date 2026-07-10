import test from 'node:test';
import assert from 'node:assert/strict';

import { buildArgs, extractEnvelope, parseReport, runExecutor } from '../lib/grok.mjs';

const cfg = {
  command: 'grok',
  model: null,
  max_turns: 80,
  permission_mode: 'acceptEdits',
  timeout_seconds: 60,
  extra_args: [],
};

test('buildArgs: fresh round', () => {
  const args = buildArgs(cfg, { promptFile: '/p.md', schemaJson: '{"type":"object"}' });
  assert.deepEqual(args, [
    '--prompt-file', '/p.md', '--output-format', 'json',
    '--json-schema', '{"type":"object"}',
    '--max-turns', '80', '--permission-mode', 'acceptEdits',
  ]);
});

test('buildArgs: revision round resumes session, honors model and cwd', () => {
  const args = buildArgs({ ...cfg, model: 'grok-4.5' }, { promptFile: '/p.md', sessionId: 'abc', cwd: '/repo' });
  assert.ok(args.includes('--resume') && args[args.indexOf('--resume') + 1] === 'abc');
  assert.ok(args.includes('-m') && args[args.indexOf('-m') + 1] === 'grok-4.5');
  assert.ok(args.includes('--cwd') && args[args.indexOf('--cwd') + 1] === '/repo');
});

test('extractEnvelope tolerates auth noise before the JSON', () => {
  const stdout = 'To sign in, open this URL:\n  https://x.ai/device\nWaiting for authorization...\n{\n  "text": "{}",\n  "sessionId": "s1"\n}';
  const env = extractEnvelope(stdout);
  assert.equal(env.sessionId, 's1');
});

test('extractEnvelope throws on garbage', () => {
  assert.throws(() => extractEnvelope('no json here'), /no JSON envelope/);
});

test('parseReport: bare JSON, fenced JSON, and embedded JSON', () => {
  const report = { task_id: 't', round: 1 };
  const json = JSON.stringify(report);
  assert.deepEqual(parseReport(json), report);
  assert.deepEqual(parseReport('```json\n' + json + '\n```'), report);
  assert.deepEqual(parseReport('Here is my report:\n' + json + '\nDone.'), report);
});

test('runExecutor: happy path with injected spawn', () => {
  const reportJson = JSON.stringify({ task_id: 't', round: 1, status: 'completed' });
  const fakeSpawn = (command, args, opts) => {
    assert.equal(command, 'grok');
    assert.equal(opts.stdio[0], 'ignore');
    return { status: 0, stdout: JSON.stringify({ text: reportJson, sessionId: 's9' }), stderr: '' };
  };
  const { envelope, report } = runExecutor(cfg, { promptFile: '/p.md' }, fakeSpawn);
  assert.equal(envelope.sessionId, 's9');
  assert.equal(report.status, 'completed');
});

test('runExecutor prefers structuredOutput over text', () => {
  const fakeSpawn = () => ({
    status: 0,
    stdout: JSON.stringify({ text: '', structuredOutput: { status: 'completed' }, sessionId: 's1' }),
    stderr: '',
  });
  const { report } = runExecutor(cfg, { promptFile: '/p.md' }, fakeSpawn);
  assert.equal(report.status, 'completed');
});

test('runExecutor: non-zero exit surfaces stderr', () => {
  const fakeSpawn = () => ({ status: 2, stdout: '', stderr: 'boom' });
  assert.throws(() => runExecutor(cfg, { promptFile: '/p.md' }, fakeSpawn), /exited 2[\s\S]*boom/);
});
