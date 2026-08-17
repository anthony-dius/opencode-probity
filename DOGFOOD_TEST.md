# Dogfood Test Plan

This repository is now using the Probity plugin as dogfood. The plugin will enforce TDD rules on all code changes.

## Setup Complete ✅

- **Config**: `probity.config.ts` with `enforceTdd()` rule
- **Plugin**: `dist/index.js` compiled and ready
- **Hook**: Registered as `tool.execute.before` in OpenCode
- **Coverage**: All changes to `src/**` and `test/**` files

## Expected Behavior

When using OpenCode in this repo with the plugin active:

### ✅ Allowed Actions
- Writing new test files
- Writing implementation after test passes
- Reading files (hook skips non-write/bash tools)

### ❌ Blocked Actions  
- Writing implementation without a failing test first
- Would receive: "Missing test for this implementation"

## Testing the Plugin

To test with OpenCode:

```bash
# Start OpenCode in this directory
opencode

# Ask OpenCode to add a new feature without a test
# → Should be blocked by Probity

# Then ask OpenCode to:
# 1. Write a test first
# 2. Then write the implementation
# → Should be allowed
```

## Implementation Notes

The plugin:
1. **Intercepts** Bash/Write/Edit/NotebookEdit tool calls via `tool.execute.before` hook
2. **Discovers** `probity.config.ts` using walk-up resolution
3. **Spawns** `npx @nizos/probity --agent github-copilot` subprocess
4. **Evaluates** actions against configured rules
5. **Blocks** execution with reason if violation detected

## Debugging

To debug the plugin behavior and see all rule evaluations:

```bash
# Enable debug logging to a file
export OPENCODE_PROBITY_DEBUG="/tmp/probity-debug.jsonl"

# Start OpenCode
opencode

# In another terminal, watch the debug log
tail -f /tmp/probity-debug.jsonl | jq -C '.'
```

Each line will show the action evaluated and the verdict. See `DEBUG.md` for detailed debugging instructions.

## Files Involved

- `src/index.ts` - Main plugin export
- `src/translators/payload.ts` - Converts tools to Probity actions
- `src/adapters/probity.ts` - Subprocess communication
- `src/hooks/preToolUse.ts` - Hook implementation
- `src/config/discovery.ts` - Config file discovery
- `opencode.json` - Loads the plugin
- `probity.config.ts` - Defines rules

All thoroughly tested with 72 passing tests using strict TDD development.
