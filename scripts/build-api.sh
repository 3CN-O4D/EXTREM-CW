#!/usr/bin/env bash
# Build the Vercel serverless function bundle.
#
# IMPORTANT: the bundle must export the Express app itself, because @vercel/node
# invokes the default export as a Node (req, res) request listener. Do NOT point
# this at server/src/index.ts - that wraps the app in serverless-http, which
# expects a serverless event object and then hangs forever on every request.
#
# The entry is piped in via stdin so the emitted module paths match what the
# bundle has always looked like (server/src/..., server/node_modules/...).
set -euo pipefail

cd "$(dirname "$0")/.."

printf "import { createApp } from './server/src/app';\nexport default createApp();\n" \
  | ./server/node_modules/.bin/esbuild \
      --bundle \
      --platform=node \
      --target=node20 \
      --format=cjs \
      --loader=ts \
      --sourcefile=stdin \
      --external:pg-native \
      --outfile=frontend/api/index.js

if grep -q 'serverless-http' frontend/api/index.js; then
  echo "ERROR: serverless-http got bundled in; the function will hang on every request." >&2
  exit 1
fi

echo "Wrote frontend/api/index.js"
