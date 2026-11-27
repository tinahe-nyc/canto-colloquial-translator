# Kapok Club — project guide

Build a speaking coach for natural Guangzhou Cantonese. Keep the front end readable by someone who cannot read Chinese: Jyutping is part of every result. Preserve meaning, listener and register; keep starter examples clearly distinguishable from generated lessons. The original owner's brief stays local in `CANTO_PROMPT.md`.

## Code map

- `index.html`: responsive coach, access screen, phrase audio, browser phrasebook, flashcards and Jyutping guide.
- `api/translate.js`: access check/login, translation, alternatives and optional shared practice log. `api/speak.js`: generated speech.
- `lib/server/`: server-only session, provider, dictionary, audio, built-in examples and Neon access. Never send secret values to browser code or logs.
- `db/schema.sql` and `scripts/migrate.mjs`: additive practice log migration; no phrase text is stored.
- `scripts/dev.mjs`: local Node HTTP server; `scripts/build.mjs`: single-file build. `tests/`: server and study tests.

## Where things live

- [Public GitHub repository](https://github.com/tinahe-nyc/canto-colloquial-translator) · [CI](https://github.com/tinahe-nyc/canto-colloquial-translator/actions)
- [Production app](https://kapok-club.vercel.app) · [Vercel project](https://vercel.com/tinahe-nyc/canto-colloquial-translator) · [tested mobile feature preview](https://canto-colloquial-translator-o17rg11l1-tinahe-nyc.vercel.app). Production and preview were deployed from explicit GitHub references. Automatic deployment on push requires the repository to be connected in Vercel's Git settings.
- [Neon project](https://console.neon.tech/app/projects/icy-night-53681871) · [production tables](https://console.neon.tech/app/projects/icy-night-53681871/branches/br-floral-tooth-bcljl06d/tables). Directly provisioned in AWS US East (N. Virginia). This setup uses one database for development, preview and production; do not use real personal phrases as test data.

## Development and release

Use Node 22 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, supply the required variables in git-ignored `.env.local` (names and responsibilities are in README), and run `pnpm db:migrate` against the intended branch. Start with `pnpm dev` at http://127.0.0.1:3000. Run `pnpm test` and `pnpm build`. Use `pnpm start` to check the production page locally.

Use a feature branch for review. CI runs tests and builds the single page; the intended Vercel flow is a preview per non-main push and production from `main`. Verify the actual deployment, especially after changing environment variables (requires a fresh build). Never commit `.env.local`, local tooling, credentials, or user data. The public starter actions serve only authored examples. Custom translations, provider audio, and database reads/writes require the friends passcode.
