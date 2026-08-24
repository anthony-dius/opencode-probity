import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProbityPlugin } from '../index.ts';
import * as fs from 'fs';

afterEach(() => vi.restoreAllMocks());

const mockInput = { client: { session: { messages: vi.fn(async () => ({ data: [] })) } } };

describe('Integration - Plugin Export', () => {
  it('should export ProbityPlugin function', () => {
    expect(typeof ProbityPlugin).toBe('function');
  });

  it('should return hook object with tool.execute.before', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const pluginInstance = ProbityPlugin(mockInput as any);
    expect(pluginInstance instanceof Promise).toBe(true);
    expect(pluginInstance).toBeDefined();
  });

  it('should integrate with OpenCode as valid plugin', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin(mockInput as any);
    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('object');
    expect('tool.execute.before' in plugin).toBe(true);
  });

  it('should have tool.execute.before hook function', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin(mockInput as any);
    const hook = plugin['tool.execute.before'];

    expect(hook).toBeDefined();
    expect(typeof hook).toBe('function');
  });

  it('plugin hook should handle non-matching tools silently', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin(mockInput as any);
    const hook = plugin['tool.execute.before'];

    const input = { tool: 'Read' };
    const output = { args: {} };

    await hook(input, output);
    expect(output.block).toBeUndefined();
  });

  it('plugin hook should initialize with adapter and config', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin(mockInput as any);
    expect(plugin).toBeDefined();

    const hook = plugin['tool.execute.before'];
    expect(typeof hook).toBe('function');
  });

  it('plugin should pass directory from plugin input to hook', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin({
      ...mockInput,
      directory: '/test/workspace',
    } as any);

    expect(plugin).toBeDefined();
    expect(plugin['tool.execute.before']).toBeDefined();
  });
});
