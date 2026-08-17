import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Cache for discovered config paths
 * Maps starting directory to found config path (or undefined if not found)
 */
const configCache = new Map<string, string | undefined>();

/**
 * Find probity.config file by walking up from the given directory
 * Supports .ts, .mts, .js, .mjs extensions in that priority order
 *
 * @param startDir - The directory to start searching from
 * @returns Absolute path to probity.config file, or undefined if not found
 */
export async function findProbityConfig(startDir: string): Promise<string | undefined> {
  // Resolve to absolute path
  const absStartDir = resolve(startDir);

  // Check cache first
  if (configCache.has(absStartDir)) {
    return configCache.get(absStartDir);
  }

  // Walk up directory tree
  let currentDir = absStartDir;
  const extensions = ['.ts', '.mts', '.js', '.mjs'];

  while (true) {
    // Check each extension at current directory
    for (const ext of extensions) {
      const configPath = resolve(currentDir, `probity.config${ext}`);
      if (existsSync(configPath)) {
        // Cache and return
        configCache.set(absStartDir, configPath);
        return configPath;
      }
    }

    // Move to parent directory
    const parentDir = dirname(currentDir);

    // Stop at filesystem root
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  // Not found - cache undefined result
  configCache.set(absStartDir, undefined);
  return undefined;
}

/**
 * Clear the configuration discovery cache
 * Useful for testing or when the filesystem may have changed
 */
export function clearConfigCache(): void {
  configCache.clear();
}
