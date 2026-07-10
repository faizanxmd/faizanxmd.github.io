#!/usr/bin/env node
// Orchestrator/executor harness: Fable 5 writes briefs and reviews; the
// executor CLI (grok, headless) does the coding work. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { TaskStore } from './lib/state.mjs';
import { loadTemplates, renderExecutorPrompt } from './lib/prompts.mjs';
import { assertValid } from './lib/validate.mjs';
import { runExecutor } from './lib/grok.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function makeContext(root = process.env.ORCH_ROOT || HERE) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  const promptsDir = path.join(root, 'prompts', config.prompt_version);
  return {
    root,
    config,
    promptsDir,
    templates: loadTemplates(promptsDir),
    store: new TaskStore(path.join(root, 'tasks')),
  };
}

const BRIEF_SKELETON = (id) => ({
  task_id: id,
  round: 1,
  goal: '',
  context: '',
  files_in_scope: [],
  out_of_scope: [],
  constraints: [],
  acceptance_criteria: [],
  verification_commands: [],
  notes: '',
});

export function cmdNew(ctx, title, { cwd = null } = {}) {
  if (!title) throw new Error('usage: new "<title>" [--cwd <dir>]');
  const task = ctx.store.create(title, { cwd });
  const skeleton = ctx.store.filePath(task.id, 'brief-1.json');
  fs.writeFileSync(skeleton, JSON.stringify(BRIEF_SKELETON(task.id), null, 2) + '\n');
  return { task, briefFile: skeleton };
}

export function cmdBrief(ctx, id, { file = null } = {}) {
  const task = ctx.store.load(id);
  if (!['created', 'blocked', 'failed'].includes(task.status)) {
    throw new Error(`cannot brief a task in status "${task.status}"`);
  }
  if (task.status === 'blocked') task.round += 1; // re-brief opens a new round
  const target = ctx.store.filePath(id, `brief-${task.round}.json`);
  if (file && path.resolve(file) !== path.resolve(target)) fs.copyFileSync(file, target);
  if (!fs.existsSync(target)) throw new Error(`no brief file: ${target}`);
  const brief = JSON.parse(fs.readFileSync(target, 'utf8'));
  brief.task_id = id;
  brief.round = task.round;
  assertValid(ctx.templates.briefSchema, brief, `brief-${task.round}.json`);
  fs.writeFileSync(target, JSON.stringify(brief, null, 2) + '\n');
  ctx.store.transition(task, 'briefed');
  ctx.store.appendLog(id, { actor: 'orchestrator', event: 'brief_attached', detail: target });
  return { task, brief };
}

function latestBriefFile(store, task) {
  for (let r = task.round; r >= 1; r--) {
    const f = store.filePath(task.id, `brief-${r}.json`);
    if (fs.existsSync(f)) return f;
  }
  throw new Error(`no brief file found for ${task.id}`);
}

export function cmdRun(ctx, id, { exec = runExecutor } = {}) {
  let task = ctx.store.load(id);
  if (!['briefed', 'revision_requested', 'failed'].includes(task.status)) {
    throw new Error(`cannot run a task in status "${task.status}"`);
  }
  const round = task.round;
  const { kind, file } = ctx.store.instructionFile(task);
  const instruction = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Revision rounds re-send the latest brief plus the issue list; re-brief
  // rounds (after a block) send the new brief itself.
  const brief =
    kind === 'brief'
      ? instruction
      : JSON.parse(fs.readFileSync(latestBriefFile(ctx.store, task), 'utf8'));
  const revision = kind === 'revision' ? instruction : null;

  const prompt = renderExecutorPrompt({ templates: ctx.templates, brief, revision, round });
  const promptFile = ctx.store.filePath(id, `prompt-${round}.md`);
  fs.writeFileSync(promptFile, prompt);

  ctx.store.transition(task, 'executing');
  ctx.store.appendLog(id, {
    actor: 'orchestrator',
    event: 'handoff_to_executor',
    detail: `${kind} round ${round} -> ${ctx.config.executor.command}${task.executor.session_id ? ` (resume ${task.executor.session_id})` : ''}`,
  });

  let result, report;
  try {
    result = exec(ctx.config.executor, {
      promptFile,
      schemaJson: JSON.stringify(ctx.templates.reportSchema),
      sessionId: task.executor.session_id,
      cwd: task.cwd,
      rawFile: ctx.store.filePath(id, `raw-${round}.txt`),
    });
    report = result.report;
    report.task_id = report.task_id || id;
    assertValid(ctx.templates.reportSchema, report, `report round ${round}`);
  } catch (err) {
    ctx.store.transition(task, 'failed', err.message.slice(0, 500));
    throw err;
  }
  fs.writeFileSync(ctx.store.filePath(id, `report-${round}.json`), JSON.stringify(report, null, 2) + '\n');

  task = ctx.store.load(id);
  if (result.envelope.sessionId) task.executor.session_id = result.envelope.sessionId;
  ctx.store.save(task);
  ctx.store.transition(task, 'reported', `executor status: ${report.status}`);
  ctx.store.appendLog(id, {
    actor: 'executor',
    event: 'report_received',
    detail: `round ${round}: ${report.status} — ${report.summary.slice(0, 200)}`,
  });
  return { task, report };
}

export function cmdReview(ctx, id, { verdict, file = null, notes = '' }) {
  const task = ctx.store.load(id);
  if (task.status !== 'reported') throw new Error(`cannot review a task in status "${task.status}"`);
  const round = task.round;
  const reviewFile = ctx.store.filePath(id, `review-${round}.md`);

  if (verdict === 'approve') {
    fs.writeFileSync(reviewFile, `# Review — round ${round}\n\nVerdict: APPROVE\n\n${notes}\n`);
    ctx.store.transition(task, 'approved', notes);
  } else if (verdict === 'revise') {
    if (!file) throw new Error('--revise requires --file <revision.json>');
    const revision = JSON.parse(fs.readFileSync(file, 'utf8'));
    revision.task_id = id;
    revision.round = round + 1;
    assertValid(ctx.templates.revisionSchema, revision, 'revision request');
    task.round = round + 1;
    ctx.store.save(task);
    fs.writeFileSync(
      ctx.store.filePath(id, `revision-${task.round}.json`),
      JSON.stringify(revision, null, 2) + '\n'
    );
    fs.writeFileSync(reviewFile, `# Review — round ${round}\n\nVerdict: REVISE (round ${task.round} opened)\n\n${notes}\n`);
    ctx.store.transition(task, 'revision_requested', notes);
  } else if (verdict === 'block') {
    fs.writeFileSync(reviewFile, `# Review — round ${round}\n\nVerdict: BLOCKED\n\n${notes}\n`);
    ctx.store.transition(task, 'blocked', notes);
  } else {
    throw new Error('verdict must be --approve, --revise, or --block');
  }
  ctx.store.appendLog(id, { actor: 'orchestrator', event: 'review', detail: `round ${round}: ${verdict}${notes ? ` — ${notes}` : ''}` });
  return { task };
}

function cmdStatus(ctx, id) {
  if (id) {
    const task = ctx.store.load(id);
    return JSON.stringify(task, null, 2);
  }
  const rows = ctx.store.list().map((tid) => {
    const t = ctx.store.load(tid);
    return `${t.id}  [${t.status}]  round ${t.round}  ${t.title}`;
  });
  return rows.join('\n') || '(no tasks)';
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (['approve', 'revise', 'block'].includes(key)) flags.verdict = key;
      else flags[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else positional.push(argv[i]);
  }
  return { flags, positional };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseFlags(rest);
  const ctx = makeContext();
  const out = console.log;
  switch (cmd) {
    case 'new': {
      const { task, briefFile } = cmdNew(ctx, positional[0], { cwd: flags.cwd ?? null });
      out(`created ${task.id} [${task.status}]`);
      out(`fill the brief: ${briefFile}`);
      out(`then run: node tools/orchestrator/orchestrate.mjs brief ${task.id}`);
      break;
    }
    case 'brief': {
      const { task } = cmdBrief(ctx, positional[0], { file: flags.file ?? null });
      out(`${task.id} [${task.status}] round ${task.round} — brief validated`);
      break;
    }
    case 'run': {
      const { task, report } = cmdRun(ctx, positional[0]);
      out(`${task.id} [${task.status}] — executor says: ${report.status}`);
      out(report.summary);
      out(`\nreview it: node tools/orchestrator/orchestrate.mjs report ${task.id}`);
      break;
    }
    case 'report': {
      const task = ctx.store.load(positional[0]);
      out(fs.readFileSync(ctx.store.filePath(task.id, `report-${task.round}.json`), 'utf8'));
      break;
    }
    case 'review': {
      const { task } = cmdReview(ctx, positional[0], {
        verdict: flags.verdict,
        file: flags.file ?? null,
        notes: typeof flags.notes === 'string' ? flags.notes : '',
      });
      out(`${task.id} [${task.status}] round ${task.round}`);
      break;
    }
    case 'status':
      out(cmdStatus(ctx, positional[0]));
      break;
    case 'log': {
      out(fs.readFileSync(ctx.store.filePath(positional[0], 'log.jsonl'), 'utf8').trim());
      break;
    }
    default:
      out('usage: orchestrate.mjs <new|brief|run|report|review|status|log> ...');
      process.exitCode = cmd ? 1 : 0;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  }
}
