import { describe, it, expect, afterEach } from 'vitest';
import { writeTranscript } from '../transcript.ts';
import { readFileSync, unlinkSync, existsSync } from 'fs';

function readLines(path: string): unknown[] {
  return readFileSync(path, 'utf-8')
    .trim()
    .split('\n')
    .filter((l) => l)
    .map((l) => JSON.parse(l));
}

const cleanup: string[] = [];

afterEach(() => {
  for (const f of cleanup) {
    if (existsSync(f)) unlinkSync(f);
  }
  cleanup.length = 0;
});

describe('writeTranscript', () => {
  it('should write each message verbatim as a JSONL line', () => {
    const messages = [
      {
        info: { role: 'user' as const, id: 'msg1' },
        parts: [{ type: 'text' as const, text: 'Add a calculator' }],
      },
    ];

    const path = writeTranscript('test-session', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual(messages[0]);
  });

  it('should preserve tool parts, including status, input, and output', () => {
    const messages = [
      {
        info: { role: 'assistant' as const, id: 'msg1' },
        parts: [
          {
            type: 'tool' as const,
            tool: 'Bash',
            callID: 'call_1',
            state: {
              status: 'completed' as const,
              input: { command: 'bun test' },
              output: 'PASS 5 tests',
            },
          },
        ],
      },
    ];

    const path = writeTranscript('test-session-2', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual(messages[0]);
  });

  it('should write one line per message, preserving order', () => {
    const messages = [
      {
        info: { role: 'user' as const, id: 'u1' },
        parts: [{ type: 'text' as const, text: 'Add a multiply function using TDD' }],
      },
      {
        info: { role: 'assistant' as const, id: 'a1' },
        parts: [
          {
            type: 'tool' as const,
            tool: 'Write',
            callID: 'c1',
            state: {
              status: 'completed' as const,
              input: { filePath: 'src/math.test.ts', content: 'test code' },
              output: 'File written',
            },
          },
        ],
      },
    ];

    const path = writeTranscript('test-session-3', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toEqual(messages);
  });

  it('should return an empty file for no messages', () => {
    const path = writeTranscript('test-session-4', []);
    cleanup.push(path);

    expect(readLines(path)).toEqual([]);
  });

  it('should write to the expected path', () => {
    const messages = [
      {
        info: { role: 'user' as const, id: 'u1' },
        parts: [{ type: 'text' as const, text: 'hello' }],
      },
    ];

    const path = writeTranscript('my-session-id', messages);
    cleanup.push(path);

    expect(path).toContain('probity-transcripts/my-session-id.jsonl');
    expect(existsSync(path)).toBe(true);
  });
});
