# Telegram Bot Backend (NestJS + grammY)

Production-oriented Telegram bot backend built as a modular monolith with clean boundaries:

- Transport layer: Telegram (grammY adapter inside Nest)
- Application layer: use-cases
- Domain layer: entities/policies/interfaces
- Infrastructure layer: Redis adapters, idempotency, sessions

## Runtime Modes

- `NODE_ENV=development` -> polling mode
- `NODE_ENV=production` -> webhook mode

Webhook endpoint:

- `POST /telegram/webhook`
- Header required: `x-telegram-bot-api-secret-token`

Health endpoint:

- `GET /health`

## Stack

- NestJS
- grammY
- TypeScript strict mode
- Zod validation
- Pino logger (Nest logger adapter)
- Redis
- pnpm-ready scripts

## Project Structure

```text
src/
  main.ts
  app.module.ts
  common/
    filters/
      global-exception.filter.ts
    interceptors/
      http-logging.interceptor.ts
    jobs/
      job-dispatcher.port.ts
      noop-job-dispatcher.service.ts
    logger/
      pino-logger.service.ts
  config/
    app-config.service.ts
    core-config.module.ts
    env.schema.ts
  modules/
    health/
      health.controller.ts
      health.module.ts
    referrals/
      application/
        apply-referral-bonus.use-case.ts
      domain/
        referral-policy.ts
      referrals.module.ts
    telegram/
      telegram.constants.ts
      telegram.types.ts
      telegram.module.ts
      telegram.service.ts
      webhook.controller.ts
      domain/
        user.entity.ts
      application/
        dto/
          start-command.dto.ts
          webhook-update.dto.ts
        ports/
          user-repository.port.ts
          idempotency-repository.port.ts
          session-store.port.ts
          rate-limiter.port.ts
        use-cases/
          handle-start-command.use-case.ts
          handle-status-command.use-case.ts
        telegram-application.module.ts
      infrastructure/
        telegram-infrastructure.module.ts
        redis.provider.ts
        redis-client-lifecycle.service.ts
        redis-user.repository.ts
        redis-idempotency.repository.ts
        redis-session.store.ts
        noop-rate-limiter.service.ts
      commands/
        start/
          start.command-handler.ts
          start.command.module.ts
        status/
          status.command-handler.ts
          status.command.module.ts
      registry/
        command-registry.service.ts
```

## Environment Variables

Required:

- `BOT_TOKEN`

Optional:

- `NODE_ENV` (`development` | `production`, default `development`)
- `PORT` (default `3000`)
- `REDIS_URL` (default `redis://127.0.0.1:6379`)
- `TELEGRAM_WEBHOOK_URL` (required in `production`)
- `TELEGRAM_WEBHOOK_SECRET` (required in `production`)
- `TELEGRAM_DROP_PENDING_UPDATES` (default `true`)
- `TELEGRAM_SESSION_ENABLED` (default `false`)
- `IDEMPOTENCY_TTL_SECONDS` (default `86400`)
- `REFERRAL_POINTS` (default `1`)
- `LOG_LEVEL` (`fatal|error|warn|info|debug|trace|silent`)

## Local Development

```bash
pnpm install
pnpm dev
```

## Build / Run

```bash
pnpm build
pnpm start
```

## Architecture Notes

### Telegram transport isolation

- Telegram command handlers are Nest providers (`StartCommandHandler`, `StatusCommandHandler`)
- They only map Telegram context to use-case input/output
- Business rules live in use-cases (`handle-start`, `handle-status`, referral use-case)

### Idempotency and stateless webhook

- Every update is checked in Redis (`RedisIdempotencyRepository`)
- Duplicate `update_id` is ignored
- Webhook handler is stateless and horizontally scalable

### Session support

- Optional Redis-backed grammY session adapter (`RedisSessionStore`)
- Toggle with `TELEGRAM_SESSION_ENABLED=true`

### Rate limiting integration point

- `RateLimiterPort` + `NoopRateLimiterService`
- Replace with Redis-based limiter without touching use-cases

### Background jobs integration point

- `JobDispatcherPort` + `NoopJobDispatcherService`
- Referral use-case dispatches a domain event (`referral.awarded`)
- Replace noop dispatcher with queue implementation (BullMQ/SQS/Kafka)

## How To Add New Feature

1. Create domain model/policy in `modules/<feature>/domain`.
2. Add use-case(s) in `modules/<feature>/application/use-cases`.
3. Define infrastructure ports in `application/ports`.
4. Implement adapters in `infrastructure` and bind with DI tokens.
5. Add transport adapters (Telegram command handlers/controllers) that call use-cases.
6. Register feature module in `app.module.ts` or parent module.
7. Add Zod DTO validation for inbound payloads.
8. Add logs through `PinoLoggerService` and keep errors handled by global filter.

## How To Add New Telegram Command

1. Create command handler provider in `modules/telegram/commands/<name>/<name>.command-handler.ts`.
2. Inject required use-case(s), parse input with Zod DTO.
3. Create `<name>.command.module.ts` and export handler.
4. Import module in `telegram.module.ts`.
5. Add handler to `TELEGRAM_COMMAND_HANDLERS` factory array.
6. Restart app; command is auto-registered by `CommandRegistryService`.
