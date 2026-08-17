import { describe, it, expect, afterEach, vi } from 'vitest';
import { createProbityHook } from '../preToolUse.ts';

function mockAdapter(verdict: { kind: 'pass' } | { kind: 'violation'; reason: string }) {
  return { evaluateAction: vi.fn(async () => verdict) };
}

describe('createProbityHook', () => {
  afterEach(() => vi.clearAllMocks());

  it('should return a function', () => {
    expect(typeof createProbityHook()).toBe('function');
  });

  describe('tool matching', () => {
    it.each(['Bash', 'Write', 'Edit', 'NotebookEdit'])('should evaluate %s', async (tool) => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      const args =
        tool === 'Bash' ? { command: 'echo hi' } : { filePath: '/f.ts', content: 'x' };
      await hook({ tool }, { args });

      expect(adapter.evaluateAction).toHaveBeenCalled();
    });

    it.each(['Read', 'Grep', 'Glob'])('should skip %s', async (tool) => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool }, { args: {} });

      expect(adapter.evaluateAction).not.toHaveBeenCalled();
    });
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

  describe('payload translation', () => {
    it('should send Bash payload with command', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool: 'Bash' }, { args: { command: 'npm test' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.tool_name).toBe('Bash');
      expect(payload.tool_input).toEqual({ command: 'npm test' });
    });

    it('should send Write payload with file_path and content', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool: 'Write' }, { args: { filePath: '/f.ts', content: 'x' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.tool_name).toBe('Write');
      expect(payload.tool_input).toEqual({ file_path: '/f.ts', content: 'x' });
    });

    it('should send Edit payload with old_string and new_string', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool: 'Edit' }, { args: { filePath: '/f.ts', content: 'y' } });

      const payload = adapter.evaluateAction.mock.calls[0][0];
      expect(payload.tool_name).toBe('Edit');
      expect(payload.tool_input).toEqual({ file_path: '/f.ts', old_string: '', new_string: 'y' });
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

    it('should skip when args are insufficient', async () => {
      const adapter = mockAdapter({ kind: 'pass' });
      const hook = createProbityHook({ adapter: adapter as any });

      await hook({ tool: 'Write' }, { args: {} });

      expect(adapter.evaluateAction).not.toHaveBeenCalled();
    });
  });
});
