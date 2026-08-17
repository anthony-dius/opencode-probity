/**
 * OpenCode Probity Plugin
 *
 * This plugin integrates Probity tool evaluation into OpenCode.
 * It intercepts tool usage (Bash, Write, Edit, NotebookEdit) and runs them
 * against probity rules configured in probity.config.ts
 *
 * Probity enforces development patterns like TDD through AI-guided rules.
 */

import type { Plugin } from '@opencode-ai/plugin';
import { createProbityHook } from './hooks/preToolUse.ts';

export { createProbityHook } from './hooks/preToolUse.ts';

/**
 * Probity Plugin for OpenCode
 *
 * Registers the tool.execute.before hook to evaluate tool usage
 * against probity rules. This enables pattern enforcement like TDD.
 */
export const ProbityPlugin: Plugin = async () => {
  const probityHook = createProbityHook();

  return {
    'tool.execute.before': probityHook,
  };
};
