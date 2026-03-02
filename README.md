# NestJS Telegram Bot Template

Production-ready template repository for Telegram bots with:

- modular architecture (`system` vs `features`)
- CQRS discipline
- `PRIMARY_DB` switch (`redis | postgres`) through DI only
- Redis always-on cross-cutting adapters
- typed env config with schema validation
- local infrastructure via Docker Compose

This repository is intended for **GitHub Template** usage (`Use this template`), not fork/upstream workflow.

## Create New Project From Template (5-10 minutes)

1. Click `Use this template` on GitHub and create a new repository.
2. Clone your new repository.
3. Copy env file:
   ```bash
   cp .env.example .env
   ```
4. Fill required variables in `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `PRIMARY_DB`
   - `REDIS_URL`
   - `DATABASE_URL` (if `PRIMARY_DB=postgres`)
5. Start local dependencies:
   ```bash
   docker compose up -d redis postgres
   ```
6. Start application:
   ```bash
   pnpm install
   pnpm dev
   ```
7. Verify health:
   - `GET /health/live`
   - `GET /health/ready`

## Rename Checklist After Template Creation

Update these files first:

1. `package.json`
   - `name`
   - `description`
   - `version`
2. `README.md`
   - project title
   - domain-specific documentation sections
3. `.env.example`
   - feature flags relevant to your project
4. Optional: CI/CD and deployment manifests in your new repository.

## Architecture Boundaries

```text
src/
  modules/
    system/
      identity/
      telegram/
      broadcast/                 # optional system module, not wired by default
    features/
      features.module.ts         # composition root for client features
      template-status/           # example feature module
  shared/
    adapters/
    persistence/
    application/
    config/
    health/
```

Rules:

- `modules/system/*` are stable platform modules.
- `modules/features/*` are client-specific modules.
- `shared/adapters/*` are technical integrations.
- `shared/persistence/*` and module-local `persistence/*` are storage adapters.
- No `infrastructure`, `core`, `interfaces`, `contexts` base layers.

## What Not To Change

In normal client projects, do not modify:

- `src/modules/system/telegram/*` transport internals
- `src/modules/system/identity/*` platform identity flow
- shared adapter contracts in `src/shared/application/ports/*`
- base DI tokens and global wiring in `src/shared/*`

Client customization should happen mostly in `src/modules/features/*`.

## Extension Points (No Core Hacking)

Feature integration is done via contribution tokens:

- `FEATURE_TELEGRAM_COMMAND_HANDLERS`
- `FEATURE_TELEGRAM_POLICY_HOOKS`
- `FEATURE_TELEGRAM_EVENT_HOOKS`

System side contributes:

- `SYSTEM_TELEGRAM_COMMAND_HANDLERS`
- `SYSTEM_TELEGRAM_POLICY_HOOKS`
- `SYSTEM_TELEGRAM_EVENT_HOOKS`

`TelegramModule` composes final runtime registries from both sides.  
Adding a feature module must not require editing system modules.

## How To Add New Feature Module

1. Create `src/modules/features/<feature-name>/`.
2. Add CQRS handlers:
   - `application/commands/*` for mutations
   - `application/queries/*` for reads
3. Add Telegram command handlers in `telegram/commands/*`.
4. Export feature command handlers via feature-local token.
5. Import feature module in `src/modules/features/features.module.ts`.
6. Contribute handlers through `FEATURE_TELEGRAM_COMMAND_HANDLERS`.
7. Add feature toggles in `.env` and `EnvSchema`.

Command handler pattern:

```ts
readonly command = "my_command";
readonly featureFlag = "feature.my-command"; // optional
readonly access = "admin"; // optional
readonly requiresIdentity = true; // optional
```

## CQRS and Transport Discipline

- Telegram handlers call only command/query handlers.
- No direct repository usage from Telegram transport layer.
- Mutations live in `application/commands/*`.
- Reads live in `application/queries/*`.

## PRIMARY_DB Switch

- `PRIMARY_DB=redis` -> Redis repository implementations
- `PRIMARY_DB=postgres` -> Postgres repository implementations
- Selection is DI-only (module provider factories)
- Business handlers and transport code are unchanged

## Redis Always-On

Redis is always used, regardless of `PRIMARY_DB`:

- cache
- rate limiting
- idempotency
- Telegram session store

## Environment Variables

All variables are defined in `.env.example` and validated by `EnvSchema`.

Core:

- `NODE_ENV` (`development|production`)
- `PORT`
- `LOG_LEVEL`

Telegram:

- `TELEGRAM_BOT_TOKEN` (required)
- `TELEGRAM_WEBHOOK_URL` (required in production)
- `TELEGRAM_WEBHOOK_SECRET` (required in production)
- `TELEGRAM_DROP_PENDING_UPDATES`
- `TELEGRAM_SESSION_ENABLED`

Access / policy:

- `TELEGRAM_ALLOWLIST_IDS` (comma-separated IDs)
- `TELEGRAM_ADMIN_IDS` (comma-separated IDs)

Feature flags:

- `FEATURES_ENABLED` (comma-separated module names)
- `FEATURE_TEMPLATE_PING_ENABLED`
- `FEATURE_TEMPLATE_ADMIN_STATUS_ENABLED`

Persistence:

- `PRIMARY_DB` (`redis|postgres`)
- `REDIS_URL` (always required)
- `DATABASE_URL` (required when `PRIMARY_DB=postgres`)
- `POSTGRES_POOL_MIN`
- `POSTGRES_POOL_MAX`

Broker (optional):

- `BROKER_ENABLED`
- `AMQP_URL`

Broadcast module defaults (optional module):

- `BROADCAST_EXCHANGE`
- `BROADCAST_CHUNK_QUEUE`
- `BROADCAST_RETRY_QUEUE`
- `BROADCAST_DLQ_QUEUE`
- `BROADCAST_CHUNK_SIZE`
- `BROADCAST_PREFETCH`
- `BROADCAST_CONCURRENCY`
- `BROADCAST_RETRY_MAX_ATTEMPTS`
- `BROADCAST_RETRY_BASE_DELAY_MS`
- `BROADCAST_RETRY_MAX_DELAY_MS`
- `BROADCAST_IDEMPOTENCY_TTL_SECONDS`
- `BROADCAST_GLOBAL_RATE_LIMIT_POINTS`
- `BROADCAST_GLOBAL_RATE_LIMIT_DURATION_SECONDS`
- `BROADCAST_RECOVERY_BATCH_SIZE`

## Dev vs Prod Modes

- `NODE_ENV=development` -> Telegram polling mode
- `NODE_ENV=production` -> Telegram webhook mode

Webhook endpoint:

- `POST /telegram/webhook`

## Local Development (Docker Compose)

Services:

- `redis` (always-on runtime dependency)
- `postgres` (primary DB option)
- `rabbitmq` (optional, `--profile broker`)

Start base services:

```bash
docker compose up -d redis postgres
```

Start optional broker:

```bash
docker compose --profile broker up -d rabbitmq
```

## Scripts

- `pnpm dev`
- `pnpm start:dev`
- `pnpm start:polling`
- `pnpm build`
- `pnpm start`
- `pnpm start:webhook`
- `pnpm start:prod`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`

## Operational Hygiene

- TypeScript `strict` mode enabled
- no `any`
- no default exports
- unified structured logging (`pino`)
- graceful shutdown hooks
- global HTTP error filter + Telegram error responder
- liveness/readiness endpoints

## How To Sync Template Changes To Existing Projects

Template-based repositories do not auto-sync. Use one of these strategies:

1. Manual upstream remote
   - add original template as additional remote
   - periodically fetch and cherry-pick/rebase selected commits
2. `git subtree`
   - keep template code in dedicated subtree path
   - pull updates into existing project with subtree commands
3. Shared packages extraction (future)
   - move stable system modules/adapters to internal packages
   - consume versions from client repositories

Pick one strategy early and document it in each client repository.

## ADR

- `docs/adr/0001-broadcast-rabbitmq.md`
- `docs/adr/0002-kysely-postgres-persistence.md`
