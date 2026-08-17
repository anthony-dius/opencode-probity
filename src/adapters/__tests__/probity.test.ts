import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProbityAdapter } from '../probity.ts';
import type { ProbityAction } from '../../translators/payload.ts';
import { EventEmitter } from 'events';

/**
 * Mock child process that emulates actual subprocess behavior
 */
class MockChildProcess extends EventEmitter {
  stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };

  stdout = new EventEmitter();
  stderr = new EventEmitter();

  emitStdout(data: string) {
    this.stdout.emit('data', Buffer.from(data));
  }

  emitClose(code: number) {
    this.emit('close', code);
  }
}

describe('ProbityAdapter', () => {
  describe('constructor', () => {
    it('should create an adapter instance with default options', () => {
      const adapter = new ProbityAdapter();
      expect(adapter).toBeDefined();
    });

    it('should accept config path option', () => {
      const adapter = new ProbityAdapter({ configPath: '/path/to/probity.config.ts' });
      expect(adapter).toBeDefined();
    });

    it('should accept debug option', () => {
      const adapter = new ProbityAdapter({ debug: true });
      expect(adapter).toBeDefined();
    });

    it('should accept custom spawn function', () => {
      const mockSpawn = vi.fn();
      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      expect(adapter).toBeDefined();
    });
  });

  describe('evaluateAction', () => {
    it('should evaluate a bash command action and return pass verdict', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'npm install',
      };

      // Set up the async response
      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result).toEqual({
        kind: 'pass',
      });
    });

    it('should evaluate a write action and return violation verdict with reason', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'write',
        path: '/project/src/file.ts',
        content: 'export const x = 1;',
      };

      const resultPromise = adapter.evaluateAction(action);
      const violationReason = 'Missing test for this implementation';
      mockProc.emitStdout(
        JSON.stringify({
          kind: 'violation',
          reason: violationReason,
        })
      );
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result).toEqual({
        kind: 'violation',
        reason: violationReason,
      });
    });

    it('should default to pass on subprocess error', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'npm run build',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitClose(1); // Non-zero exit code

      const result = await resultPromise;

      // Should default to 'pass' on error (safe-fail approach)
      expect(result.kind).toBe('pass');
    });

    it('should default to pass when stdout is empty', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'echo test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result.kind).toBe('pass');
    });

    it('should pass the action to probity via stdin as JSON', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'write',
        path: '/project/file.ts',
        content: 'test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockProc.stdin.write).toHaveBeenCalledWith(JSON.stringify(action));
      expect(mockProc.stdin.end).toHaveBeenCalled();
    });

    it('should default to pass on JSON parse error', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout('invalid json {[}');
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result.kind).toBe('pass');
    });
  });

  describe('GitHub Copilot hook payload format', () => {
    it('should spawn probity with --agent github-copilot flag', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'npm run test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['@nizos/probity', '--agent', 'github-copilot']),
        expect.any(Object)
      );
    });

    it('should include --config flag when configPath is provided', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);
      const configPath = '/path/to/config.ts';

      const adapter = new ProbityAdapter({
        spawn: mockSpawn as any,
        configPath,
      });
      const action: ProbityAction = {
        kind: 'command',
        command: 'npm install',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['--config', configPath]),
        expect.any(Object)
      );
    });

    it('should use stdio pipe configuration', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith('npx', expect.any(Array), {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });
  });

  describe('verdict parsing', () => {
    it('should parse pass verdict from probity response', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'echo test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result.kind).toBe('pass');
    });

    it('should parse violation verdict with reason', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'write',
        path: '/project/file.ts',
        content: 'test',
      };

      const violationReason = 'This violates the TDD rule';
      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(
        JSON.stringify({
          kind: 'violation',
          reason: violationReason,
        })
      );
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result.kind).toBe('violation');
      expect(result.reason).toBe(violationReason);
    });
  });

  describe('debug option', () => {
    it('should include --debug flag when debugPath is provided', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);
      const debugPath = '/tmp/probity-debug.jsonl';

      const adapter = new ProbityAdapter({
        spawn: mockSpawn as any,
        debugPath,
      });
      const action: ProbityAction = {
        kind: 'command',
        command: 'npm run test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['--debug', debugPath]),
        expect.any(Object)
      );
    });

    it('should not include --debug flag when debugPath is not provided', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action: ProbityAction = {
        kind: 'command',
        command: 'echo test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      await resultPromise;

      const callArgs = mockSpawn.mock.calls[0];
      expect(callArgs[1]).not.toEqual(expect.arrayContaining(['--debug']));
    });

    it('should work with both --config and --debug flags', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);
      const configPath = '/path/to/config.ts';
      const debugPath = '/tmp/probity-debug.jsonl';

      const adapter = new ProbityAdapter({
        spawn: mockSpawn as any,
        configPath,
        debugPath,
      });
      const action: ProbityAction = {
        kind: 'command',
        command: 'test',
      };

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ kind: 'pass' }));
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['--config', configPath, '--debug', debugPath]),
        expect.any(Object)
      );
    });
  });
});
