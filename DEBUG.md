# Probity Plugin Debug Configuration

The Probity plugin supports Probity's `--debug` flag to log all hook invocations for diagnostics.

## Usage

### Via Hook Options

When using the hook directly, pass `debugPath`:

```typescript
import { createProbityHook } from './src/hooks/preToolUse.ts';

const hook = createProbityHook({
  debugPath: '/tmp/probity-debug.jsonl',
});
```

### Via OpenCode Plugin

To enable debugging in your OpenCode project:

1. **Create a custom plugin file** in `.opencode/plugins/` that initializes the hook with debug enabled:

`.opencode/plugins/probity-debug.ts`
```typescript
import type { Plugin } from '@opencode-ai/plugin';
import { createProbityHook } from '@nizos/opencode-probity';

export const ProbityDebugPlugin: Plugin = async () => {
  const debugPath = `${process.env.HOME}/.cache/opencode/probity-debug.jsonl`;
  const hook = createProbityHook({ debugPath });

  return {
    'tool.execute.before': hook,
  };
};
```

2. **Update your `opencode.json`** to use the debug plugin instead of the standard one:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./.opencode/plugins/probity-debug.ts"]
}
```

## Debug Output Format

Debug logs are written in JSONL format (one JSON object per line). Each entry contains:

```json
{
  "action": {
    "kind": "write|command",
    "path": "absolute/path",
    "command": "shell command",
    "content": "file content or command"
  },
  "verdict": {
    "kind": "pass|violation",
    "reason": "violation reason if applicable"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

## Viewing Debug Logs

To monitor debug logs in real-time:

```bash
# Watch the debug file (macOS)
watch -n 1 -c 'tail -n 5 ~/.cache/opencode/probity-debug.jsonl | jq -C'

# Watch the debug file (Linux)
tail -f ~/.cache/opencode/probity-debug.jsonl | jq -C '.'
```

## Environment Variables

You can also set the debug path via environment variable:

```bash
export OPENCODE_PROBITY_DEBUG="/tmp/probity-debug.jsonl"
```

Then create a plugin that reads this:

```typescript
const debugPath = process.env.OPENCODE_PROBITY_DEBUG;
const hook = createProbityHook({ debugPath });
```

## Example Debug Session

After running OpenCode with debug enabled, check the logs:

```bash
$ tail ~/.cache/opencode/probity-debug.jsonl
```

Output:
```json
{"action":{"kind":"command","command":"npm run test"},"verdict":{"kind":"pass"},"timestamp":"2024-08-17T19:50:00Z"}
{"action":{"kind":"write","path":"/project/src/new-feature.ts","content":"export const feature = () => {}"},"verdict":{"kind":"violation","reason":"Missing test for this implementation"},"timestamp":"2024-08-17T19:50:05Z"}
{"action":{"kind":"write","path":"/project/src/new-feature.test.ts","content":"describe('feature', () => ...)"},"verdict":{"kind":"pass"},"timestamp":"2024-08-17T19:50:10Z"}
```

## Troubleshooting

If debug logs aren't appearing:

1. **Verify debugPath exists**: Ensure the directory exists and is writable
2. **Check permissions**: The user running OpenCode must have write access
3. **Monitor the hook**: Add console logging to verify the hook is being called
4. **Check Probity CLI**: Verify `npx @nizos/probity --help` works

## Performance Considerations

Enabling debug logging adds minimal overhead since it's handled by Probity itself (not the plugin). Debug entries are appended to a file, so:

- File I/O is non-blocking from the plugin's perspective
- Debug logs don't affect tool execution or verdicts
- Safe to enable in production workflows
