# Development and operations

[← Project overview](../README.md) · [LLM assistant](ai-assistant.md)

## Local configuration

Use Node.js 22+ and `npm ci` to install the lockfile versions. Copy `.env.example` to `.env`, generate a unique authentication secret, and create `data/` before running migrations.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Local `file:./data/emaus.db` or a hosted libSQL URL. |
| `DATABASE_AUTH_TOKEN` | Token for a hosted libSQL database; omitted for local SQLite. |
| `BETTER_AUTH_SECRET` | A unique server-side authentication secret. |
| `BETTER_AUTH_URL` | The application’s URL; used by authentication and public check-in links. |
| `SEED_PASSWORD` | Optional replacement for the local demo account password. |
| Provider variables | See [assistant configuration](ai-assistant.md#provider-configuration). |

Next.js loads its standard environment files. CLI migration and seed scripts explicitly load `.env` through `src/db/load-env.ts`; they do not automatically load `.env.local`. Drizzle Kit reads `process.env` in `drizzle.config.ts`, so export credentials in the shell when running generation or Studio against a configured remote database. Explicit process environment values take precedence over `.env` in the script loader.

Never commit real environment files, databases, roster exports, or provider credentials. `.gitignore` excludes `.env*` except `.env.example`, `data/`, and `.vercel/`.

## Database workflow

The schema lives in `src/db/schema.ts`; committed SQL migrations live in `drizzle/`.

```bash
npm run db:generate
npm run db:migrate
```

Review generated SQL before applying it. The local client enables WAL, foreign keys, and a busy timeout. Hosted installations use Turso/libSQL through the same Drizzle schema.

`npm run db:seed` is a destructive demo-data operation. Use a fresh local database, not a production or shared database. It creates demo users, people, households, ministries, recurring events, and attendance. Without `data/roster.json`, people are generated; the ministry structure and event themes are inspired by a real church.

The optional `scripts/extract-whatsapp-roster.mjs` is a machine-specific roster import helper for an authorized local WhatsApp/nchat installation. It is not a setup prerequisite. Its output remains local in `data/roster.json`; exclude it from public demos because the seed will otherwise import real names.

## Checks and coverage

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The unit suite currently covers timezone/date handling, recurrence, and CSV parsing/export behavior. These checks do not replace browser verification of authentication, role scopes, QR check-in, data mutations, or LLM behavior. For those flows, use an isolated synthetic database and separate sessions for admin, secretary, and leader.

The [September 2026 E2E report](2026-09-25-levantamento-e2e-perfis.md) is historical evidence from an earlier implementation. Its old paths and findings should not be read as a test result for the current version.

## Deployment

The project is configured for Next.js on Vercel, with hosted libSQL/Turso storage. `vercel.json` sets the application region. A local SQLite file is suitable for a persistent local host, not the production data store of a serverless deployment.

1. Provision a database and set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in the deployment environment.
2. Set a unique `BETTER_AUTH_SECRET` and the correct public `BETTER_AUTH_URL`.
3. Set the chosen provider’s server-side credentials if the assistant is needed.
4. Apply reviewed migrations to the target database using securely supplied environment variables.
5. Build/deploy and verify login, role scopes, attendance, public check-in, and the assistant against appropriate test records.

This repository’s existing setup deploys pushes to `main` to production and other branches to previews. Confirm project Git settings before relying on that behavior. Do not seed a production database as part of deployment. Keep preview databases and credentials separate from production.

`deploy/emaus.service` and `deploy/deploy-rasp.sh` are the legacy persistent-host deployment path. Review hostname, destination, environment, and service settings before using them; the script can seed destructively when passed `--seed`.

## Public demo deployment

The public URL uses the separate `emaus-public-demo` Turso database. The previous `emaus` database is preserved. Production has `EMAUS_DEMO_MODE=true` and its own authentication secret, so old application sessions do not carry over.

The demo seed was created in an isolated local directory without a roster export, using `SEED_PASSWORD=admin`, then imported into the new database. This uses the seed’s internal password hashing; it does not lower the normal password validation policy. The public account is `admin` / `admin`.

Demo mode displays a persistent disclosure, blocks account-management operations through both application actions and the auth API, protects AI provider settings, and limits aggregate assistant requests to 3 per minute and 100 per rolling 24-hour window. Changes to synthetic community records are shared. There is no scheduled reset; maintainers can recreate the disposable demo from a fresh synthetic seed when necessary. Do not seed the preserved database.

To return to the private installation, securely restore its database URL/token and authentication configuration, disable `EMAUS_DEMO_MODE`, and redeploy. The public demo password must never be used for an installation containing real records.

## Backups

For a consistent local SQLite backup while the database is in use, use SQLite’s backup command:

```bash
sqlite3 data/emaus.db ".backup '/absolute/path/to/backups/emaus.db'"
```

Do not rely on copying only the main database file while WAL writes are in progress. Store backups outside the public repository, restrict access, and test restoration. For hosted libSQL, use the database provider’s supported backup/export and restoration process. Conversation history, notes, and audit data may contain personal information.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Database file cannot be opened | Create `data/`, verify the URL and permissions, and apply migrations. |
| Login fails after setup | Confirm migrations and optional local seed used the same database as Next.js. |
| CLI uses a different database | Check exported variables and `.env`; CLI scripts do not load `.env.local`. |
| Assistant says it is not configured | Set a provider key on the server and restart; inspect provider selection under Configurações → IA. |
| Provider rejects a model or rate-limits a turn | Check account access, configured model ID, quota, and endpoint compatibility. |
| An old conversation cannot reopen | Access scope or provider API kind may have changed; begin a new conversation. |
| A failed turn reports completed writes | Inspect the records before retrying; writes are not rolled back as one conversation transaction. |
| QR check-in links point to the wrong host | Correct `BETTER_AUTH_URL` and check the event’s check-in state. |
