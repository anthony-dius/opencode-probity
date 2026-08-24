# Probity Plugin Debug Configuration

The Probity plugin supports Probity's `--debug` flag to log all hook invocations for diagnostics.

## Usage

### Via opencode.json (Recommended)

Enable debug logging in your project's `opencode.json` (or `opencode.jsonc`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-probity"],
  "probity": {
    "debug": true
  }
}
```

When `debug: true` is set, logs are written to `~/.cache/opencode/probity-debug.jsonl`.

You can also specify a custom debug log file path:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-probity"],
  "probity": {
    "debug": "./logs/probity-debug.jsonl"
  }
}
```

Or using `debugPath`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-probity"],
  "probity": {
    "debugPath": "./.opencode/probity-debug.jsonl"
  }
}
```

### Via Hook Options

```typescript
import { createProbityHook } from 'opencode-probity';

const hook = createProbityHook({
  debugPath: '/tmp/probity-debug.jsonl',
});
```

## Debug Output Format

Debug logs are written in JSONL format by the probity CLI. Each entry contains:

```json
{
  "datetime": "2026-08-17T11:19:45.838Z",
  "request": {
    "tool": "Write",
    "args": {
      "filePath": "/project/src/feature.ts",
      "content": "export const feature = () => {};"
    },
    "cwd": "/project",
    "transcript_path": "/tmp/probity-transcripts/session-id.jsonl"
  },
  "response": {
    "decision": "block",
    "reason": "Probity: Missing test for this implementation"
  },
  "trace": [
    {
      "kind": "rule-evaluated",
      "rule": "enforceTdd",
      "result": { "kind": "violation", "reason": "Missing test" },
      "durationMs": 1479.37,
      "agentCalls": [{ "durationMs": 1477.99, "verdict": { "kind": "violation", "reason": "..." } }]
    }
  ]
}
```

## Viewing Debug Logs

```bash
tail -f ~/.cache/opencode/probity-debug.jsonl | jq -C '.'
```

## Troubleshooting

If debug logs aren't appearing:

1. Ensure the debug path directory exists and is writable
2. Verify `npx @nizos/probity --help` works
3. Check that `createProbityHook` is called with `debugPath`
