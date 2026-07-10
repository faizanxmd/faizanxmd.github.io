import fs from 'node:fs';
import path from 'node:path';

// Explicit task state machine. Every transition is validated and appended to
// the task's history and handoff log.
export const TRANSITIONS = {
  created: ['briefed'],
  briefed: ['executing'],
  executing: ['reported', 'failed'],
  reported: ['approved', 'revision_requested', 'blocked'],
  revision_requested: ['executing'],
  blocked: ['briefed'],
  failed: ['briefed', 'executing'],
  approved: [],
};

export function assertTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed) throw new Error(`unknown status "${from}"`);
  if (!allowed.includes(to)) {
    throw new Error(`illegal transition ${from} -> ${to} (allowed: ${allowed.join(', ') || 'none'})`);
  }
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export class TaskStore {
  constructor(tasksRoot) {
    this.root = tasksRoot;
  }

  taskDir(id) {
    return path.join(this.root, id);
  }

  filePath(id, name) {
    return path.join(this.taskDir(id), name);
  }

  list() {
    if (!fs.existsSync(this.root)) return [];
    return fs.readdirSync(this.root).filter((d) => fs.existsSync(this.filePath(d, 'task.json'))).sort();
  }

  create(title, { cwd = null } = {}) {
    const seq = String(this.list().length + 1).padStart(3, '0');
    const id = `t-${seq}-${slugify(title)}`;
    fs.mkdirSync(this.taskDir(id), { recursive: true });
    const task = {
      id,
      title,
      created_at: new Date().toISOString(),
      status: 'created',
      round: 1,
      cwd,
      executor: { session_id: null },
      history: [],
    };
    this.save(task);
    this.appendLog(id, { actor: 'orchestrator', event: 'task_created', detail: title });
    return task;
  }

  load(id) {
    const file = this.filePath(id, 'task.json');
    if (!fs.existsSync(file)) throw new Error(`no such task: ${id}`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  save(task) {
    fs.writeFileSync(this.filePath(task.id, 'task.json'), JSON.stringify(task, null, 2) + '\n');
  }

  transition(task, to, note = '') {
    assertTransition(task.status, to);
    const entry = { ts: new Date().toISOString(), from: task.status, to, note };
    task.status = to;
    task.history.push(entry);
    this.save(task);
    this.appendLog(task.id, { actor: 'orchestrator', event: 'transition', detail: `${entry.from} -> ${to}${note ? `: ${note}` : ''}` });
    return task;
  }

  appendLog(id, { actor, event, detail = '' }) {
    const line = JSON.stringify({ ts: new Date().toISOString(), actor, event, detail });
    fs.appendFileSync(this.filePath(id, 'log.jsonl'), line + '\n');
  }

  // Instruction file for the current round: brief-N.json for fresh briefs
  // (round 1 or re-brief after a block), revision-N.json for revision rounds.
  instructionFile(task) {
    const brief = this.filePath(task.id, `brief-${task.round}.json`);
    if (fs.existsSync(brief)) return { kind: 'brief', file: brief };
    const revision = this.filePath(task.id, `revision-${task.round}.json`);
    if (fs.existsSync(revision)) return { kind: 'revision', file: revision };
    throw new Error(`no brief-${task.round}.json or revision-${task.round}.json for ${task.id}`);
  }
}
