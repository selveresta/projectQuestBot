#!/bin/sh

# shellcheck disable=SC2086
set -eu

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATA_FILE="${DATA_FILE:-/data/dump.rdb}"
TTL_DAYS="${TTL_DAYS:-7}"

timestamp="$(date +"%Y%m%d-%H%M%S")"
target_path="${BACKUP_DIR}/dump-${timestamp}.rdb"

redis_cli() {
  redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" "$@"
}

previous_save="$(redis_cli LASTSAVE || echo 0)"
redis_cli BGSAVE >/dev/null 2>&1 || true

tries=0
max_tries=20
sleep_seconds=3

while [ "${tries}" -lt "${max_tries}" ]; do
  current_save="$(redis_cli LASTSAVE || echo 0)"
  if [ "${current_save}" -gt "${previous_save}" ]; then
    break
  fi

  tries=$((tries + 1))
  sleep "${sleep_seconds}"
done

mkdir -p "${BACKUP_DIR}"

if [ ! -f "${DATA_FILE}" ]; then
  echo "[redis-backup] dump file not found at ${DATA_FILE}" >&2
  exit 1
fi

cp "${DATA_FILE}" "${target_path}"
echo "[redis-backup] backup stored at ${target_path}"

find "${BACKUP_DIR}" -type f -name "dump-*.rdb" -mtime +"${TTL_DAYS}" -print -delete 2>/dev/null || true
