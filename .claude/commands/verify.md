---
description: Fast sanity check — typecheck + dev-server smoke
---

Run a verify pass on the project and report green/red in one line at the end.

Steps:
1. Run `npm run typecheck` from the project root. Capture pass/fail.
2. Probe the dev server:
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → expect 200
   - `curl -s http://localhost:3000/api/trip | jq '{days: (.days|length), regions: (.regions|keys|length), baseOrder}'` → expect `{ days: 17, regions: 4, baseOrder: ["moxy","wagrain","ramsau","henriette"] }` for the default trip (or whatever shape matches the current `.data/austria-2026.json`).
   - If the server is unreachable (connection refused), report "dev server not running — skipped" — do **not** start it; just skip.
3. Final line, exactly one of:
   - `✓ verify OK — typecheck pass · home 200 · api 17d/4b` (numbers match actual current trip)
   - `✗ verify FAILED — <which step> · <one-line reason>`

Do not edit any files. Do not run lint or tests — there are none. The only checks are `tsc --noEmit` (via `npm run typecheck`) and the two curls above.
