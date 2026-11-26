# Kapok Club

[Open the speaking coach](https://canto-colloquial-translator.vercel.app). On iPhone, open the link in Safari, tap **Share → Add to Home Screen**, then **Add**. This is a web app, not an App Store listing. A network connection is needed to fetch lessons.

A public speaking coach for everyday Cantonese. Try a starter phrase, then read the Jyutping out loud. Each lesson includes a literal translation, tappable words, notes and a speaking tip. Sign in with a friends passcode to translate your own English for the listener you choose.

The three built-in lessons work without an AI key: **Have you eaten yet?**, **I'm going home now.**, and **I'm tired.** Starter lessons are labeled and do not change with listener or style. Connect OpenRouter for new phrases, listener-specific wording and generated audio. The microphone depends on speech recognition support and permission on your device. Single-tone guide examples need an installed Cantonese device voice.

## Run locally

Use Node 22 and pnpm 11.25.0. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Open http://127.0.0.1:3000. Guests can use the three starter lessons, guides, phrasebook, and flashcards without a passcode or API key. To try custom lessons, create `.env.local` from `.env.example` and set a passcode and an OpenRouter key. The current interface does not use the shared practice log, so the database migration is optional.

- `APP_PASSCODE`: shared access code. Changing it invalidates existing sessions.
- `DATABASE_URL`: Neon connection for the optional practice log. The migration creates the table if needed; running it again preserves existing entries.
- `OPENROUTER_API_KEY`: enables custom translations and generated speech. Set it in Vercel's environment settings and redeploy to enable it on the site. In local development change `.env.local` and restart the server.
- `OPENROUTER_TEXT_MODEL` / `OPENROUTER_AUDIO_MODEL`: optional; defaults are `anthropic/claude-sonnet-5.5` and `openai/gpt-audio`. Prompt caching and on-demand requests reduce cost; costs and cache hits depend on the provider.
- `APP_SESSION_SECRET`: optional independent server-side secret for signing sessions. Preserve it across deployments; rotating it signs everyone out.

## Practice and privacy

Your phrasebook and flashcard progress stay in this browser profile. Clearing its site data removes them. Each lesson is saved locally. The coach can read saved Kapok Club phrases on the same browser. Review schedules start fresh in the new flashcards. For AI lessons, the server sends the requested phrase, listener, and any context you enter to OpenRouter. Generated audio sends the chosen Chinese script. A device or browser's speech recognition may use its own speech service.

Friends use a shared passcode and a signed session cookie. Set a spending limit on the OpenRouter key when enabling it. The server's request limits apply per instance.

## Verify and release

```sh
pnpm test
pnpm build
pnpm start
```

The build emits one HTML page in `dist/`. Vercel runs the two handlers under `api/` separately. See [AGENTS.md](AGENTS.md) for project links and release notes.
