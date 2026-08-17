/**
 * Probity action payload for the claude-code agent adapter.
 *
 * This matches the Claude Code PreToolUse hook schema that probity
 * validates via Zod. Fields not needed by probity (session_id, etc.)
 * are omitted — probity's safeParse ignores extra/missing fields
 * outside the discriminated union.
 */
export interface ProbityAction {
  tool_name: string;
  tool_input: Record<string, unknown>;
  cwd: string;
  transcript_path?: string;
}

/**
 * Build a probity payload from an OpenCode tool call.
 *
 * OpenCode tool names (Bash, Write, Edit, NotebookEdit) already match
 * the claude-code adapter's PascalCase expectations. The tool_input
 * fields are mapped to the schema probity validates:
 *
 *   Bash  → { command }
 *   Write → { file_path, content }
 *   Edit  → { file_path, old_string, new_string }
 *
 * Returns null if the args are insufficient for the given tool.
 */
export function buildProbityPayload(
  toolName: string,
  args: { command?: string; filePath?: string; content?: string; [key: string]: unknown },
  transcriptPath?: string
): ProbityAction | null {
  const cwd = process.cwd();
  const base = { cwd, ...(transcriptPath ? { transcript_path: transcriptPath } : {}) };

  switch (toolName) {
    case 'Bash': {
      if (!args.command || typeof args.command !== 'string') {
        return null;
      }
      return { tool_name: 'Bash', tool_input: { command: args.command }, ...base };
    }

    case 'Write': {
      if (
        !args.filePath ||
        typeof args.filePath !== 'string' ||
        args.content === undefined ||
        typeof args.content !== 'string'
      ) {
        return null;
      }
      return {
        tool_name: 'Write',
        tool_input: { file_path: args.filePath, content: args.content },
        ...base,
      };
    }

    case 'Edit': {
      if (
        !args.filePath ||
        typeof args.filePath !== 'string' ||
        args.content === undefined ||
        typeof args.content !== 'string'
      ) {
        return null;
      }
      return {
        tool_name: 'Edit',
        tool_input: { file_path: args.filePath, old_string: '', new_string: args.content },
        ...base,
      };
    }

    case 'NotebookEdit': {
      if (
        !args.filePath ||
        typeof args.filePath !== 'string' ||
        args.content === undefined ||
        typeof args.content !== 'string'
      ) {
        return null;
      }
      return {
        tool_name: 'NotebookEdit',
        tool_input: { notebook_path: args.filePath, new_source: args.content },
        ...base,
      };
    }

    default:
      return null;
  }
}
