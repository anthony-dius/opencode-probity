import { describe, it, expect } from 'vitest';
import {
  translateBashToProbityAction,
  translateWriteToProbityAction,
  translateEditToProbityAction,
} from '../payload.ts';

describe('Payload Translator', () => {
  describe('translateBashToProbityAction', () => {
    it('should translate a bash command to a probity command action', () => {
      const bashCommand = 'npm install';
      const result = translateBashToProbityAction(bashCommand);

      expect(result).toEqual({
        kind: 'command',
        command: 'npm install',
      });
    });

    it('should handle complex bash commands with pipes', () => {
      const bashCommand = 'grep -r "TODO" src/ | wc -l';
      const result = translateBashToProbityAction(bashCommand);

      expect(result).toEqual({
        kind: 'command',
        command: 'grep -r "TODO" src/ | wc -l',
      });
    });

    it('should handle bash commands with environment variables', () => {
      const bashCommand = 'NODE_ENV=test npm run build';
      const result = translateBashToProbityAction(bashCommand);

      expect(result).toEqual({
        kind: 'command',
        command: 'NODE_ENV=test npm run build',
      });
    });

    it('should handle bash commands with quotes', () => {
      const bashCommand = 'echo "Hello World"';
      const result = translateBashToProbityAction(bashCommand);

      expect(result).toEqual({
        kind: 'command',
        command: 'echo "Hello World"',
      });
    });
  });

  describe('translateWriteToProbityAction', () => {
    it('should translate a write tool call to a probity write action', () => {
      const filePath = '/Users/anthony/project/src/index.ts';
      const content = 'export const greeting = "hello";';

      const result = translateWriteToProbityAction(filePath, content);

      expect(result).toEqual({
        kind: 'write',
        path: '/Users/anthony/project/src/index.ts',
        content: 'export const greeting = "hello";',
      });
    });

    it('should preserve absolute paths', () => {
      const filePath = '/absolute/path/to/file.ts';
      const content = 'const x = 1;';

      const result = translateWriteToProbityAction(filePath, content);

      expect(result.path).toBe('/absolute/path/to/file.ts');
    });

    it('should preserve multi-line content', () => {
      const filePath = '/project/file.ts';
      const content = `function hello() {
  console.log('world');
}`;

      const result = translateWriteToProbityAction(filePath, content);

      expect(result.content).toBe(content);
      expect(result.content).toContain('\n');
    });

    it('should handle empty file content', () => {
      const filePath = '/project/empty.ts';
      const content = '';

      const result = translateWriteToProbityAction(filePath, content);

      expect(result).toEqual({
        kind: 'write',
        path: '/project/empty.ts',
        content: '',
      });
    });

    it('should handle file content with special characters', () => {
      const filePath = '/project/file.ts';
      const content = 'const str = "quote\\"here"; // comment\nconst x = 1;';

      const result = translateWriteToProbityAction(filePath, content);

      expect(result.content).toBe(content);
    });
  });

  describe('translateEditToProbityAction', () => {
    it('should translate an edit tool call to a probity write action with full content', () => {
      const filePath = '/Users/anthony/project/src/file.ts';
      const newContent = 'const updated = true;';

      const result = translateEditToProbityAction(filePath, newContent);

      expect(result).toEqual({
        kind: 'write',
        path: '/Users/anthony/project/src/file.ts',
        content: 'const updated = true;',
      });
    });

    it('should treat edit as a write action from probity perspective', () => {
      const filePath = '/project/edited.ts';
      const content = 'export function updated() {}';

      const result = translateEditToProbityAction(filePath, content);

      expect(result.kind).toBe('write');
    });

    it('should handle edit with multi-line content', () => {
      const filePath = '/project/file.ts';
      const content = `// Updated file
function main() {
  return 'done';
}`;

      const result = translateEditToProbityAction(filePath, content);

      expect(result.content).toBe(content);
      expect(result.path).toBe('/project/file.ts');
    });
  });
});
