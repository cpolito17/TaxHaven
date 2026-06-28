#!/bin/bash
# Assemble the single self-contained game into public/index.html
# from its parts (inlined CSS + engine + UI). Zero runtime dependencies.
set -e
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
