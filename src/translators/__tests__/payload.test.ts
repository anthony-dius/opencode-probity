import { describe, it, expect } from 'vitest';
import { buildProbityPayload } from '../payload.ts';

describe('buildProbityPayload', () => {
  describe('Bash', () => {
    it('should build a Bash payload', () => {
      const result = buildProbityPayload('Bash', { command: 'npm test' });

      expect(result).toEqual({
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
        cwd: process.cwd(),
      });
    });

    it('should handle complex commands with pipes', () => {
      const result = buildProbityPayload('Bash', { command: 'grep -r "TODO" src/ | wc -l' });

      expect(result!.tool_input).toEqual({ command: 'grep -r "TODO" src/ | wc -l' });
    });

    it('should return null when command is missing', () => {
      expect(buildProbityPayload('Bash', {})).toBeNull();
    });

    it('should return null when command is not a string', () => {
      expect(buildProbityPayload('Bash', { command: 123 as any })).toBeNull();
    });
  });

  describe('Write', () => {
    it('should build a Write payload with file_path and content', () => {
      const result = buildProbityPayload('Write', {
        filePath: '/src/index.ts',
        content: 'export const x = 1;',
      });

      expect(result).toEqual({
        tool_name: 'Write',
        tool_input: { file_path: '/src/index.ts', content: 'export const x = 1;' },
        cwd: process.cwd(),
      });
    });

    it('should handle empty content', () => {
      const result = buildProbityPayload('Write', { filePath: '/empty.ts', content: '' });

      expect(result!.tool_input).toEqual({ file_path: '/empty.ts', content: '' });
    });

    it('should return null when filePath is missing', () => {
      expect(buildProbityPayload('Write', { content: 'x' })).toBeNull();
    });

    it('should return null when content is missing', () => {
      expect(buildProbityPayload('Write', { filePath: '/f.ts' })).toBeNull();
    });
  });

  describe('Edit', () => {
    it('should build an Edit payload with old_string and new_string', () => {
      const result = buildProbityPayload('Edit', {
        filePath: '/src/index.ts',
        content: 'const y = 2;',
      });

      expect(result).toEqual({
        tool_name: 'Edit',
        tool_input: { file_path: '/src/index.ts', old_string: '', new_string: 'const y = 2;' },
        cwd: process.cwd(),
      });
    });

    it('should return null when filePath is missing', () => {
      expect(buildProbityPayload('Edit', { content: 'x' })).toBeNull();
    });
  });

  describe('NotebookEdit', () => {
    it('should build a NotebookEdit payload', () => {
      const result = buildProbityPayload('NotebookEdit', {
        filePath: '/notebook.ipynb',
        content: '{}',
      });

      expect(result).toEqual({
        tool_name: 'NotebookEdit',
        tool_input: { notebook_path: '/notebook.ipynb', new_source: '{}' },
        cwd: process.cwd(),
      });
    });
  });

  describe('unknown tools', () => {
    it('should return null for Read', () => {
      expect(buildProbityPayload('Read', {})).toBeNull();
    });

    it('should return null for Grep', () => {
      expect(buildProbityPayload('Grep', {})).toBeNull();
    });
  });

  describe('transcript_path', () => {
    it('should include transcript_path when provided', () => {
      const result = buildProbityPayload('Bash', { command: 'echo hi' }, '/tmp/t.jsonl');

      expect(result!.transcript_path).toBe('/tmp/t.jsonl');
    });

    it('should omit transcript_path when not provided', () => {
      const result = buildProbityPayload('Bash', { command: 'echo hi' });

      expect(result!.transcript_path).toBeUndefined();
    });
  });
});
