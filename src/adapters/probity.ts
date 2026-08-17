import { spawn as defaultSpawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import type { ProbityAction } from '../translators/payload.ts';

/**
 * Probity verdict — the plugin's internal representation.
 */
export type ProbityVerdict =
  | { kind: 'pass' }
  | { kind: 'violation'; reason: string };

/**
 * Claude Code hook response shape returned by probity CLI.
 */
interface ClaudeCodeHookResponse {
  hookSpecificOutput: {
    permissionDecision: 'allow' | 'deny';
    permissionDecisionReason?: string;
  };
}

interface ProbityAdapterOptions {
  configPath?: string;
  debug?: boolean;
  debugPath?: string;
  spawn?: typeof defaultSpawn;
}

/**
 * Adapter that spawns the probity CLI with --agent claude-code
 * and translates its response into a ProbityVerdict.
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

  async evaluateAction(action: ProbityAction): Promise<ProbityVerdict> {
    return new Promise((resolve) => {
      const args = ['@nizos/probity', '--agent', 'claude-code'];

      if (this.configPath) {
        args.push('--config', this.configPath);
      }

      if (this.debugPath) {
        args.push('--debug', this.debugPath);
      }

      const proc = this.spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as ChildProcess;

      let stdoutData = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdoutData += data.toString();
      });

      proc.on('close', (code: number) => {
        // Non-zero exit or empty stdout → pass (safe-fail / "no opinion")
        if (code !== 0 || !stdoutData.trim()) {
          resolve({ kind: 'pass' });
          return;
        }

        try {
          const response = JSON.parse(stdoutData) as ClaudeCodeHookResponse;
          const decision = response.hookSpecificOutput;

          if (decision.permissionDecision === 'deny') {
            resolve({
              kind: 'violation',
              reason: decision.permissionDecisionReason ?? 'Blocked by probity rule',
            });
          } else {
            resolve({ kind: 'pass' });
          }
        } catch {
          resolve({ kind: 'pass' });
        }
      });

      proc.stdin?.write(JSON.stringify(action));
      proc.stdin?.end();
    });
  }
}
