import { spawn as defaultSpawn } from 'child_process';
import type { ChildProcess } from 'child_process';

/**
 * Native OpenCode payload shape expected by probity's `--agent opencode` adapter.
 * Mirrors the `tool.execute.before` hook input/output verbatim (camelCase args),
 * so no translation is needed before handing it to the probity CLI.
 */
export interface ProbityAction {
  tool: string;
  sessionID?: string;
  callID?: string;
  args: Record<string, unknown>;
  cwd: string;
  transcript_path?: string;
}

/**
 * Flat response shape probity's opencode adapter emits (matches Codex's format).
 * Allow is represented as empty stdout rather than a JSON body.
 */
interface ProbityResponse {
  decision: string;
  reason?: string;
}

/**
 * Probity verdict — the plugin's internal representation.
 */
export type ProbityVerdict = { kind: 'pass' } | { kind: 'violation'; reason: string };

/**
 * The npm/npx package spec to invoke for probity's CLI. Defaults to the
 * published package; overridable to point at a fork or branch that isn't
 * released yet (e.g. while nizos/probity#65 is still under review).
 */
const DEFAULT_PACKAGE_SPEC = '@nizos/probity';

interface ProbityAdapterOptions {
  configPath?: string;
  debugPath?: string;
  packageSpec?: string;
  spawn?: typeof defaultSpawn;
}

/**
 * Adapter that spawns the probity CLI with --agent opencode
 * and translates its response into a ProbityVerdict.
 */
export class ProbityAdapter {
  private configPath?: string;
  private debugPath?: string;
  private packageSpec: string;
  private spawn: typeof defaultSpawn;

  constructor(options?: ProbityAdapterOptions) {
    this.configPath = options?.configPath;
    this.debugPath = options?.debugPath;
    this.packageSpec = options?.packageSpec ?? DEFAULT_PACKAGE_SPEC;
    this.spawn = options?.spawn ?? defaultSpawn;
  }

  async evaluateAction(action: ProbityAction): Promise<ProbityVerdict> {
    return new Promise((resolve) => {
      const args = [this.packageSpec, '--agent', 'opencode'];

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
        // Non-zero exit or empty stdout → pass (safe-fail / "no opinion" / allow)
        if (code !== 0 || !stdoutData.trim()) {
          resolve({ kind: 'pass' });
          return;
        }

        try {
          const response = JSON.parse(stdoutData) as ProbityResponse;

          if (response.decision === 'block') {
            resolve({
              kind: 'violation',
              reason: response.reason ?? 'Blocked by probity rule',
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
