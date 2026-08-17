/**
 * Probity Debug Plugin for OpenCode
 * 
 * Enables debug logging for all Probity rule evaluations.
 * Debug logs are written to ~/.cache/opencode/probity-debug.jsonl
 */

import type { Plugin } from '@opencode-ai/plugin';
import { createProbityHook } from '../../dist/index.js';

export const ProbityDebugPlugin: Plugin = async () => {
  const debugPath = `${process.env.HOME}/.cache/opencode/probity-debug.jsonl`;

  console.log(`[Probity] Debug logging enabled: ${debugPath}`);

  const hook = createProbityHook({
    debugPath,
  });

  return {
    'tool.execute.before': hook,
  };
};
