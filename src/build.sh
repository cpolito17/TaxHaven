#!/usr/bin/env bash
# Assemble the self-contained game from its source parts.
set -euo pipefail
cd "$(dirname "$0")"
OUT="../public/index.html"
{
  cat head.html
  printf '\n<script>\n'
  cat engine.js
  printf '\n</script>\n<script>\n'
  cat ui.js
  printf '\n</script>\n</body>\n</html>\n'
} > "$OUT"
echo "Built $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
