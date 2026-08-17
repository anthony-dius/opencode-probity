import { describe, it, expect, vi } from 'vitest';
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

/**
 * Helper to create a valid Copilot hook payload for tests
 */
function makeBashPayload(command: string): ProbityAction {
  return {
    sessionId: 'opencode',
    timestamp: Date.now(),
    cwd: '/workspace',
    toolName: 'bash',
    toolArgs: JSON.stringify({ command }),
  };
}

function makeCreatePayload(path: string, content: string): ProbityAction {
  return {
    sessionId: 'opencode',
    timestamp: Date.now(),
    cwd: '/workspace',
    toolName: 'create',
    toolArgs: JSON.stringify({ path, file_text: content }),
  };
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
      const action = makeBashPayload('npm install');

      // Empty stdout means "allow" in Copilot hook protocol
      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result).toEqual({ kind: 'pass' });
    });

    it('should translate Copilot allow response to pass verdict', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeBashPayload('npm install');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(
        JSON.stringify({ permissionDecision: 'allow' })
      );
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result).toEqual({ kind: 'pass' });
    });

    it('should translate Copilot deny response to violation verdict', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeCreatePayload('/project/src/file.ts', 'export const x = 1;');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(
        JSON.stringify({
          permissionDecision: 'deny',
          permissionDecisionReason: 'Missing test for this implementation',
        })
      );
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result).toEqual({
        kind: 'violation',
        reason: 'Missing test for this implementation',
      });
    });

    it('should translate Copilot ask response to violation verdict', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeCreatePayload('/project/src/file.ts', 'test');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(
        JSON.stringify({
          permissionDecision: 'ask',
          permissionDecisionReason: 'Needs review',
        })
      );
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result).toEqual({
        kind: 'violation',
        reason: 'Needs review',
      });
    });

    it('should provide default reason when deny has no reason', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeCreatePayload('/project/src/file.ts', 'test');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(
        JSON.stringify({ permissionDecision: 'deny' })
      );
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result).toEqual({
        kind: 'violation',
        reason: 'Blocked by probity rule',
      });
    });

    it('should default to pass on subprocess error', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeBashPayload('npm run build');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitClose(1); // Non-zero exit code

      const result = await resultPromise;

      expect(result.kind).toBe('pass');
    });

    it('should default to pass when stdout is empty (Copilot allow)', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeBashPayload('echo test');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result.kind).toBe('pass');
    });

    it('should pass the Copilot hook payload to probity via stdin as JSON', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeCreatePayload('/project/file.ts', 'test');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockProc.stdin.write).toHaveBeenCalledWith(JSON.stringify(action));
      expect(mockProc.stdin.end).toHaveBeenCalled();
    });

    it('should default to pass on JSON parse error', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeBashPayload('test');

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
      const action = makeBashPayload('npm run test');

      const resultPromise = adapter.evaluateAction(action);
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
      const action = makeBashPayload('npm install');

      const resultPromise = adapter.evaluateAction(action);
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
      const action = makeBashPayload('test');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitClose(0);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith('npx', expect.any(Array), {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });
  });

  describe('verdict parsing from Copilot response', () => {
    it('should parse allow response as pass verdict', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeBashPayload('echo test');

      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(JSON.stringify({ permissionDecision: 'allow' }));
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result.kind).toBe('pass');
    });

    it('should parse deny response as violation verdict with reason', async () => {
      const mockProc = new MockChildProcess();
      const mockSpawn = vi.fn(() => mockProc);

      const adapter = new ProbityAdapter({ spawn: mockSpawn as any });
      const action = makeCreatePayload('/project/file.ts', 'test');

      const violationReason = 'This violates the TDD rule';
      const resultPromise = adapter.evaluateAction(action);
      mockProc.emitStdout(
        JSON.stringify({
          permissionDecision: 'deny',
          permissionDecisionReason: violationReason,
        })
      );
      mockProc.emitClose(0);

      const result = await resultPromise;

      expect(result.kind).toBe('violation');
      if (result.kind === 'violation') {
        expect(result.reason).toBe(violationReason);
      }
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
      const action = makeBashPayload('npm run test');

      const resultPromise = adapter.evaluateAction(action);
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
      const action = makeBashPayload('echo test');

      const resultPromise = adapter.evaluateAction(action);
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
      const action = makeBashPayload('test');

      const resultPromise = adapter.evaluateAction(action);
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
