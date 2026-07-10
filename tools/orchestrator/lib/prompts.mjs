import fs from 'node:fs';
import path from 'node:path';

export function loadTemplates(promptsDir) {
  const read = (name) => fs.readFileSync(path.join(promptsDir, name), 'utf8');
  return {
    executor: read('executor.md'),
    briefSchema: JSON.parse(read('brief.schema.json')),
    reportSchema: JSON.parse(read('report.schema.json')),
    revisionSchema: JSON.parse(read('revision.schema.json')),
  };
}

// Renders the full prompt sent to the executor for one round. The brief is
// always included; on revision rounds the executor also resumes its prior
// session, so the revision block is the delta it must act on.
export function renderExecutorPrompt({ templates, brief, revision = null, round }) {
  const parts = [templates.executor.trim()];
  parts.push(`## Execution brief (round ${round})\n\n\`\`\`json\n${JSON.stringify(brief, null, 2)}\n\`\`\``);
  if (revision) {
    parts.push(
      `## Revision request (round ${round})\n\n` +
        `Your previous round was reviewed and rejected. Fix the issues below. ` +
        `The original brief above still applies in full.\n\n` +
        `\`\`\`json\n${JSON.stringify(revision, null, 2)}\n\`\`\``
    );
  }
  parts.push(
    `## Completion report format\n\n` +
      `End by outputting ONLY a JSON object conforming to this schema ` +
      `(task_id: "${brief.task_id}", round: ${round}):\n\n` +
      `\`\`\`json\n${JSON.stringify(templates.reportSchema, null, 2)}\n\`\`\``
  );
  return parts.join('\n\n') + '\n';
}
