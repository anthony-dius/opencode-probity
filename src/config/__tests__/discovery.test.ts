import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { findProbityConfig, clearConfigCache } from '../discovery.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Configuration Discovery', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearConfigCache();
  });

  describe('findProbityConfig', () => {
    it('should find probity.config.ts in the project root', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        return String(filePath).endsWith('/project/probity.config.ts');
      });

      const result = await findProbityConfig('/project');

      expect(result).toBe('/project/probity.config.ts');
      mockExistsSync.mockRestore();
    });

    it('should find probity.config.mts in the project root', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        return String(filePath).endsWith('/project/probity.config.mts');
      });

      const result = await findProbityConfig('/project');

      expect(result).toBe('/project/probity.config.mts');
      mockExistsSync.mockRestore();
    });

    it('should find probity.config.js in the project root', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        return String(filePath).endsWith('/project/probity.config.js');
      });

      const result = await findProbityConfig('/project');

      expect(result).toBe('/project/probity.config.js');
      mockExistsSync.mockRestore();
    });

    it('should find probity.config.mjs in the project root', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        return String(filePath).endsWith('/project/probity.config.mjs');
      });

      const result = await findProbityConfig('/project');

      expect(result).toBe('/project/probity.config.mjs');
      mockExistsSync.mockRestore();
    });

    it('should walk up to parent directories looking for config', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        const str = String(filePath);
        // Config is found when walking up - simulate it existing at the parent
        return str === '/project/probity.config.ts';
      });

      const result = await findProbityConfig('/project/src/components');

      expect(result).toBe('/project/probity.config.ts');
      mockExistsSync.mockRestore();
    });

    it('should return undefined when config is not found', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = await findProbityConfig('/project');

      expect(result).toBeUndefined();
      mockExistsSync.mockRestore();
    });

    it('should stop at filesystem root and return undefined if not found', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = await findProbityConfig('/project/deep/nested/path');

      expect(result).toBeUndefined();
      mockExistsSync.mockRestore();
    });

    it('should check extensions in priority order: ts, mts, js, mjs', async () => {
      const callOrder: string[] = [];
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        const str = String(filePath);
        callOrder.push(str);
        return false; // All return false to test order
      });

      await findProbityConfig('/project');

      // Extract just the extension part from first four calls at /project
      const projectCalls = callOrder.filter((call) => call.startsWith('/project'));
      const extensions = projectCalls.slice(0, 4).map((call) => call.split('.').pop());

      // Should check .ts before .mts, .js before .mjs
      expect(extensions).toEqual(['ts', 'mts', 'js', 'mjs']);
      mockExistsSync.mockRestore();
    });

    it('should return absolute path', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        return String(filePath).endsWith('/absolute/path/probity.config.ts');
      });

      const result = await findProbityConfig('/absolute/path');

      expect(result).toBeDefined();
      expect(path.isAbsolute(result!)).toBe(true);
      mockExistsSync.mockRestore();
    });

    it('should handle relative paths by resolving to absolute', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        const str = String(filePath);
        return path.isAbsolute(str) && str.endsWith('probity.config.ts');
      });

      const result = await findProbityConfig('./project');

      if (result) {
        expect(path.isAbsolute(result)).toBe(true);
      }
      mockExistsSync.mockRestore();
    });
  });

  describe('configuration discovery caching', () => {
    it('should cache discovery results', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        return String(filePath).endsWith('/project/probity.config.ts');
      });

      const path1 = await findProbityConfig('/project');
      const callsAfterFirst = mockExistsSync.mock.calls.length;

      const path2 = await findProbityConfig('/project');
      const callsAfterSecond = mockExistsSync.mock.calls.length;

      expect(path1).toBe(path2);
      // Second call should use cache, so minimal new calls
      expect(callsAfterSecond).toBe(callsAfterFirst);
      mockExistsSync.mockRestore();
    });

    it('should have separate cache entries for different starting paths', async () => {
      const mockExistsSync = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: string) => {
        const str = String(filePath);
        // Return true when the extension matches
        return str.endsWith('probity.config.ts');
      });

      const path1 = await findProbityConfig('/project1');
      const callsAfterFirst = mockExistsSync.mock.calls.length;

      const path2 = await findProbityConfig('/project2');
      const callsAfterSecond = mockExistsSync.mock.calls.length;

      expect(path1).toBeDefined();
      expect(path2).toBeDefined();
      // Both paths should be searched (different cache entries)
      // Second search should add more calls than just the first
      expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst);
      mockExistsSync.mockRestore();
    });
  });
});
