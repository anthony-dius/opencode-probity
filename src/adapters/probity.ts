import { spawn as defaultSpawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import type { ProbityAction } from '../translators/payload.ts';

/**
 * Probity verdict response types (internal to the plugin)
 */
export type ProbityVerdict =
  | { kind: 'pass' }
  | { kind: 'violation'; reason: string };

/**
 * GitHub Copilot hook response format returned by probity CLI
 */
interface CopilotHookResponse {
  permissionDecision: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
}

/**
 * ProbityAdapter options
 */
interface ProbityAdapterOptions {
  configPath?: string;
  debug?: boolean;
  debugPath?: string;
  spawn?: typeof defaultSpawn;
}

/**
 * Adapter that communicates with probity CLI
 * Sends GitHub Copilot preToolUse hook payloads and translates
 * Copilot hook responses back to internal verdict types.
 */
export class ProbityAdapter {
  private configPath?: string;
  private debug: boolean;
  private debugPath?: string;
  private spawn: typeof defaultSpawn;

  constructor(options?: ProbityAdapterOptions) {
    this.configPath = options?.configPath;
    this.debug = options?.debug ?? false;
    this.debugPath = options?.debugPath;
    this.spawn = options?.spawn ?? defaultSpawn;
  }

  /**
   * Evaluate an action against probity rules
   * Spawns probity subprocess and returns verdict
   *
   * @param action - The Copilot hook payload to evaluate
   * @returns Promise resolving to probity verdict
   */
  async evaluateAction(action: ProbityAction): Promise<ProbityVerdict> {
    return new Promise((resolve) => {
      // Build the probity CLI arguments
      const args = ['@nizos/probity', '--agent', 'github-copilot'];

      if (this.configPath) {
        args.push('--config', this.configPath);
      }

      if (this.debugPath) {
        args.push('--debug', this.debugPath);
      }

      // Spawn probity subprocess
      const proc = this.spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as ChildProcess;

      let stdoutData = '';

      // Collect stdout data
      proc.stdout?.on('data', (data: Buffer) => {
        stdoutData += data.toString();
      });

      // Handle process close
      proc.on('close', (code: number) => {
        // If subprocess exited with error, default to pass (safe-fail)
        if (code !== 0) {
          resolve({ kind: 'pass' });
          return;
        }

        // Empty stdout means "no opinion" — probity allows the action
        if (!stdoutData.trim()) {
          resolve({ kind: 'pass' });
          return;
        }

        try {
          const response = JSON.parse(stdoutData) as CopilotHookResponse;
          resolve(this.translateCopilotResponse(response));
        } catch {
          // If JSON parsing fails, default to pass (safe-fail)
          resolve({ kind: 'pass' });
        }
      });

      // Send the Copilot hook payload to probity via stdin
      proc.stdin?.write(JSON.stringify(action));
      proc.stdin?.end();
    });
  }

  /**
   * Translate a GitHub Copilot hook response to an internal ProbityVerdict.
   *
   * - "allow" or empty → pass
   * - "deny" or "ask"  → violation with reason
   */
  private translateCopilotResponse(response: CopilotHookResponse): ProbityVerdict {
    if (response.permissionDecision === 'allow') {
      return { kind: 'pass' };
    }

    return {
      kind: 'violation',
      reason: response.permissionDecisionReason ?? 'Blocked by probity rule',
    };
  }
}
