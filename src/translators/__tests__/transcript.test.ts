import { describe, it, expect, afterEach } from 'vitest';
import { writeTranscript } from '../transcript.ts';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';

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
  it('should convert a user text part to a user prompt entry', () => {
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
    expect(lines[0]).toEqual({
      type: 'user',
      message: { content: [{ type: 'text', text: 'Add a calculator' }] },
    });
  });

  it('should ignore text parts from assistant messages', () => {
    const messages = [
      {
        info: { role: 'assistant' as const, id: 'msg1' },
        parts: [{ type: 'text' as const, text: 'I will help you' }],
      },
    ];

    const path = writeTranscript('test-session-2', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toHaveLength(0);
  });

  it('should convert a completed tool part to tool_use + tool_result', () => {
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

    const path = writeTranscript('test-session-3', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toHaveLength(2);

    // tool_use
    expect(lines[0]).toEqual({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Bash', id: 'call_1', input: { command: 'bun test' } }],
      },
    });

    // tool_result
    expect(lines[1]).toEqual({
      type: 'tool_result',
      message: {
        content: [{ type: 'tool_result', content: 'PASS 5 tests', tool_use_id: 'call_1' }],
      },
    });
  });

  it('should convert an errored tool part to tool_use + error result', () => {
    const messages = [
      {
        info: { role: 'assistant' as const, id: 'msg1' },
        parts: [
          {
            type: 'tool' as const,
            tool: 'Bash',
            callID: 'call_2',
            state: {
              status: 'error' as const,
              input: { command: 'bad-cmd' },
              error: 'command not found',
            },
          },
        ],
      },
    ];

    const path = writeTranscript('test-session-4', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({
      type: 'tool_result',
      message: {
        content: [
          { type: 'tool_result', content: 'Error: command not found', tool_use_id: 'call_2' },
        ],
      },
    });
  });

  it('should emit only tool_use for pending/running tools (no result yet)', () => {
    const messages = [
      {
        info: { role: 'assistant' as const, id: 'msg1' },
        parts: [
          {
            type: 'tool' as const,
            tool: 'Write',
            callID: 'call_3',
            state: {
              status: 'pending' as const,
              input: { file_path: '/f.ts', content: 'x' },
            },
          },
        ],
      },
    ];

    const path = writeTranscript('test-session-5', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toHaveLength(1);
    expect((lines[0] as any).message.content[0].type).toBe('tool_use');
  });

  it('should handle a full TDD conversation', () => {
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
              input: { file_path: 'src/math.test.ts', content: 'test code' },
              output: 'File written',
            },
          },
          {
            type: 'tool' as const,
            tool: 'Bash',
            callID: 'c2',
            state: {
              status: 'completed' as const,
              input: { command: 'bun test' },
              output: 'FAIL multiply is not defined',
            },
          },
        ],
      },
    ];

    const path = writeTranscript('test-session-6', messages);
    cleanup.push(path);

    const lines = readLines(path);
    // 1 user prompt + 2 tool_use + 2 tool_result = 5
    expect(lines).toHaveLength(5);
  });

  it('should skip non-text non-tool part types', () => {
    const messages = [
      {
        info: { role: 'assistant' as const, id: 'msg1' },
        parts: [
          { type: 'reasoning' as const, text: 'thinking...' },
          { type: 'step-start' as const },
        ],
      },
    ];

    const path = writeTranscript('test-session-7', messages);
    cleanup.push(path);

    const lines = readLines(path);
    expect(lines).toHaveLength(0);
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
