import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { tmpdir } from 'os';

/**
 * Minimal OpenCode types used for transcript conversion.
 * Kept local to avoid a hard dependency on @opencode-ai/sdk at runtime.
 */
interface OpenCodeMessage {
  info: { role: 'user' | 'assistant'; id: string };
  parts: OpenCodePart[];
}

type OpenCodePart =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: string; callID: string; state: ToolState }
  | { type: string };

type ToolState =
  | { status: 'completed'; input: Record<string, unknown>; output: string }
  | { status: 'error'; input: Record<string, unknown>; error: string }
  | { status: 'running'; input: Record<string, unknown> }
  | { status: 'pending'; input: Record<string, unknown> };

/**
 * Convert OpenCode session messages into Claude Code transcript JSONL
 * and write it to a temp file.
 *
 * Returns the absolute path to the transcript file.
 */
export function writeTranscript(sessionID: string, messages: OpenCodeMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const role = msg.info.role;

    for (const part of msg.parts) {
      if (part.type === 'text' && 'text' in part && role === 'user') {
        lines.push(
          JSON.stringify({
            type: 'user',
            message: { content: [{ type: 'text', text: part.text }] },
          })
        );
      }

      if (part.type === 'tool' && 'tool' in part && 'callID' in part && 'state' in part) {
        // tool_use entry
        lines.push(
          JSON.stringify({
            type: 'assistant',
            message: {
              content: [
                { type: 'tool_use', name: part.tool, id: part.callID, input: part.state.input },
              ],
            },
          })
        );

        // tool_result entry (only for completed or errored tools)
        const output = getToolOutput(part.state);
        if (output !== undefined) {
          lines.push(
            JSON.stringify({
              type: 'tool_result',
              message: {
                content: [{ type: 'tool_result', content: output, tool_use_id: part.callID }],
              },
            })
          );
        }
      }
    }
  }

  const dir = `${tmpdir()}/probity-transcripts`;
  mkdirSync(dir, { recursive: true });

  const filePath = `${dir}/${sessionID}.jsonl`;
  writeFileSync(filePath, lines.join('\n') + '\n');
  return filePath;
}

function getToolOutput(state: ToolState): string | undefined {
  if (state.status === 'completed') {
    return state.output;
  }
  if (state.status === 'error') {
    return `Error: ${state.error}`;
  }
  return undefined;
}
