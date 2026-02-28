# Telegram Backend (NestJS, CQRS, DDD-lite)

Production-ready modular monolith for Telegram transport + business modules with strict domain boundaries.

## Principles

- TypeScript strict
- No `any`
- No default exports
- No circular imports
- Business logic isolated from transport and storage
- Repository contracts are stable and switchable via DI (`PRIMARY_DB=redis|postgres`)

## Layer Model

- `src/modules/system/*` — reusable system modules
- `src/modules/features/*` — client-specific feature modules
- `src/shared/*` — cross-cutting ports, adapters, config, health, global persistence wiring

## CQRS Rules

- `application/commands/*` — mutations only
- `application/queries/*` — reads only
- One command/query class + one handler class per file
- Telegram command handlers call only command/query handlers

## Project Tree

```text
src/
  main.ts
  app.module.ts

  modules/
    system/
      identity/
        identity.module.ts
        domain/
        application/
          commands/
          queries/
          ports/
        persistence/
          redis/
          postgres/
          mappers/

      broadcast/
        broadcast.module.ts
        broadcast.controller.ts
        domain/
        application/
          commands/
          queries/
          ports/
          services/
        persistence/
          redis/
          postgres/
          mappers/
        adapters/
          rabbitmq/
          telegram/
        workers/

      telegram/
        telegram.module.ts
        telegram.service.ts
        webhook.controller.ts
        commands/
        registry/

  shared/
    shared.module.ts

    domain/
      brand.ts
      iso-date.ts

    application/
      ports/
        cache.port.ts
        rate-limiter.port.ts
        clock.port.ts
        id-generator.port.ts
        logger.port.ts
        transaction-manager.port.ts
        job-dispatcher.port.ts
        telegram-idempotency-store.port.ts
        telegram-session-store.port.ts

    adapters/
      cache/
      rate-limit/
      transaction/
      logger/
      clock/
      id-generator/
      telegram/
      http/
      jobs/

    persistence/
      redis/
        redis.module.ts
        redis.provider.ts
        redis-key.schema.ts
      postgres/
        postgres.module.ts
        postgres.provider.ts

    config/
      app-config.module.ts
      app-config.service.ts
      env.schema.ts

    health/
      health.module.ts
      health.controller.ts
```

## PRIMARY_DB Switch

- `PRIMARY_DB=redis` → repositories resolve to Redis implementations
- `PRIMARY_DB=postgres` → repositories resolve to Postgres implementations
- Switch is configured in module DI factories; command/query handlers are unchanged.
- Postgres repositories use Kysely via `POSTGRES_DB` DI token.

## Postgres SQL Layer (Kysely)

- Kysely is used only in `src/shared/persistence/postgres` and Postgres repository adapters.
- Repository ports/contracts stay unchanged; domain and CQRS handlers are unaffected.
- `PostgresKyselyModule` creates a singleton Kysely client from `DATABASE_URL` (fallback `POSTGRES_URL`).
- `PostgresExecutionContextService` provides transaction-aware query execution for repositories.
- `PostgresTransactionManagerAdapter` delegates `runInTransaction` to Kysely transactions.

Why Kysely:

- strict compile-time table/column typing
- SQL-like query builder without heavy ORM runtime
- safe incremental migration from raw SQL with low behavioral risk

## Redis Always On

Redis is always used for:

- cache
- rate-limit
- telegram idempotency
- telegram session storage (optional)

Redis keys are centralized in:

- `src/shared/persistence/redis/redis-key.schema.ts`

## Dev / Prod Telegram Mode

- `NODE_ENV=development` → polling
- `NODE_ENV=production` → webhook

Webhook endpoint:

- `POST /telegram/webhook`
- secret validation via `x-telegram-bot-api-secret-token`

## Build / Run

```bash
pnpm install
pnpm build
pnpm dev
```

## Kysely How-To

### Add a New Table

1. Extend `PostgresDatabase` in `src/shared/persistence/postgres/postgres.database.ts`.
2. Add bootstrap/migration logic in the relevant Postgres bootstrap service (schema builder).
3. Update/create mapper `domain <-> persistence row`.

### Add a New Postgres Repository

1. Keep the repository port in `application/ports` unchanged.
2. Create repository in `persistence/postgres` and inject `POSTGRES_DB`.
3. Use `PostgresExecutionContextService.getClient(...)` for transaction-aware queries.
4. Return domain entities through mappers only.

### Write a Complex Query

1. Start with `db.selectFrom(...).select(...)`.
2. Use joins/subqueries with Kysely builders (`innerJoin`, `leftJoin`, `where`, `orderBy`, `limit`).
3. Keep DB-specific conditions in persistence layer only.
4. Map final rows to domain entities/DTOs in mapper layer.

## How To Add a New Feature Module

1. Create `src/modules/features/<feature-name>/<feature>.module.ts`.
2. Add domain model in `domain/`.
3. Add repository port contracts in `application/ports/`.
4. Add `application/commands/` and/or `application/queries/` handlers.
5. Add `persistence/redis` and `persistence/postgres` repository adapters + mappers.
6. Bind repository token in module provider factory using `AppConfigService.primaryDb`.
7. Expose only needed handlers/tokens from module exports.

## Test Skeleton

- `tests/unit/get-identity-profile.query.spec.ts`
- `tests/unit/identity/postgres-identity.repository.spec.ts`
- `tests/integration/redis-identity-repository.spec.ts`
- `tests/integration/postgres-identity-repository.spec.ts`
- `tests/integration/postgres-transaction-manager.spec.ts`
- `tests/integration/rabbitmq-broadcast-pipeline.spec.ts`

## Broadcast Pipeline (RabbitMQ)

Persistent broadcast campaigns are implemented in `src/modules/system/broadcast` with CQRS handlers and a dedicated worker consumer.

- Control plane:
  - `POST /broadcast/campaigns` (create)
  - `POST /broadcast/campaigns/:id/start`
  - `POST /broadcast/campaigns/:id/pause`
  - `POST /broadcast/campaigns/:id/resume`
  - `POST /broadcast/campaigns/:id/cancel`
  - `GET /broadcast/campaigns/:id`
  - `GET /broadcast/campaigns`
  - `GET /broadcast/dlq`
  - `POST /broadcast/dlq/requeue`
  - `POST /broadcast/dlq/discard`
- Persistence:
  - `PRIMARY_DB=redis|postgres` switch for broadcast campaigns repository
- Redis always-on:
  - broadcast idempotency keys
  - global rate-limiter keys
- Worker behavior:
  - chunk-based processing with cursor pagination over identities
  - retry with backoff and Telegram `retry_after` support
  - DLQ after max attempts
  - automatic recovery of running campaigns on startup

Design details: `docs/adr/0001-broadcast-rabbitmq.md`.
Postgres SQL layer ADR: `docs/adr/0002-kysely-postgres-persistence.md`.
