#!/usr/bin/env bash
# Advisory spell-check (cspell) over RU markdown changed in this PR. Reporting-only: never fails the
# build (RU vocabulary calibration is a TODO — see DEPLOY_NOTES.md "RU spell"). The hard gates in the
# `lint` job are the anti-doorway linter and `docs:build`.
set -uo pipefail
BASE="${BASE_SHA:-origin/develop}"
mapfile -t ru_hubs < <(node -e '
  const manifest = require("./docs/content-pages.json");
  for (const hub of Object.values(manifest.hubs)) console.log(`docs/${hub.ru}/*.md`);
')
files=$(git diff --name-only "$BASE"...HEAD -- "${ru_hubs[@]}" 2>/dev/null || true)
if [ -z "$files" ]; then echo "spell-diff: no changed RU markdown"; exit 0; fi
echo "spell-diff: checking $files"
npx --yes cspell@10 --no-progress --no-summary --locale ru,en $files || true
exit 0
