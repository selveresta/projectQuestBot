#!/bin/sh

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATA_DIR="${DATA_DIR:-/data}"
PROJECT_DIR="${PROJECT_DIR:-/project}"
PROJECT_DUMP="${PROJECT_DIR}/dump.rdb"
DUMP_PATH="${DATA_DIR}/dump.rdb"

restore_from_project_dump() {
  if [ -f "${PROJECT_DUMP}" ]; then
    echo "[redis-entrypoint] Restoring dump from project root: ${PROJECT_DUMP}"
    cp "${PROJECT_DUMP}" "${DUMP_PATH}"
    return 0
  fi
  return 1
}

restore_from_backups() {
  if [ ! -d "${BACKUP_DIR}" ]; then
    return 1
  fi

  latest_dump="$(ls -t "${BACKUP_DIR}"/dump-*.rdb 2>/dev/null | head -n 1 || true)"
  if [ -n "${latest_dump}" ] && [ -f "${latest_dump}" ]; then
    echo "[redis-entrypoint] Restoring dump from backups: ${latest_dump}"
    cp "${latest_dump}" "${DUMP_PATH}"
    return 0
  fi
  return 1
}

restore_dump_if_missing() {
  mkdir -p "${DATA_DIR}"

  if [ -f "${DUMP_PATH}" ]; then
    echo "[redis-entrypoint] Existing dump detected at ${DUMP_PATH}, skipping restore."
    return
  fi

  if restore_from_project_dump; then
    return
  fi

  if restore_from_backups; then
    return
  fi

  echo "[redis-entrypoint] No dump file available to restore."
}

persist_dump_to_project() {
  if [ -f "${DUMP_PATH}" ]; then
    mkdir -p "${PROJECT_DIR}"
    cp "${DUMP_PATH}" "${PROJECT_DUMP}"
    echo "[redis-entrypoint] Saved dump to project root: ${PROJECT_DUMP}"
  else
    echo "[redis-entrypoint] No dump file to persist."
  fi
}

restore_dump_if_missing

REDIS_PID=""

shutdown() {
  if [ -n "${REDIS_PID}" ]; then
    echo "[redis-entrypoint] Stopping redis-server (PID ${REDIS_PID})"
    kill "${REDIS_PID}" 2>/dev/null || true
    wait "${REDIS_PID}" 2>/dev/null || true
  fi
  persist_dump_to_project
}

trap shutdown INT TERM
trap persist_dump_to_project EXIT

"$@" &
REDIS_PID=$!
wait "${REDIS_PID}"
