import { ProbityAdapter } from '../adapters/probity.ts';
import { buildProbityPayload } from '../translators/payload.ts';
import { findProbityConfig } from '../config/discovery.ts';

interface ProbityHookOptions {
  adapter?: ProbityAdapter;
  debug?: boolean;
  configPath?: string;
  debugPath?: string;
}

interface ToolInput {
  tool: string;
}

interface ToolOutput {
  args: {
    command?: string;
    filePath?: string;
    content?: string;
    [key: string]: unknown;
  };
  allow?: boolean;
  block?: {
    reason: string;
  };
}

const EVALUATED_TOOLS = new Set(['Bash', 'Write', 'Edit', 'NotebookEdit']);

/**
 * Create a Probity hook for OpenCode's tool.execute.before event.
 */
export function createProbityHook(options?: ProbityHookOptions) {
  let adapter = options?.adapter;
  const debug = options?.debug ?? false;
  const configPath = options?.configPath;
  const debugPath = options?.debugPath;

  return async (input: ToolInput, output: ToolOutput): Promise<void> => {
    if (!EVALUATED_TOOLS.has(input.tool)) {
      return;
    }

    try {
      if (!adapter) {
        const resolvedConfigPath = configPath ?? (await findProbityConfig(process.cwd()));

        adapter = new ProbityAdapter({
          configPath: resolvedConfigPath,
          debug,
          debugPath,
        });
      }

      const payload = buildProbityPayload(input.tool, output.args);

      if (!payload) {
        return;
      }

      const verdict = await adapter.evaluateAction(payload);

      if (verdict.kind === 'violation') {
        output.block = { reason: verdict.reason };
      }
    } catch (error) {
      if (debug) {
        const message = error instanceof Error ? error.toString() : String(error);
        console.error('[PROBITY HOOK ERROR]', message);
      }
    }
  };
}
