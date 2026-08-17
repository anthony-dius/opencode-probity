# Debug Logging Enabled ✅

This repository has debug logging enabled for the Probity plugin. All tool evaluations are logged to JSONL format for real-time monitoring.

## 📍 Debug Log Path

```
~/.cache/opencode/probity-debug.jsonl
```

Full path:
```
/Users/anthony/.cache/opencode/probity-debug.jsonl
```

## 🔍 Monitor Probity Calls

### Quick Command (Recommended)
```bash
tail -f ~/.cache/opencode/probity-debug.jsonl | jq -C '.'
```

### Alternative Commands

**View last 10 entries:**
```bash
tail -10 ~/.cache/opencode/probity-debug.jsonl | jq -C '.'
```

**Only violations:**
```bash
tail -f ~/.cache/opencode/probity-debug.jsonl | grep violation | jq -C '.'
```

**Only passes:**
```bash
tail -f ~/.cache/opencode/probity-debug.jsonl | grep -v violation | jq -C '.'
```

**Watch with auto-refresh:**
```bash
watch -n 1 'tail -5 ~/.cache/opencode/probity-debug.jsonl | jq -C "."'
```

## 🚀 How to Test

### Terminal 1: Start Monitoring
```bash
tail -f ~/.cache/opencode/probity-debug.jsonl | jq -C '.'
```

### Terminal 2: Start OpenCode
```bash
cd /Users/anthony/development/opencode-probity
opencode
```

### Terminal 2: Ask OpenCode to Add a Feature
```
Add a utility function that doubles numbers
```

### Watch Terminal 1
You'll see:
```json
{
  "action": {
    "kind": "write",
    "path": "/Users/anthony/development/opencode-probity/src/double.ts",
    "content": "export const double = (n: number) => n * 2;"
  },
  "verdict": {
    "kind": "violation",
    "reason": "Missing test for this implementation"
  },
  "timestamp": "2024-08-17T20:15:30Z"
}
```

❌ BLOCKED! Because no test was written first.

### Terminal 2: Ask for Test-First Approach
```
Write a test first
```

### Watch Terminal 1
You'll see a PASS because it's a test file.

### Terminal 2: Now Ask for Implementation
```
Now implement the function
```

### Watch Terminal 1
You'll see a PASS because the test is already green.

## 📋 What's Logged

Each line is a JSON object with:
- **action**: The tool call being evaluated (write or command)
- **verdict**: The result (pass or violation with reason)
- **timestamp**: When it was evaluated

Example VIOLATION:
```json
{
  "action": {
    "kind": "write",
    "path": "/src/feature.ts",
    "content": "export const feature = () => {};"
  },
  "verdict": {
    "kind": "violation",
    "reason": "Missing test for this implementation"
  },
  "timestamp": "2024-08-17T20:15:30Z"
}
```

Example PASS:
```json
{
  "action": {
    "kind": "write",
    "path": "/src/feature.test.ts",
    "content": "describe('feature', () => { it('works', () => {...}) })"
  },
  "verdict": {
    "kind": "pass"
  },
  "timestamp": "2024-08-17T20:15:35Z"
}
```

## 🔧 Configuration

Debug logging is configured in:
```
.opencode/plugins/probity-debug.ts
```

Which is loaded by:
```
opencode.json
```

To change the debug path, edit `.opencode/plugins/probity-debug.ts`:
```typescript
const debugPath = `${process.env.HOME}/.cache/opencode/probity-debug.jsonl`;
```

## 📊 Useful Commands

| Command | Purpose |
|---------|---------|
| `tail -f ~/.cache/opencode/probity-debug.jsonl \| jq -C '.'` | Watch in real-time (pretty) |
| `tail -10 ~/.cache/opencode/probity-debug.jsonl \| jq '.'` | Show last 10 |
| `wc -l ~/.cache/opencode/probity-debug.jsonl` | Count entries |
| `du -h ~/.cache/opencode/probity-debug.jsonl` | File size |
| `rm ~/.cache/opencode/probity-debug.jsonl` | Clear logs |
| `grep violation ~/.cache/opencode/probity-debug.jsonl \| wc -l` | Count violations |

## ✅ Setup Verification

- ✅ Debug plugin created: `.opencode/plugins/probity-debug.ts`
- ✅ OpenCode configured to load debug plugin
- ✅ Debug file location: `~/.cache/opencode/probity-debug.jsonl`
- ✅ Plugin rebuilt with debug enabled
- ✅ Ready to monitor!

## 🎯 Next Steps

1. **Monitor the debug log:**
   ```bash
   tail -f ~/.cache/opencode/probity-debug.jsonl | jq -C '.'
   ```

2. **Start OpenCode:**
   ```bash
   opencode
   ```

3. **Watch Probity in action:**
   - Ask OpenCode to add features
   - Watch violations and passes in real-time
   - See TDD rules being enforced

Enjoy debugging! 🚀
