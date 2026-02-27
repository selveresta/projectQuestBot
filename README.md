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

      quests/
        quests.module.ts
        domain/
        application/
          commands/
          ports/
        persistence/
          redis/
          postgres/
          mappers/

      telegram/
        telegram.module.ts
        telegram.service.ts
        webhook.controller.ts
        commands/
        registry/

    features/
      rewards/
        rewards.module.ts
        domain/
        application/
          commands/
          ports/
        persistence/
          redis/
          postgres/
          mappers/

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

## How To Add a New Feature Module

1. Create `src/modules/features/<feature-name>/<feature>.module.ts`.
2. Add domain model in `domain/`.
3. Add repository port contracts in `application/ports/`.
4. Add `application/commands/` and/or `application/queries/` handlers.
5. Add `persistence/redis` and `persistence/postgres` repository adapters + mappers.
6. Bind repository token in module provider factory using `AppConfigService.primaryDb`.
7. Expose only needed handlers/tokens from module exports.

## Test Skeleton

- `tests/unit/get-user-profile.query.spec.ts`
- `tests/integration/redis-user-repository.spec.ts`
- `tests/integration/postgres-user-repository.spec.ts`
