import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';

export interface OpenCodeProbityConfig {
  debugPath?: string;
  configPath?: string;
}

interface RawProbitySection {
  debug?: boolean | string;
  debugPath?: string;
  configPath?: string;
}

const configCache = new Map<string, OpenCodeProbityConfig>();

/**
 * Strip single-line and multi-line comments from JSON string
 */
function stripJsonComments(jsonString: string): string {
  return jsonString.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^\\:])\/\/.*$/gm, '$1');
}

/**
 * Find and load probity configuration from opencode.json or opencode.jsonc
 *
 * @param startDir - Directory to start searching from (defaults to process.cwd())
 * @returns Parsed and resolved probity options
 */
export function loadOpenCodePluginConfig(startDir?: string): OpenCodeProbityConfig {
  const absStartDir = resolve(startDir ?? process.cwd());

  if (configCache.has(absStartDir)) {
    return configCache.get(absStartDir)!;
  }

  let currentDir = absStartDir;
  const configNames = ['opencode.json', 'opencode.jsonc'];

  while (true) {
    for (const name of configNames) {
      const filePath = resolve(currentDir, name);
      if (existsSync(filePath)) {
        try {
          const raw = readFileSync(filePath, 'utf-8');
          const cleaned = stripJsonComments(raw);
          const parsed = JSON.parse(cleaned) as Record<string, unknown>;
          const section = (parsed.probity ?? parsed['opencode-probity']) as
            RawProbitySection | undefined;

          if (!section || typeof section !== 'object') {
            const emptyResult: OpenCodeProbityConfig = {};
            configCache.set(absStartDir, emptyResult);
            return emptyResult;
          }

          let debugPath: string | undefined;
          if (typeof section.debugPath === 'string') {
            debugPath = resolve(currentDir, section.debugPath);
          } else if (typeof section.debug === 'string') {
            debugPath = resolve(currentDir, section.debug);
          } else if (section.debug === true) {
            const home = process.env.HOME;
            debugPath = home
              ? `${home}/.cache/opencode/probity-debug.jsonl`
              : `${tmpdir()}/probity-debug.jsonl`;
          }

          let configPath: string | undefined;
          if (typeof section.configPath === 'string') {
            configPath = resolve(currentDir, section.configPath);
          }

          const result: OpenCodeProbityConfig = {
            ...(debugPath ? { debugPath } : {}),
            ...(configPath ? { configPath } : {}),
          };

          configCache.set(absStartDir, result);
          return result;
        } catch {
          const fallback: OpenCodeProbityConfig = {};
          configCache.set(absStartDir, fallback);
          return fallback;
        }
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  const notFound: OpenCodeProbityConfig = {};
  configCache.set(absStartDir, notFound);
  return notFound;
}

/**
 * Clear the opencode configuration cache
 */
export function clearOpenCodeConfigCache(): void {
  configCache.clear();
}
