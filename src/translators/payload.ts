/**
 * Probity Action type definitions
 * These represent the canonical actions that probity rules evaluate
 */
export type ProbityAction =
  | { kind: 'command'; command: string }
  | { kind: 'write'; path: string; content: string };

/**
 * Translate a bash command from OpenCode Bash tool
 * to a probity command action
 *
 * @param command - The bash command string
 * @returns Probity command action
 */
export function translateBashToProbityAction(command: string): ProbityAction {
  return {
    kind: 'command',
    command,
  };
}

/**
 * Translate a write operation from OpenCode Write tool
 * to a probity write action
 *
 * @param filePath - The absolute file path
 * @param content - The file content being written
 * @returns Probity write action
 */
export function translateWriteToProbityAction(
  filePath: string,
  content: string
): ProbityAction {
  return {
    kind: 'write',
    path: filePath,
    content,
  };
}

/**
 * Translate an edit operation from OpenCode Edit tool
 * to a probity write action (probity treats edit as write)
 *
 * @param filePath - The absolute file path
 * @param newContent - The new file content
 * @returns Probity write action
 */
export function translateEditToProbityAction(
  filePath: string,
  newContent: string
): ProbityAction {
  return {
    kind: 'write',
    path: filePath,
    content: newContent,
  };
}
