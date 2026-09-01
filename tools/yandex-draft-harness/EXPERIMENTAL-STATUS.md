# Experimental Runtime Harness status

Current experimental bundle: **v1.2.9-test**.

This branch is a development track for checking an already uploaded Yandex Games build through Chrome DevTools Protocol/OOPIF. It is separate from the stable embedded `debugcheck.js` in `main`.

## v1.2.9 status

Local offline validation is complete:

- all `.mjs` files pass `node --check`;
- builder self-test passes;
- every upgrader self-test from v1.2.0 through v1.2.9 passes;
- the v1.2.9 upgrader produces a syntactically valid synthetic candidate;
- Runtime Harness self-test passes, including August 2026 evidence regressions;
- machine-specific absolute paths are removed;
- report evidence schema is now `schemaVersion: 2`.

A live Windows/Yandex draft smoke run is still required after downloading this bundle. This is intentional: browser login, platform frames, real ads, focus behavior and orientation need the actual user environment.

## August 2026 evidence

v1.2.9 adds conservative evidence for:

- REQ 1.2 / 1.2.1 — Yandex authorization timing;
- REQ 1.3 — focus loss correlated with `AudioContext.suspend()`;
- REQ 1.9 — orientation event captured, semantic progress remains MANUAL/NOT VERIFIED;
- REQ 1.10 — resize/orientation events plus final overflow/scroll probes;
- REQ 1.12 — observed ads/IAP vs NOT VERIFIED/intentionally waived;
- REQ 1.15 — obvious WIP signals, while overall completeness remains manual;
- REQ 4.4 — real interstitial `callbacks.onOpen` delay when observable.

The policy is evidence-first: missing evidence does not become a false PASS or FAIL.

## Runtime requirements

- Windows 10/11;
- Node.js **22+**;
- Chrome or Edge.

Python, pip and `websocket-client` are **not used** by the current Harness. If a launcher prints `Checking websocket-client...` or attempts `pip install`, it is an older/different copy.

## Installation / run

Use `INSTALL-BUNDLE.bat` as the installation entry point, then `RUN-CHECKER.bat`.

Example draft URL:

```text
https://yandex.ru/games/app/568867?debug-mode=16&draft=true&lang=ru
```

Reports are written to `reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>`.
