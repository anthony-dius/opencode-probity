import { writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

/**
 * OpenCode session message, as returned by client.session.messages().
 * Probity's opencode vendor reads this shape natively, so messages are
 * written to the transcript file verbatim — no translation needed.
 */
interface OpenCodeMessage {
  info: { role: 'user' | 'assistant'; id: string };
  parts: unknown[];
}

/**
 * Write OpenCode session messages to a JSONL transcript file for probity
 * to read via --agent opencode.
 *
 * Returns the absolute path to the transcript file.
 */
export function writeTranscript(sessionID: string, messages: OpenCodeMessage[]): string {
  const lines = messages.map((message) => JSON.stringify(message));

  const dir = `${tmpdir()}/probity-transcripts`;
  mkdirSync(dir, { recursive: true });

  const filePath = `${dir}/${sessionID}.jsonl`;
  writeFileSync(filePath, lines.join('\n') + '\n');
  return filePath;
}
