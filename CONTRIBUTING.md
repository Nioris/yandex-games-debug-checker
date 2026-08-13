# Contributing

Changes to checks should be conservative because developers may use this project as a pre-moderation signal.

For a new or changed check:

1. Link the exact current Yandex Games requirement when claiming `requirement` or `recommendation` status.
2. Prefer WARN for regex, naming, architecture or framework-dependent evidence.
3. Add a hard FAIL only when the signal is direct enough to avoid common false positives.
4. Add or update a regression fixture in `tests/`.
5. Update `checks.csv` and run `npm run audit`.
6. Do not add telemetry, external uploads, score writes, purchases, save mutation, or other side effects to the checker.

Bug reports should include the checker version, browser, game technology (plain JS/engine/WASM), the reported check, and a minimal source snippet where possible. Do not attach private production credentials.
