# Contributing

Yandex Games Debug Checker is an unofficial pre-submission tool. Changes to checks should be conservative because developers may use the project as a pre-moderation signal.

## Where to start

- **Questions, ideas, new-check proposals, and uncertain rule interpretation:** use [GitHub Discussions](https://github.com/Nioris/yandex-games-debug-checker/discussions).
- **Reproducible checker bugs:** use the **Bug report** Issue form.
- **Reproducible false positives or incorrect check results:** use the **False positive / incorrect check** Issue form.
- **Security-sensitive reports:** follow [`SECURITY.md`](SECURITY.md) and do not post secrets publicly.
- **Code fixes:** open a pull request with tests when possible.

If you are unsure whether something is a checker defect or an interpretation question, start in Discussions. A confirmed, reproducible problem can then be moved to an Issue.

## Reporting a checker bug

A useful report includes:

1. Checker version.
2. Browser and version.
3. Game technology (plain JS, engine, WASM, etc.).
4. The affected check ID/title, if applicable.
5. Exact steps to reproduce.
6. Expected behavior and actual behavior.
7. A minimal source snippet or public reproduction when possible.

Do not attach private production credentials, API keys, player data, or unpublished secrets.

## Reporting a false positive or incorrect rule result

Please include the checker version, check ID/title, observed result, minimal reproduction, and why the result appears incorrect. For disputes about the interpretation of a Yandex Games requirement, link the relevant current official documentation when possible.

A false-positive report should be reproducible. If the result depends on framework architecture, minification, naming, or another ambiguous signal, discussion may be more appropriate than a hard defect report.

## Adding or changing a check

For a new or changed check:

1. Link the exact current Yandex Games requirement when claiming `requirement` or `recommendation` status.
2. Prefer WARN for regex, naming, architecture or framework-dependent evidence.
3. Add a hard FAIL only when the signal is direct enough to avoid common false positives.
4. Add or update a regression fixture in `tests/`.
5. Update `checks.csv` and run `npm run audit`.
6. Do not add telemetry, external uploads, score writes, purchases, save mutation, or other side effects to the checker.

## Pull requests

Keep changes focused. Explain which check or behavior is changing, why the change is safe, and what regression coverage was added. If the change affects a published Yandex Games requirement, include the official source used for the interpretation.

Before opening a PR, run:

```bash
npm test
npm run audit
```

If the full browser audit cannot run locally because Chromium/Chrome is unavailable, mention that explicitly in the PR.
