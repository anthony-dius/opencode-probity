import { ProbityAdapter } from '../adapters/probity.ts';
import {
  translateBashToProbityAction,
  translateWriteToProbityAction,
  translateEditToProbityAction,
} from '../translators/payload.ts';
import { findProbityConfig } from '../config/discovery.ts';

/**
 * Hook options
 */
interface ProbityHookOptions {
  adapter?: ProbityAdapter;
  debug?: boolean;
  configPath?: string;
  debugPath?: string;
}

/**
 * OpenCode tool hook input/output types
 */
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

/**
 * Create a Probity hook for OpenCode tool.execute.before event
 * This hook intercepts Bash, Write, Edit, and NotebookEdit tool calls
 * and runs them against probity rules
 *
 * @param options - Hook configuration
 * @returns Hook function for tool.execute.before event
 */
export function createProbityHook(options?: ProbityHookOptions) {
  let adapter = options?.adapter;
  const debug = options?.debug ?? false;
  const configPath = options?.configPath;
  const debugPath = options?.debugPath;

  return async (input: ToolInput, output: ToolOutput): Promise<void> => {
    // Determine if this tool should be evaluated
    const shouldEvaluate = shouldEvaluateTool(input.tool);

    if (!shouldEvaluate) {
      return;
    }

    try {
      // Initialize adapter if not provided
      if (!adapter) {
        // Discover config file if not explicitly provided
        let resolvedConfigPath = configPath;
        if (!resolvedConfigPath) {
          resolvedConfigPath = await findProbityConfig(process.cwd());
        }

        adapter = new ProbityAdapter({
          configPath: resolvedConfigPath,
          debug,
          debugPath,
        });
      }

      // Translate tool call to probity action
      const action = translateToolToAction(input.tool, output.args);

      if (!action) {
        // Skip if unable to translate
        return;
      }

      // Evaluate action against probity rules
      const verdict = await adapter.evaluateAction(action);

      // Handle verdict
      if (verdict.kind === 'violation') {
        output.block = {
          reason: verdict.reason,
        };
      }
    } catch (error) {
      // Safe-fail: allow tool execution on error
      if (debug) {
        console.error('[PROBITY HOOK ERROR]', error);
      }
    }
  };
}

/**
 * Determine if a tool should be evaluated by probity
 * Matches: Bash, Write, Edit, NotebookEdit
 */
function shouldEvaluateTool(toolName: string): boolean {
  const evaluatedTools = ['Bash', 'Write', 'Edit', 'NotebookEdit'];
  return evaluatedTools.includes(toolName);
}

/**
 * Translate OpenCode tool call to probity action
 */
function translateToolToAction(
  toolName: string,
  args: { command?: string; filePath?: string; content?: string; [key: string]: unknown }
) {
  switch (toolName) {
    case 'Bash':
      if (!args.command || typeof args.command !== 'string') {
        return null;
      }
      return translateBashToProbityAction(args.command);

    case 'Write':
      if (
        !args.filePath ||
        typeof args.filePath !== 'string' ||
        args.content === undefined ||
        typeof args.content !== 'string'
      ) {
        return null;
      }
      return translateWriteToProbityAction(args.filePath, args.content);

    case 'Edit':
      if (
        !args.filePath ||
        typeof args.filePath !== 'string' ||
        args.content === undefined ||
        typeof args.content !== 'string'
      ) {
        return null;
      }
      return translateEditToProbityAction(args.filePath, args.content);

    case 'NotebookEdit':
      if (
        !args.filePath ||
        typeof args.filePath !== 'string' ||
        args.content === undefined ||
        typeof args.content !== 'string'
      ) {
        return null;
      }
      // NotebookEdit is treated as a write action
      return translateWriteToProbityAction(args.filePath, args.content);

    default:
      return null;
  }
}
