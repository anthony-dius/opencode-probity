import { ProbityAdapter } from '../adapters/probity.ts';
import type { ProbityAction } from '../adapters/probity.ts';
import { writeTranscript } from '../translators/transcript.ts';
import { findProbityConfig } from '../config/discovery.ts';

/**
 * Minimal client interface — only the method we need.
 * Avoids a hard dependency on @opencode-ai/sdk types.
 */
interface SessionClient {
  session: {
    // eslint-disable-next-line no-unused-vars
    messages(opts: { path: { id: string } }): Promise<{ data?: unknown[] }>;
  };
}

interface ProbityHookOptions {
  adapter?: ProbityAdapter;
  client?: SessionClient;
  configPath?: string;
  debugPath?: string;
}

interface ToolInput {
  tool: string;
  sessionID?: string;
  callID?: string;
}

interface ToolOutput {
  args: Record<string, unknown>;
  block?: {
    reason: string;
  };
}

const EVALUATED_TOOLS = new Set(['Bash', 'Write', 'Edit']);

/**
 * `--agent opencode` isn't in a released @nizos/probity version yet
 * (nizos/probity#65 is still under review). Pin to the fork/branch that
 * implements it so the plugin works today; switch this back to
 * `@nizos/probity` once that PR merges and ships.
 */
const PROBITY_PACKAGE_SPEC = 'github:anthony-dius/probity#001-opencode-vendor-support';

/**
 * Create a Probity hook for OpenCode's tool.execute.before event.
 */
export function createProbityHook(options?: ProbityHookOptions) {
  let adapter = options?.adapter;
  const client = options?.client;
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
          debugPath,
          packageSpec: PROBITY_PACKAGE_SPEC,
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

      const payload: ProbityAction = {
        tool: input.tool,
        sessionID: input.sessionID,
        callID: input.callID,
        args: output.args,
        cwd: process.cwd(),
        ...(transcriptPath ? { transcript_path: transcriptPath } : {}),
      };

      const verdict = await adapter.evaluateAction(payload);

      if (verdict.kind === 'violation') {
        output.block = { reason: verdict.reason };
      }
    } catch {
      // Safe-fail: allow tool execution on error
    }
  };
}
