import type { Plugin } from '@opencode-ai/plugin';
import { createProbityHook } from '../../dist/index.js';

export const ProbityDebugPlugin: Plugin = async ({ client }) => {
  const debugPath = `${process.env.HOME}/.cache/opencode/probity-debug.jsonl`;

  const hook = createProbityHook({ client, debugPath });

  return {
    'tool.execute.before': hook,
  };
};
