# Quick Reference - OpenCode Probity Plugin

## Configuration Options

### ProbityAdapter Options

```typescript
new ProbityAdapter({
  configPath?: string;      // Path to probity.config.ts (auto-discovered by default)
  debug?: boolean;          // Enable internal debug logging to console
  debugPath?: string;       // Path to write Probity debug JSONL file
  spawn?: typeof defaultSpawn; // Custom spawn function (for testing)
})
```

### createProbityHook Options

```typescript
createProbityHook({
  adapter?: ProbityAdapter;  // Custom adapter instance
  debug?: boolean;           // Enable internal debug logging
  configPath?: string;       // Override auto-discovery of probity.config.ts
  debugPath?: string;        // Path to write Probity debug JSONL file
})
```

## Common Usage Patterns

### Basic Usage (No Options)
```typescript
const hook = createProbityHook();
// Auto-discovers probity.config.ts
// No debug output
```

### With Config Override
```typescript
const hook = createProbityHook({
  configPath: '/custom/path/probity.config.ts'
});
```

### With Debug Logging
```typescript
const hook = createProbityHook({
  debugPath: '/tmp/probity-debug.jsonl'
});
// Logs all evaluations to JSONL file
```

### With Both Config and Debug
```typescript
const hook = createProbityHook({
  configPath: '/custom/probity.config.ts',
  debugPath: '/tmp/probity-debug.jsonl'
});
```

### Using Adapter Directly
```typescript
const adapter = new ProbityAdapter({
  configPath: '/path/to/config.ts',
  debugPath: '/tmp/debug.jsonl'
});

const verdict = await adapter.evaluateAction({
  kind: 'write',
  path: '/project/src/file.ts',
  content: 'export const x = 1;'
});

console.log(verdict); // { kind: 'pass' } or { kind: 'violation', reason: '...' }
```

## Probity CLI Equivalents

### What the Plugin Does Internally

```bash
# Basic call
npx @nizos/probity --agent github-copilot < action.json

# With custom config
npx @nizos/probity --agent github-copilot --config /path/to/probity.config.ts < action.json

# With debug logging
npx @nizos/probity --agent github-copilot --debug /tmp/probity-debug.jsonl < action.json

# With both
npx @nizos/probity --agent github-copilot --config /path/to/config.ts --debug /tmp/debug.jsonl < action.json
```

## Probity Action Format

The plugin translates OpenCode tools to Probity actions:

### Write Action (from Write/Edit/NotebookEdit)
```json
{
  "kind": "write",
  "path": "/absolute/path/to/file.ts",
  "content": "file content here"
}
```

### Command Action (from Bash)
```json
{
  "kind": "command",
  "command": "npm run test"
}
```

## Probity Verdict Format

The plugin receives verdicts from Probity:

### Pass Verdict
```json
{
  "kind": "pass"
}
```

### Violation Verdict
```json
{
  "kind": "violation",
  "reason": "Missing test for this implementation"
}
```

## Debug Log Format (JSONL)

Each line is a JSON object with this structure:

```json
{
  "action": {
    "kind": "write",
    "path": "/absolute/path",
    "content": "..."
  },
  "verdict": {
    "kind": "pass"
  },
  "timestamp": "2024-08-17T19:50:00Z"
}
```

## Environment Variables

- `OPENCODE_PROBITY_DEBUG` - Path to debug file (can be read by wrapper plugins)

## File Discovery

The plugin auto-discovers probity config using walk-up from current directory:

1. Checks for `probity.config.ts` in current directory
2. Checks for `probity.config.mts`
3. Checks for `probity.config.js`
4. Checks for `probity.config.mjs`
5. Walks up to parent directory
6. Repeats until filesystem root

### Override Discovery

```typescript
const hook = createProbityHook({
  configPath: '/explicit/path/probity.config.ts'
});
```

## Tools Intercepted

The hook intercepts these OpenCode tools:
- **Bash** - Converted to `{ kind: 'command'; command: string }`
- **Write** - Converted to `{ kind: 'write'; path: string; content: string }`
- **Edit** - Converted to `{ kind: 'write'; path: string; content: string }`
- **NotebookEdit** - Converted to `{ kind: 'write'; path: string; content: string }`

All other tools (Read, Grep, etc.) bypass the hook.

## Error Handling

The plugin uses a safe-fail approach:

- Missing probity.config.ts → Allow execution
- Subprocess error → Allow execution  
- JSON parse error → Allow execution
- Invalid payload → Skip evaluation, allow execution

This ensures the plugin never breaks the user's workflow.

## Performance

- Test suite: 72 tests run in ~25ms
- Single evaluation: <50ms typically
- Config discovery: Cached after first lookup
- No blocking operations in hot path

## Debugging Tips

### 1. Check if Config is Found
```bash
cd /project
npx @nizos/probity --help
# Should succeed if @nizos/probity is installed
```

### 2. Test Probity Directly
```bash
echo '{"kind":"write","path":"/src/file.ts","content":"x"}' | \
  npx @nizos/probity --agent github-copilot
```

### 3. Enable Debug Output
```bash
export OPENCODE_PROBITY_DEBUG="/tmp/probity-debug.jsonl"
# Run OpenCode
tail -f /tmp/probity-debug.jsonl | jq
```

### 4. Check Plugin Loading
```bash
node -e "import('./dist/index.js').then(m => console.log('✓', Object.keys(m)))"
```

## See Also

- `DEBUG.md` - Complete debugging guide
- `DOGFOOD_TEST.md` - Testing guide for this repo
- `probity.config.ts` - Example configuration
- `src/adapters/probity.ts` - Adapter implementation
- `src/hooks/preToolUse.ts` - Hook implementation
