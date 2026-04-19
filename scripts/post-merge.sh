#!/bin/bash
set -e

echo "[post-merge] installing dependencies..."
npm install --no-audit --no-fund

if [ -n "$DATABASE_URL" ]; then
  echo "[post-merge] syncing database schema..."
  npx drizzle-kit push --force
else
  echo "[post-merge] DATABASE_URL not set, skipping schema sync."
fi

echo "[post-merge] done."
