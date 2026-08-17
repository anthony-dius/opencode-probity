import { describe, it, expect, afterEach, vi } from 'vitest';
import { createProbityHook } from '../preToolUse.ts';
import type { ProbityAction } from '../../translators/payload.ts';

/**
 * Mock tool input/output types based on OpenCode plugin API
 */
interface MockToolInput {
  tool: string;
}

interface MockToolOutput {
  args: {
    command?: string;
    filePath?: string;
    content?: string;
  };
  allow?: boolean;
  block?: {
    reason: string;
  };
}

describe('Probity Hook - tool.execute.before', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createProbityHook', () => {
    it('should create a hook function', () => {
      const hook = createProbityHook();
      expect(typeof hook).toBe('function');
    });

    it('should allow bash commands by default', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };
      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Bash' };
      const output: MockToolOutput = { args: { command: 'echo test' } };

      await hook(input, output);

      expect(output.block).toBeUndefined();
    });

    it('should allow write operations by default', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };
      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Write' };
      const output: MockToolOutput = {
        args: { filePath: '/file.ts', content: 'export const x = 1;' },
      };

      await hook(input, output);

      expect(output.block).toBeUndefined();
    });

    it('should allow edit operations by default', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };
      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Edit' };
      const output: MockToolOutput = {
        args: { filePath: '/file.ts', content: 'export const y = 2;' },
      };

      await hook(input, output);

      expect(output.block).toBeUndefined();
    });

    it('should skip non-matching tools', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };
      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Read' };
      const output: MockToolOutput = { args: {} };

      await hook(input, output);

      expect(output.block).toBeUndefined();
    });
  });

  describe('hook with probity rules', () => {
    it('should block write if probity rule violation occurs', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({
          kind: 'violation' as const,
          reason: 'Missing test for implementation',
        })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Write' };
      const output: MockToolOutput = {
        args: { filePath: '/src/index.ts', content: 'export const x = 1;' },
      };

      await hook(input, output);

      expect(output.block).toBeDefined();
      expect(output.block?.reason).toBe('Missing test for implementation');
    });

    it('should allow write if probity rule passes', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({
          kind: 'pass' as const,
        })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Write' };
      const output: MockToolOutput = {
        args: { filePath: '/src/test.ts', content: 'describe("test", () => {})' },
      };

      await hook(input, output);

      expect(output.block).toBeUndefined();
    });

    it('should block bash command if probity rule violation occurs', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({
          kind: 'violation' as const,
          reason: 'Use pnpm instead of npm',
        })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Bash' };
      const output: MockToolOutput = {
        args: { command: 'npm install' },
      };

      await hook(input, output);

      expect(output.block).toBeDefined();
      expect(output.block?.reason).toBe('Use pnpm instead of npm');
    });
  });

  describe('tool matching', () => {
    it('should match Bash tool', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Bash' };
      const output: MockToolOutput = { args: { command: 'echo test' } };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });

    it('should match Write tool', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Write' };
      const output: MockToolOutput = {
        args: { filePath: '/file.ts', content: 'test' },
      };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });

    it('should match Edit tool', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Edit' };
      const output: MockToolOutput = {
        args: { filePath: '/file.ts', content: 'test' },
      };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });

    it('should match NotebookEdit tool', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'NotebookEdit' };
      const output: MockToolOutput = {
        args: { filePath: '/notebook.ipynb', content: '{}' },
      };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });

    it('should not match Read tool', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Read' };
      const output: MockToolOutput = { args: {} };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).not.toHaveBeenCalled();
    });

    it('should not match Grep tool', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Grep' };
      const output: MockToolOutput = { args: {} };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).not.toHaveBeenCalled();
    });
  });

  describe('payload translation to Copilot format', () => {
    it('should translate bash command to Copilot hook payload', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async (action: ProbityAction) => {
          expect(action.sessionId).toBe('opencode');
          expect(action.toolName).toBe('bash');
          expect(typeof action.timestamp).toBe('number');
          expect(typeof action.cwd).toBe('string');

          const toolArgs = JSON.parse(action.toolArgs);
          expect(toolArgs).toEqual({ command: 'npm run build' });

          return { kind: 'pass' };
        }),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Bash' };
      const output: MockToolOutput = {
        args: { command: 'npm run build' },
      };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });

    it('should translate write to Copilot create payload', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async (action: ProbityAction) => {
          expect(action.toolName).toBe('create');

          const toolArgs = JSON.parse(action.toolArgs);
          expect(toolArgs).toEqual({
            path: '/src/index.ts',
            file_text: 'export const x = 1;',
          });

          return { kind: 'pass' };
        }),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Write' };
      const output: MockToolOutput = {
        args: { filePath: '/src/index.ts', content: 'export const x = 1;' },
      };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });

    it('should translate edit to Copilot edit payload', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async (action: ProbityAction) => {
          expect(action.toolName).toBe('edit');

          const toolArgs = JSON.parse(action.toolArgs);
          expect(toolArgs).toEqual({
            path: '/src/index.ts',
            old_str: '',
            new_str: 'export const y = 2;',
          });

          return { kind: 'pass' };
        }),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Edit' };
      const output: MockToolOutput = {
        args: { filePath: '/src/index.ts', content: 'export const y = 2;' },
      };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should allow tool execution if adapter throws error', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => {
          throw new Error('Adapter error');
        }),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Write' };
      const output: MockToolOutput = {
        args: { filePath: '/file.ts', content: 'test' },
      };

      await hook(input, output);

      expect(output.block).toBeUndefined();
    });

    it('should allow tool execution if missing required arguments', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };
      const hook = createProbityHook({ adapter: mockAdapter as any });
      const input: MockToolInput = { tool: 'Write' };
      const output: MockToolOutput = { args: {} };

      await hook(input, output);
      expect(mockAdapter.evaluateAction).not.toHaveBeenCalled();
    });
  });

  describe('configuration options', () => {
    it('should accept custom adapter option', () => {
      const mockAdapter = {
        evaluateAction: vi.fn(),
      };

      const hook = createProbityHook({ adapter: mockAdapter as any });
      expect(hook).toBeDefined();
    });

    it('should accept debug option', () => {
      const hook = createProbityHook({ debug: true });
      expect(hook).toBeDefined();
    });

    it('should accept configPath option', () => {
      const hook = createProbityHook({ configPath: '/path/to/config' });
      expect(hook).toBeDefined();
    });

    it('should accept debugPath option', () => {
      const hook = createProbityHook({ debugPath: '/tmp/probity-debug.jsonl' });
      expect(hook).toBeDefined();
    });

    it('should pass debugPath to adapter when creating it', async () => {
      const mockAdapter = {
        evaluateAction: vi.fn(async () => ({ kind: 'pass' })),
      };
      const debugPath = '/tmp/probity-debug.jsonl';

      const hook = createProbityHook({
        adapter: mockAdapter as any,
        debugPath,
      });
      const input = { tool: 'Bash' };
      const output = { args: { command: 'echo test' } };

      await hook(input, output);

      expect(mockAdapter.evaluateAction).toHaveBeenCalled();
    });
  });
});
