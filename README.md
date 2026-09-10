# Knight School with Clyde

Public portfolio and AI-assisted English learning platform for Clyde Agnew.

## Current direction

Knight School now combines:
- ESL and Business English positioning
- IELTS practice and coaching
- Speaking and workplace communication tools
- A teacher-facing Lesson Studio
- Clyde's professional journey and education-technology work

## AI architecture

The frontend never contains the OpenAI API key.

```
Browser
  -> /api/coach
  -> secure server environment variable: OPENAI_API_KEY
  -> OpenAI Responses API
```

The repository is configured for Vercel with `api/coach.js` and `vercel.json`.

### Required environment variables

```
OPENAI_API_KEY=your_project_key
OPENAI_MODEL=gpt-5.6-luna
```

Do not commit either value to this public repository.

## GitHub Pages behavior

GitHub Pages continues to host the static site. When the site is viewed on GitHub Pages before an external API URL is configured in `config.js`, the learning labs fall back to safe local demo mode.

To keep GitHub Pages as the public frontend while using Vercel only for the API, set:

```js
window.KNIGHT_SCHOOL = Object.freeze({
  apiUrl: "https://YOUR-VERCEL-DOMAIN.vercel.app/api/coach",
  brand: "Knight School with Clyde"
});
```

## Legacy URLs

- `ielts-generator.html` redirects to the IELTS lab in the unified studio.
- `ielts-script-builder.html` redirects to the Speaking Coach.

## Copyright

© 2026 Clyde Agnew. All Rights Reserved.
