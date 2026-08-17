import { spawn as defaultSpawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import type { ProbityAction } from '../translators/payload.ts';

/**
 * Probity verdict response types
 */
export type ProbityVerdict =
  | { kind: 'pass' }
  | { kind: 'violation'; reason: string };

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
 * Emulates the GitHub Copilot hook interface
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
   * @param action - The probity action to evaluate
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
        // If subprocess exited with error or no valid response, default to pass
        if (code !== 0 || !stdoutData.trim()) {
          resolve({ kind: 'pass' });
          return;
        }

        try {
          const verdict = JSON.parse(stdoutData) as ProbityVerdict;
          resolve(verdict);
        } catch {
          // If JSON parsing fails, default to pass (safe-fail)
          resolve({ kind: 'pass' });
        }
      });

      // Send the action to probity via stdin
      proc.stdin?.write(JSON.stringify(action));
      proc.stdin?.end();
    });
  }
}
