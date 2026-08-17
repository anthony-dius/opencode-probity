import { defineConfig, enforceTdd, type Verdict } from '@nizos/probity'

const ai = {
  async reason(prompt: string): Promise<Verdict> {
    const key = process.env.GOOGLE_AI_GEMINI_API_KEY
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 256 },
      }),
    })

    if (!res.ok) {
      return { kind: 'violation', reason: `AI error: ${res.status}` }
    }

    const data = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    try {
      const json = JSON.parse(text.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim())
      if (json.kind === 'pass' || json.kind === 'violation') {
        return { kind: json.kind, reason: json.reason ?? '' }
      }
      return { kind: 'violation', reason: `unexpected: ${text.slice(0, 200)}` }
    } catch {
      return { kind: 'violation', reason: `parse error: ${text.slice(0, 200)}` }
    }
  },
}

export default defineConfig({
  ai,
  rules: [
    {
      files: ['src/**', 'test/**'],
      rules: [enforceTdd()],
    },
  ],
})
