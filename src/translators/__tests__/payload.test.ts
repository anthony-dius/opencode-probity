import { describe, it, expect } from 'vitest';
import {
  translateBashToProbityAction,
  translateWriteToProbityAction,
  translateEditToProbityAction,
} from '../payload.ts';

describe('Payload Translator', () => {
  describe('translateBashToProbityAction', () => {
    it('should translate a bash command to a Copilot hook payload', () => {
      const before = Date.now();
      const result = translateBashToProbityAction('npm install');
      const after = Date.now();

      expect(result.sessionId).toBe('opencode');
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
      expect(result.cwd).toBe(process.cwd());
      expect(result.toolName).toBe('bash');
      expect(JSON.parse(result.toolArgs)).toEqual({ command: 'npm install' });
    });

    it('should handle complex bash commands with pipes', () => {
      const bashCommand = 'grep -r "TODO" src/ | wc -l';
      const result = translateBashToProbityAction(bashCommand);

      expect(result.toolName).toBe('bash');
      expect(JSON.parse(result.toolArgs)).toEqual({ command: bashCommand });
    });

    it('should handle bash commands with environment variables', () => {
      const bashCommand = 'NODE_ENV=test npm run build';
      const result = translateBashToProbityAction(bashCommand);

      expect(result.toolName).toBe('bash');
      expect(JSON.parse(result.toolArgs)).toEqual({ command: bashCommand });
    });

    it('should handle bash commands with quotes', () => {
      const bashCommand = 'echo "Hello World"';
      const result = translateBashToProbityAction(bashCommand);

      expect(result.toolName).toBe('bash');
      expect(JSON.parse(result.toolArgs)).toEqual({ command: bashCommand });
    });

    it('should produce valid JSON in toolArgs', () => {
      const result = translateBashToProbityAction('npm test');

      expect(() => JSON.parse(result.toolArgs)).not.toThrow();
    });
  });

  describe('translateWriteToProbityAction', () => {
    it('should translate a write tool call to a Copilot create payload', () => {
      const filePath = '/Users/anthony/project/src/index.ts';
      const content = 'export const greeting = "hello";';

      const result = translateWriteToProbityAction(filePath, content);

      expect(result.sessionId).toBe('opencode');
      expect(result.timestamp).toBe(Date.now());
      expect(result.cwd).toBe(process.cwd());
      expect(result.toolName).toBe('create');
      expect(JSON.parse(result.toolArgs)).toEqual({
        path: filePath,
        file_text: content,
      });
    });

    it('should preserve absolute paths in toolArgs', () => {
      const filePath = '/absolute/path/to/file.ts';
      const content = 'const x = 1;';

      const result = translateWriteToProbityAction(filePath, content);
      const parsed = JSON.parse(result.toolArgs);

      expect(parsed.path).toBe('/absolute/path/to/file.ts');
    });

    it('should preserve multi-line content in toolArgs', () => {
      const filePath = '/project/file.ts';
      const content = `function hello() {
  console.log('world');
}`;

      const result = translateWriteToProbityAction(filePath, content);
      const parsed = JSON.parse(result.toolArgs);

      expect(parsed.file_text).toBe(content);
      expect(parsed.file_text).toContain('\n');
    });

    it('should handle empty file content', () => {
      const filePath = '/project/empty.ts';
      const content = '';

      const result = translateWriteToProbityAction(filePath, content);
      const parsed = JSON.parse(result.toolArgs);

      expect(parsed).toEqual({
        path: '/project/empty.ts',
        file_text: '',
      });
    });

    it('should handle file content with special characters', () => {
      const filePath = '/project/file.ts';
      const content = 'const str = "quote\\"here"; // comment\nconst x = 1;';

      const result = translateWriteToProbityAction(filePath, content);
      const parsed = JSON.parse(result.toolArgs);

      expect(parsed.file_text).toBe(content);
    });
  });

  describe('translateEditToProbityAction', () => {
    it('should translate an edit tool call to a Copilot edit payload', () => {
      const filePath = '/Users/anthony/project/src/file.ts';
      const newContent = 'const updated = true;';

      const result = translateEditToProbityAction(filePath, newContent);

      expect(result.sessionId).toBe('opencode');
      expect(result.timestamp).toBe(Date.now());
      expect(result.cwd).toBe(process.cwd());
      expect(result.toolName).toBe('edit');
      expect(JSON.parse(result.toolArgs)).toEqual({
        path: filePath,
        old_str: '',
        new_str: newContent,
      });
    });

    it('should use edit toolName (not create)', () => {
      const filePath = '/project/edited.ts';
      const content = 'export function updated() {}';

      const result = translateEditToProbityAction(filePath, content);

      expect(result.toolName).toBe('edit');
    });

    it('should handle edit with multi-line content', () => {
      const filePath = '/project/file.ts';
      const content = `// Updated file
function main() {
  return 'done';
}`;

      const result = translateEditToProbityAction(filePath, content);
      const parsed = JSON.parse(result.toolArgs);

      expect(parsed.new_str).toBe(content);
      expect(parsed.path).toBe('/project/file.ts');
    });
  });

  describe('Copilot hook payload envelope', () => {
    it('should always include sessionId, timestamp, cwd, toolName, toolArgs', () => {
      const result = translateBashToProbityAction('echo hello');

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('cwd');
      expect(result).toHaveProperty('toolName');
      expect(result).toHaveProperty('toolArgs');
    });

    it('should have toolArgs as a JSON string, not an object', () => {
      const result = translateWriteToProbityAction('/file.ts', 'content');

      expect(typeof result.toolArgs).toBe('string');
      expect(() => JSON.parse(result.toolArgs)).not.toThrow();
    });

    it('should use numeric timestamp (epoch ms)', () => {
      const result = translateBashToProbityAction('test');

      expect(typeof result.timestamp).toBe('number');
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });
});
