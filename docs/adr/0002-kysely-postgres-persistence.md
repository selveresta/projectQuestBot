# ADR 0002: Kysely as Postgres Persistence Layer

## Status

Accepted

## Context

Postgres repositories used direct raw SQL strings. This reduced type safety, increased manual mapping risk, and made query maintenance harder.

## Decision

Use Kysely as the only SQL access layer for Postgres persistence adapters.

- Keep domain model and repository ports unchanged.
- Keep CQRS handlers unchanged.
- Keep `PRIMARY_DB=redis|postgres` switch unchanged.
- Keep Redis as always-on cache/rate-limit/idempotency/session component.

## Implementation

- `PostgresKyselyModule` creates a singleton `Kysely<PostgresDatabase>` and exposes it via `POSTGRES_DB`.
- `PostgresDatabase` defines typed tables/columns.
- Postgres repositories use Kysely query builder and mappers (`domain <-> persistence`).
- `PostgresExecutionContextService` provides transaction-aware client resolution.
- `PostgresTransactionManagerAdapter` runs application work inside Kysely transaction boundary.

## Consequences

Positive:

- Better compile-time safety for table/column access.
- Less string-based SQL and fewer manual casts.
- Easier extension for new queries.

Tradeoff:

- Query builder learning curve for advanced SQL.
- Some edge cases may still need dialect-specific expressions, but must stay inside persistence layer.
