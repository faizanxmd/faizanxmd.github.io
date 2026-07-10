import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Provider adapter: the only module that knows how to invoke the executor
// CLI. Swap executors by replacing this file and config.json.

export function buildArgs(cfg, { promptFile, schemaJson = null, sessionId = null, cwd = null }) {
  // --prompt-file is grok's single-turn prompt-from-file flag; do not combine
  // with -p, which requires an inline prompt string.
  const args = ['--prompt-file', promptFile, '--output-format', 'json'];
  if (schemaJson) args.push('--json-schema', schemaJson);
  if (sessionId) args.push('--resume', sessionId);
  if (cfg.model) args.push('-m', cfg.model);
  if (cfg.max_turns) args.push('--max-turns', String(cfg.max_turns));
  if (cfg.permission_mode) args.push('--permission-mode', cfg.permission_mode);
  if (cwd) args.push('--cwd', cwd);
  args.push(...(cfg.extra_args ?? []));
  return args;
}

// grok can print auth/device-flow noise to stdout before the JSON envelope;
// scan forward for the first line that parses as JSON from there to the end.
export function extractEnvelope(stdout) {
  const text = stdout.trim();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trimStart().startsWith('{')) continue;
    const candidate = lines.slice(i).join('\n').trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // keep scanning
    }
  }
  throw new Error(`no JSON envelope in executor output; tail:\n${text.slice(-2000)}`);
}

// The report is the envelope's `text` field: ideally bare JSON (enforced by
// --json-schema), but tolerate a fenced block or surrounding prose.
export function parseReport(envelopeText) {
  const text = envelopeText.trim();
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    return JSON.parse(text.slice(first, last + 1));
  }
  throw new Error(`could not parse completion report from executor text:\n${text.slice(0, 2000)}`);
}

export function runExecutor(cfg, opts, spawn = spawnSync) {
  const args = buildArgs(cfg, opts);
  const result = spawn(cfg.command ?? 'grok', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: (cfg.timeout_seconds ?? 1800) * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`executor spawn failed: ${result.error.message}`);
  if (opts.rawFile) {
    const raw = (result.stdout ?? '') + (result.stderr ? `\n--- stderr ---\n${result.stderr}` : '');
    fs.writeFileSync(opts.rawFile, raw);
  }
  if (result.status !== 0) {
    throw new Error(`executor exited ${result.status}; stderr tail:\n${(result.stderr ?? '').slice(-2000)}`);
  }
  const envelope = extractEnvelope(result.stdout);
  // With --json-schema grok returns the parsed report in structuredOutput;
  // text-parsing is the fallback for schema-less or older CLI versions.
  const report = envelope.structuredOutput ?? parseReport(envelope.text ?? '');
  return { envelope, report, rawStdout: result.stdout };
}
