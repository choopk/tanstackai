# OpenRouter

The OpenRouter API key for this project lives in `.env.local` as `OPENROUTER_API_KEY`
(never commit it). Reference request shape:

```js
fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': '<YOUR_SITE_URL>',
    'X-Title': '<YOUR_SITE_NAME>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [{ role: 'user', content: 'What is the meaning of life?' }],
  }),
});
```

In this app you don't call OpenRouter directly — TanStack AI's
`@tanstack/ai-openrouter` adapter (`openRouterText`) handles it server-side.
