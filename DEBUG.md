# Probity Plugin Debug Configuration

The Probity plugin supports Probity's `--debug` flag to log all hook invocations for diagnostics.

## Usage

### Via Environment Variable (Recommended)

Enable debug logging globally or per command by setting `PROBITY_DEBUG`:

```bash
# Default path (~/.cache/opencode/probity-debug.jsonl)
PROBITY_DEBUG=1 opencode

# Or specify a custom log path
PROBITY_DEBUG=/tmp/probity-debug.jsonl opencode
```

You can also use `OPENCODE_PROBITY_DEBUG`.

### Via Hook Options

```typescript
import { createProbityHook } from 'opencode-probity';

const hook = createProbityHook({
  debugPath: '/tmp/probity-debug.jsonl',
});
```

### Via Custom OpenCode Plugin Wrapper

Create `.opencode/plugins/probity-debug.ts`:

```typescript
import type { Plugin } from '@opencode-ai/plugin';
import { createProbityHook } from 'opencode-probity';

export const ProbityDebugPlugin: Plugin = async ({ client }) => {
  const debugPath = `${process.env.HOME}/.cache/opencode/probity-debug.jsonl`;
  const hook = createProbityHook({ client, debugPath });

  return {
    'tool.execute.before': hook,
  };
};
```

Then set `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./.opencode/plugins/probity-debug.ts"]
}
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
