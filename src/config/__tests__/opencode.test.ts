import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { resolve } from 'path';
import { loadOpenCodePluginConfig, clearOpenCodeConfigCache } from '../opencode.ts';

describe('loadOpenCodePluginConfig', () => {
  const originalHome = process.env.HOME;

  beforeEach(() => {
    clearOpenCodeConfigCache();
    vi.restoreAllMocks();
    process.env.HOME = '/mock/home';
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it('should return empty object when no config file exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const config = loadOpenCodePluginConfig('/workspace');
    expect(config).toEqual({});
  });

  it('should parse debug: true as default cache path', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p).endsWith('opencode.json');
    });

    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        plugin: ['opencode-probity'],
        probity: {
          debug: true,
        },
      })
    );

    const config = loadOpenCodePluginConfig('/workspace');
    expect(config.debugPath).toBe('/mock/home/.cache/opencode/probity-debug.jsonl');
  });

  it('should resolve relative debug path string against config directory', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p) === resolve('/workspace/opencode.json');
    });

    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        plugin: ['opencode-probity'],
        probity: {
          debug: './logs/debug.jsonl',
        },
      })
    );

    const config = loadOpenCodePluginConfig('/workspace');
    expect(config.debugPath).toBe(resolve('/workspace/logs/debug.jsonl'));
  });

  it('should resolve relative debugPath string against config directory', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p) === resolve('/workspace/opencode.json');
    });

    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        plugin: ['opencode-probity'],
        probity: {
          debugPath: './custom.jsonl',
        },
      })
    );

    const config = loadOpenCodePluginConfig('/workspace');
    expect(config.debugPath).toBe(resolve('/workspace/custom.jsonl'));
  });

  it('should support opencode-probity key name', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p) === resolve('/workspace/opencode.json');
    });

    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        plugin: ['opencode-probity'],
        'opencode-probity': {
          debug: true,
          configPath: './custom.config.ts',
        },
      })
    );

    const config = loadOpenCodePluginConfig('/workspace');
    expect(config.debugPath).toBe('/mock/home/.cache/opencode/probity-debug.jsonl');
    expect(config.configPath).toBe(resolve('/workspace/custom.config.ts'));
  });

  it('should support opencode.jsonc with comments', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p) === resolve('/workspace/opencode.jsonc');
    });

    const jsoncContent = `
      // OpenCode config
      {
        /* plugins */
        "plugin": ["opencode-probity"],
        "probity": {
          // enable debug
          "debug": true
        }
      }
    `;

    vi.spyOn(fs, 'readFileSync').mockReturnValue(jsoncContent);

    const config = loadOpenCodePluginConfig('/workspace');
    expect(config.debugPath).toBe('/mock/home/.cache/opencode/probity-debug.jsonl');
  });

  it('should handle corrupt JSON gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p) === resolve('/workspace/opencode.json');
    });

    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ invalid json');

    const config = loadOpenCodePluginConfig('/workspace');
    expect(config).toEqual({});
  });

  it('should cache parsed results', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    loadOpenCodePluginConfig('/cached-workspace');
    loadOpenCodePluginConfig('/cached-workspace');

    expect(existsSpy).toHaveBeenCalled();
  });
});
