import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createProbityHook, resolveDebugPath } from '../preToolUse.ts';

function mockAdapter(verdict: { kind: 'pass' } | { kind: 'violation'; reason: string }) {
  return { evaluateAction: vi.fn(async () => verdict) };
}

describe('createProbityHook', () => {
  afterEach(() => vi.clearAllMocks());

  it('should return a function', () => {
    expect(typeof createProbityHook()).toBe('function');
  });

  describe('tool matching', () => {
    it.each(['bash', 'write', 'edit', 'Bash', 'Write', 'Edit'])(
      'should evaluate %s',
      async (tool) => {
        const adapter = mockAdapter({ kind: 'pass' });
        const hook = createProbityHook({ adapter: adapter as any });

        const args =
          tool.toLowerCase() === 'bash'
            ? { command: 'echo hi' }
            : { filePath: '/f.ts', content: 'x' };
        await hook({ tool }, { args });

        expect(adapter.evaluateAction).toHaveBeenCalled();
      }
    );

    it.each(['read', 'grep', 'glob', 'notebookedit', 'Read', 'Grep', 'Glob', 'NotebookEdit'])(
      'should skip %s',
      async (tool) => {
        const adapter = mockAdapter({ kind: 'pass' });
        const hook = createProbityHook({ adapter: adapter as any });

        await hook({ tool }, { args: {} });

        expect(adapter.evaluateAction).not.toHaveBeenCalled();
      }
    );
  });

  describe('verdicts', () => {
    it('should not block on pass', async () => {
      const hook = createProbityHook({ adapter: mockAdapter({ kind: 'pass' }) as any });
      const output: any = { args: { command: 'echo hi' } };

      await hook({ tool: 'Bash' }, output);

      expect(output.block).toBeUndefined();
    });

    it('should block on violation with reason', async () => {
      const hook = createProbityHook({
        adapter: mockAdapter({ kind: 'violation', reason: 'Missing test' }) as any,
      });
      const output: any = { args: { filePath: '/f.ts', content: 'x' } };

      await hook({ tool: 'Write' }, output);

      expect(output.block).toEqual({ reason: 'Missing test' });
    });
  });

  describe('payload', () => {
    it('should pass the tool, sessionID, callID, and raw args through unchanged', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook(
        { tool: 'Bash', sessionID: 'ses_1', callID: 'call_1' },
        { args: { command: 'npm test' } }
      );

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.tool).toBe('Bash');
      expect(payload.sessionID).toBe('ses_1');
      expect(payload.callID).toBe('call_1');
      expect(payload.args).toEqual({ command: 'npm test' });
    });

    it('should pass Write args through with camelCase filePath', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool: 'Write' }, { args: { filePath: '/f.ts', content: 'x' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.tool).toBe('Write');
      expect(payload.args).toEqual({ filePath: '/f.ts', content: 'x' });
    });

    it('should pass Edit args through with oldString and newString', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook(
        { tool: 'Edit' },
        { args: { filePath: '/f.ts', oldString: 'old', newString: 'new' } }
      );

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.tool).toBe('Edit');
      expect(payload.args).toEqual({ filePath: '/f.ts', oldString: 'old', newString: 'new' });
    });

    it('should include cwd', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool: 'Bash' }, { args: { command: 'echo hi' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.cwd).toBe(process.cwd());
    });
  });

  describe('session transcript', () => {
    it('should include transcript_path when client and sessionID are provided', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const client = {
        session: {
          messages: vi.fn(async () => ({
            data: [
              {
                info: { role: 'user', id: 'u1' },
                parts: [{ type: 'text', text: 'Add a feature' }],
              },
            ],
          })),
        },
      };

      const hook = createProbityHook({ adapter: adapter as any, client: client as any });
      await hook({ tool: 'Bash', sessionID: 'sess-1' }, { args: { command: 'echo hi' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.transcript_path).toBeDefined();
      expect(typeof payload.transcript_path).toBe('string');
    });

    it('should omit transcript_path when client is not provided', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool: 'Bash', sessionID: 'sess-1' }, { args: { command: 'echo hi' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.transcript_path).toBeUndefined();
    });

    it('should omit transcript_path when sessionID is missing', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const client = {
        session: { messages: vi.fn(async () => ({ data: [] })) },
      };
      const hook = createProbityHook({ adapter: adapter as any, client: client as any });

      await hook({ tool: 'Bash' }, { args: { command: 'echo hi' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.transcript_path).toBeUndefined();
      expect(client.session.messages).not.toHaveBeenCalled();
    });

    it('should proceed without transcript if client call fails', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const client = {
        session: {
          messages: vi.fn(async () => {
            throw new Error('network error');
          }),
        },
      };
      const hook = createProbityHook({ adapter: adapter as any, client: client as any });

      await hook({ tool: 'Bash', sessionID: 'sess-1' }, { args: { command: 'echo hi' } });

      // Should still evaluate, just without transcript
      expect(adapter.evaluateAction).toHaveBeenCalled();
      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.transcript_path).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should allow on adapter error (safe-fail)', async () => {
      const adapter = {
        evaluateAction: vi.fn(async () => {
          throw new Error('boom');
        }),
      };
      const hook = createProbityHook({ adapter: adapter as any });
      const output: any = { args: { filePath: '/f.ts', content: 'x' } };

      await hook({ tool: 'Write' }, output);

      expect(output.block).toBeUndefined();
    });
  });

  describe('resolveDebugPath', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      delete process.env.PROBITY_DEBUG;
      delete process.env.OPENCODE_PROBITY_DEBUG;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should return undefined when no debug options or env vars are set', () => {
      expect(resolveDebugPath()).toBeUndefined();
    });

    it('should return explicit path from debugOption', () => {
      expect(resolveDebugPath('/tmp/custom-debug.jsonl')).toBe('/tmp/custom-debug.jsonl');
    });

    it('should expand "1" to default home cache path', () => {
      process.env.HOME = '/test/home';
      expect(resolveDebugPath('1')).toBe('/test/home/.cache/opencode/probity-debug.jsonl');
    });

    it('should expand "true" to default home cache path', () => {
      process.env.HOME = '/test/home';
      expect(resolveDebugPath('true')).toBe('/test/home/.cache/opencode/probity-debug.jsonl');
    });

    it('should read from PROBITY_DEBUG environment variable', () => {
      process.env.PROBITY_DEBUG = '/tmp/from-env.jsonl';
      expect(resolveDebugPath()).toBe('/tmp/from-env.jsonl');
    });

    it('should prioritize OPENCODE_PROBITY_DEBUG over PROBITY_DEBUG', () => {
      process.env.PROBITY_DEBUG = '/tmp/probity.jsonl';
      process.env.OPENCODE_PROBITY_DEBUG = '/tmp/opencode.jsonl';
      expect(resolveDebugPath()).toBe('/tmp/opencode.jsonl');
    });

    it('should prioritize explicit parameter over environment variables', () => {
      process.env.PROBITY_DEBUG = '/tmp/from-env.jsonl';
      expect(resolveDebugPath('/tmp/explicit.jsonl')).toBe('/tmp/explicit.jsonl');
    });
  });
});
