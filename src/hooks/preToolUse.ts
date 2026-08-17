import { ProbityAdapter } from '../adapters/probity.ts';
import { buildProbityPayload } from '../translators/payload.ts';
import { writeTranscript } from '../translators/transcript.ts';
import { findProbityConfig } from '../config/discovery.ts';

/**
 * Minimal client interface — only the method we need.
 * Avoids a hard dependency on @opencode-ai/sdk types.
 */
interface SessionClient {
  session: {
    messages(opts: { path: { id: string } }): Promise<{ data?: unknown[] }>;
  };
}

interface ProbityHookOptions {
  adapter?: ProbityAdapter;
  client?: SessionClient;
  debug?: boolean;
  configPath?: string;
  debugPath?: string;
}

interface ToolInput {
  tool: string;
  sessionID?: string;
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
  const client = options?.client;
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

      // Build transcript if we have a client and session ID
      let transcriptPath: string | undefined;
      if (client && input.sessionID) {
        try {
          const result = await client.session.messages({ path: { id: input.sessionID } });
          if (result.data && Array.isArray(result.data)) {
            transcriptPath = writeTranscript(input.sessionID, result.data as any);
          }
        } catch {
          // Transcript is best-effort — proceed without it
        }
      }

      const payload = buildProbityPayload(input.tool, output.args, transcriptPath);

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
