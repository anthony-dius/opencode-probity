import { describe, it, expect, vi } from 'vitest';
import { ProbityPlugin } from '../index.ts';
import * as fs from 'fs';

describe('Integration - Plugin Export', () => {
  it('should export ProbityPlugin function', () => {
    expect(typeof ProbityPlugin).toBe('function');
  });

  it('should return hook object with tool.execute.before', () => {
    // Mock filesystem to avoid actual file lookups
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const pluginInstance = ProbityPlugin();
    expect(pluginInstance instanceof Promise).toBe(true);
    expect(pluginInstance).toBeDefined();
  });

  it('should integrate with OpenCode as valid plugin', async () => {
    // Mock filesystem
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin();
    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('object');
    expect('tool.execute.before' in plugin).toBe(true);
  });

  it('should have tool.execute.before hook function', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin();
    const hook = plugin['tool.execute.before'];

    expect(hook).toBeDefined();
    expect(typeof hook).toBe('function');
  });

  it('plugin hook should handle non-matching tools silently', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const plugin = await ProbityPlugin();
    const hook = plugin['tool.execute.before'];

    const input = { tool: 'Read' };
    const output = { args: {} };

    // Should not throw or modify output for non-matching tools
    await hook(input, output);
    expect(output.block).toBeUndefined();
  });

  it('plugin hook should initialize with adapter and config', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    // Plugin should initialize successfully
    const plugin = await ProbityPlugin();
    expect(plugin).toBeDefined();

    // Hook should be a function ready for OpenCode
    const hook = plugin['tool.execute.before'];
    expect(typeof hook).toBe('function');
  });
});
