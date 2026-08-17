/**
 * GitHub Copilot preToolUse hook payload format.
 * Probity expects this envelope when invoked with --agent github-copilot.
 *
 * Key detail: toolArgs is a JSON *string* on the wire, not a parsed object.
 */
export interface CopilotHookPayload {
  sessionId: string;
  timestamp: number;
  cwd: string;
  toolName: string;
  toolArgs: string;
}

/**
 * Legacy alias kept for backward compatibility with adapter imports.
 */
export type ProbityAction = CopilotHookPayload;

/**
 * Translate a bash command from OpenCode Bash tool
 * to a GitHub Copilot preToolUse hook payload.
 *
 * Copilot tool name: "bash"
 * toolArgs schema: { command: string }
 *
 * @param command - The bash command string
 * @returns Copilot hook payload
 */
export function translateBashToProbityAction(command: string): CopilotHookPayload {
  return {
    sessionId: 'opencode',
    timestamp: Date.now(),
    cwd: process.cwd(),
    toolName: 'bash',
    toolArgs: JSON.stringify({ command }),
  };
}

/**
 * Translate a write operation from OpenCode Write tool
 * to a GitHub Copilot preToolUse hook payload.
 *
 * Copilot tool name: "create"
 * toolArgs schema: { path: string, file_text: string }
 *
 * @param filePath - The absolute file path
 * @param content - The file content being written
 * @returns Copilot hook payload
 */
export function translateWriteToProbityAction(
  filePath: string,
  content: string
): CopilotHookPayload {
  return {
    sessionId: 'opencode',
    timestamp: Date.now(),
    cwd: process.cwd(),
    toolName: 'create',
    toolArgs: JSON.stringify({ path: filePath, file_text: content }),
  };
}

/**
 * Translate an edit operation from OpenCode Edit tool
 * to a GitHub Copilot preToolUse hook payload.
 *
 * Copilot tool name: "edit"
 * toolArgs schema: { path: string, old_str: string, new_str: string }
 *
 * Since OpenCode's Edit tool provides the new content but not necessarily the
 * old content, we use the content as new_str and leave old_str empty. This
 * signals to probity that the file is being modified.
 *
 * @param filePath - The absolute file path
 * @param newContent - The new file content
 * @returns Copilot hook payload
 */
export function translateEditToProbityAction(
  filePath: string,
  newContent: string
): CopilotHookPayload {
  return {
    sessionId: 'opencode',
    timestamp: Date.now(),
    cwd: process.cwd(),
    toolName: 'edit',
    toolArgs: JSON.stringify({ path: filePath, old_str: '', new_str: newContent }),
  };
}
