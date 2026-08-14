# Yandex Games Debug Checker

An unofficial open-source pre-submission checker for Yandex Games.

The distribution is a single dependency-free `debugcheck.js` file. Load it after `/sdk.js` and before your game scripts. It scans same-origin HTML/JS/CSS and observes SDK calls, timing, ads, localization and browser behavior at runtime.

> This is an independent tool, not an official Yandex product. A PASS does not guarantee moderation approval. The official Yandex Games documentation remains the source of truth.

Public v1.1.0 contains 93 executable checks classified as **REQ** (linked to a published requirement), **REC** (published recommendation), or **HEURISTIC** (best-effort engineering signal).

## Quick start

```html
<script src="/sdk.js"></script>
<script src="debugcheck.js"></script>
<script src="game.js"></script>
```

Open the panel by pressing `Ctrl+Shift+2` three times, or call:

```js
YGDebugChecker.open();
```

Refresh it with `YGDebugChecker.refresh()`.

Remove the checker from the production build before release.

## Demonstration example: Orc Castle

[`examples/orc-castle`](examples/orc-castle/) contains a deliberately prepared small Canvas game in **before / after** states. It is a demonstration fixture designed to make checker behavior easy to inspect; it is not a published production game and not the result of auditing a randomly selected project.

The numbers below are not hard-coded. The browser audit actually runs both variants in Chromium, and the checker itself produces the PASS / FAIL / WARN / NOT VERIFIED results.

| Variant | PASS | FAIL | WARN | N/V | SCORE |
|---|---:|---:|---:|---:|---:|
| Before | 45 | 3 | 12 | 10 | 75% |
| After | 70 | 0 | 0 | 2 | 100% |

The `before` variant intentionally contains representative integration problems that the checker is expected to detect. The corrected `after` variant demonstrates SDK initialization, startup language detection, an input gate, Game Ready, optional Gameplay API lifecycle markers, mobile hardening and a sound toggle. The corrected example has no WARN/FAIL results. Two items remain NOT VERIFIED: first-paint timing in the headless harness and Canvas-rendered text, which DOM scanning cannot prove.

GitHub Pages uses a separate mock-SDK fixture. The production example [`examples/orc-castle/after/index.html`](examples/orc-castle/after/index.html) does not include the mock.

See [`examples/orc-castle/README.md`](examples/orc-castle/README.md).

## Result policy

Hard **FAIL** is reserved for a small audited allow-list of direct signals. Regex and architecture assumptions are downgraded to **WARN** by default. Optional features such as IAP, rewarded ads and leaderboards render as **N/A** when not detected.

See [`docs/checks.md`](docs/checks.md), [`docs/limitations.md`](docs/limitations.md), and [`docs/manual-checklist.md`](docs/manual-checklist.md).

## Official references

Reviewed on 2026-08-11 against:

- https://yandex.ru/dev/games/doc/ru/concepts/requirements
- https://yandex.ru/dev/games/doc/ru/concepts/moderation
- https://yandex.ru/dev/games/doc/ru/requirements/1/19
- https://yandex.ru/dev/games/doc/ru/requirements/2/14
- https://yandex.ru/dev/games/doc/ru/requirements/4/4
- https://yandex.ru/dev/games/doc/ru/requirements/1/9

Platform requirements change over time; re-audit the checker when the documentation changes materially.

## Tests

```bash
npm test
npm run audit
```

`npm run audit` includes a headless Chromium smoke test when a Chromium/Chrome binary is available.

## License

MIT. Yandex and Yandex Games are trademarks of their respective owners. This repository is not affiliated with or endorsed by Yandex.


### PASS / FAIL / WARN / NOT VERIFIED

The checker uses four result states:

- **PASS** — sufficient evidence of correct behavior was observed.
- **FAIL** — a hard-fail rule has confirmed evidence of a violation.
- **WARN** — an actual risk or heuristic signal was detected.
- **NOT VERIFIED** — the checker could not prove either correctness or a defect automatically. It is **not a warning** and is excluded from the score; it is tracked as automation coverage instead.

`environment.i18n.lang` is now confirmed from an actual runtime read. Projects with a custom language resolver may optionally expose a checker-only contract:

```js
window.YGDebugCheckerConfig = {
  supportedLanguages: ['ru', 'en'],
  resolveLanguage: resolveGameLanguage
};
```

This is not a Yandex Games requirement and is not needed by the game itself. It only lets the checker execute the resolver instead of relying on source inference.
