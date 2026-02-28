# ADR 0001: Persistent Broadcast Pipeline via RabbitMQ

## Status

Accepted

## Context

In-memory runtime loops for mass Telegram broadcasts are not resilient: process restarts lose progress and queued work.

## Decision

Use a **chunk-based persistent pipeline** backed by RabbitMQ durable queues and persistent messages.

## Queue Topology

- Exchange: `BROADCAST_EXCHANGE` (`direct`, durable)
- Routing key for active chunks: `campaign.chunk`
- Queue: `BROADCAST_CHUNK_QUEUE` (durable)
- Retry queue: `BROADCAST_RETRY_QUEUE` (durable, DLX back to `BROADCAST_EXCHANGE/campaign.chunk`)
- DLX: `${BROADCAST_EXCHANGE}.dlx` (`direct`, durable)
- DLQ: `BROADCAST_DLQ_QUEUE` (durable, bound to DLX key `campaign.chunk.dead`)

## Processing Model

- One RabbitMQ message = one campaign chunk (`campaignId + cursor + attempt`).
- Worker fetches a recipient page from `identity` using cursor pagination (`BROADCAST_CHUNK_SIZE`).
- On success, worker enqueues the next chunk with the returned cursor.
- This prevents unbounded queue growth and supports restart-safe resume.

## Retry / DLQ Strategy

- Retry for transient/rate-limit failures.
- Delay = `retry_after` (from Telegram 429) or exponential backoff:
  - base: `BROADCAST_RETRY_BASE_DELAY_MS`
  - cap: `BROADCAST_RETRY_MAX_DELAY_MS`
- Max attempts: `BROADCAST_RETRY_MAX_ATTEMPTS`
- On max attempts reached, chunk is moved to DLQ and campaign `dlqCount` is incremented.

## Idempotency Strategy

- Dedup key: `broadcast:idempotency:{campaignId}:{identityId}` in Redis.
- TTL: `BROADCAST_IDEMPOTENCY_TTL_SECONDS`.
- Acquire before send; release on transient failure to allow retry.
- Prevents duplicate sends on redelivery/retry/recovery.

## Rate Limiting Strategy

- Global throttle via Redis rate limiter:
  - `key = rl:broadcast:global`
  - limit points: `BROADCAST_GLOBAL_RATE_LIMIT_POINTS`
  - window: `BROADCAST_GLOBAL_RATE_LIMIT_DURATION_SECONDS`
- On limit hit, worker waits until reset and continues.

## Recovery

- On module init, worker scans running campaigns and re-enqueues a chunk from saved cursor.
- Ensures campaign continuity after process restart.

## Control Plane

- Commands: create, start, pause, resume, cancel.
- Queries: status/progress, list campaigns, DLQ stats.
- Admin endpoints provided under `/broadcast/*` (including DLQ requeue/discard operations).
