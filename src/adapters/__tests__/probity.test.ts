import { describe, it, expect, vi } from 'vitest';
import { ProbityAdapter } from '../probity.ts';
import type { ProbityAction } from '../probity.ts';
import { EventEmitter } from 'events';

class MockChildProcess extends EventEmitter {
  stdin = { write: vi.fn(), end: vi.fn() };
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  emitStdout(data: string) {
    this.stdout.emit('data', Buffer.from(data));
  }

  emitClose(code: number) {
    this.emit('close', code);
  }
}

function bashPayload(): ProbityAction {
  return { tool: 'Bash', args: { command: 'npm test' }, cwd: '/workspace' };
}

function writePayload(): ProbityAction {
  return {
    tool: 'Write',
    args: { filePath: '/src/file.ts', content: 'export const x = 1;' },
    cwd: '/workspace',
  };
}

describe('ProbityAdapter', () => {
  describe('constructor', () => {
    it('should create with defaults', () => {
      expect(new ProbityAdapter()).toBeDefined();
    });

    it('should accept all options', () => {
      expect(
        new ProbityAdapter({
          configPath: '/c.ts',
          debugPath: '/d.jsonl',
          spawn: vi.fn() as any,
        })
      ).toBeDefined();
    });
  });

  describe('evaluateAction', () => {
    it('should return pass when stdout is empty (allow)', async () => {
      const proc = new MockChildProcess();
      const adapter = new ProbityAdapter({ spawn: vi.fn(() => proc) as any });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitClose(0);

      expect(await p).toEqual({ kind: 'pass' });
    });

    it('should return pass on non-zero exit (safe-fail)', async () => {
      const proc = new MockChildProcess();
      const adapter = new ProbityAdapter({ spawn: vi.fn(() => proc) as any });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitClose(1);

      expect(await p).toEqual({ kind: 'pass' });
    });

    it('should return pass on invalid JSON (safe-fail)', async () => {
      const proc = new MockChildProcess();
      const adapter = new ProbityAdapter({ spawn: vi.fn(() => proc) as any });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitStdout('not json');
      proc.emitClose(0);

      expect(await p).toEqual({ kind: 'pass' });
    });

    it('should parse a block response as violation', async () => {
      const proc = new MockChildProcess();
      const adapter = new ProbityAdapter({ spawn: vi.fn(() => proc) as any });

      const p = adapter.evaluateAction(writePayload());
      proc.emitStdout(JSON.stringify({ decision: 'block', reason: 'Probity: Missing test' }));
      proc.emitClose(0);

      expect(await p).toEqual({ kind: 'violation', reason: 'Probity: Missing test' });
    });

    it('should treat any non-block decision as pass', async () => {
      const proc = new MockChildProcess();
      const adapter = new ProbityAdapter({ spawn: vi.fn(() => proc) as any });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitStdout(JSON.stringify({ decision: 'allow' }));
      proc.emitClose(0);

      expect(await p).toEqual({ kind: 'pass' });
    });

    it('should provide default reason when block has no reason', async () => {
      const proc = new MockChildProcess();
      const adapter = new ProbityAdapter({ spawn: vi.fn(() => proc) as any });

      const p = adapter.evaluateAction(writePayload());
      proc.emitStdout(JSON.stringify({ decision: 'block' }));
      proc.emitClose(0);

      expect(await p).toEqual({ kind: 'violation', reason: 'Blocked by probity rule' });
    });

    it('should send the payload to stdin as JSON', async () => {
      const proc = new MockChildProcess();
      const adapter = new ProbityAdapter({ spawn: vi.fn(() => proc) as any });
      const action = writePayload();

      const p = adapter.evaluateAction(action);
      proc.emitClose(0);
      await p;

      expect(proc.stdin.write).toHaveBeenCalledWith(JSON.stringify(action));
      expect(proc.stdin.end).toHaveBeenCalled();
    });
  });

  describe('CLI flags', () => {
    it('should spawn with --agent opencode', async () => {
      const proc = new MockChildProcess();
      const spawn = vi.fn(() => proc);
      const adapter = new ProbityAdapter({ spawn: spawn as any });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitClose(0);
      await p;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['@nizos/probity', '--agent', 'opencode']),
        expect.any(Object)
      );
    });

    it('should use a custom packageSpec when provided', async () => {
      const proc = new MockChildProcess();
      const spawn = vi.fn(() => proc);
      const adapter = new ProbityAdapter({
        spawn: spawn as any,
        packageSpec: 'github:anthony-dius/probity#001-opencode-vendor-support',
      });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitClose(0);
      await p;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining([
          'github:anthony-dius/probity#001-opencode-vendor-support',
          '--agent',
          'opencode',
        ]),
        expect.any(Object)
      );
    });

    it('should include --config when provided', async () => {
      const proc = new MockChildProcess();
      const spawn = vi.fn(() => proc);
      const adapter = new ProbityAdapter({ spawn: spawn as any, configPath: '/c.ts' });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitClose(0);
      await p;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['--config', '/c.ts']),
        expect.any(Object)
      );
    });

    it('should include --debug when debugPath provided', async () => {
      const proc = new MockChildProcess();
      const spawn = vi.fn(() => proc);
      const adapter = new ProbityAdapter({ spawn: spawn as any, debugPath: '/d.jsonl' });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitClose(0);
      await p;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['--debug', '/d.jsonl']),
        expect.any(Object)
      );
    });

    it('should not include --debug when debugPath not provided', async () => {
      const proc = new MockChildProcess();
      const spawn = vi.fn(() => proc);
      const adapter = new ProbityAdapter({ spawn: spawn as any });

      const p = adapter.evaluateAction(bashPayload());
      proc.emitClose(0);
      await p;

      expect(spawn.mock.calls[0][1]).not.toEqual(expect.arrayContaining(['--debug']));
    });
  });
});
