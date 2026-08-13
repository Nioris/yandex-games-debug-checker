# Changelog

## 1.1.0 — 2026-08-11

- Added a distinct **NOT VERIFIED** state so lack of automatic evidence is no longer reported as WARN.
- `environment.i18n.lang` now uses real runtime read instrumentation and can PASS/FAIL automatically when the checker attaches before `YaGames.init()`.
- Added runtime ordering check: SDK language read before `LoadingAPI.ready()`.
- Improved `be/kk/uk/uz → ru` fallback inference for explicit maps, switch statements, grouped `Set`/array resolvers, and optional `YGDebugCheckerConfig.resolveLanguage`.
- Added automation coverage to the summary; NOT VERIFIED is excluded from quality score.
- Updated Orc Castle demo to expose the optional resolver contract for deterministic fallback verification.

## 1.0.0 — 2026-08-11

- Added the Orc Castle before/after integration example with real Chromium regression coverage.
- Added GitHub Pages demo build and deployment workflow.
- Reduced false ad warnings for games without fullscreen ads and made REQ-4.4 interstitial context handling match current platform guidance.
- Downgraded raw page-input-before-ready timing to an advisory signal instead of treating it as proof of accepted gameplay input.

First public release, derived from the internal Debug Checker v2.22.

Public-release changes:

- removed studio-specific variable/function conventions and screenshot-tool dependencies;
- removed `.pre-submit-report.json` / internal pipeline integration;
- removed leaderboard tools that could write test scores;
- made sound, interstitial ads, rewarded ads and cloud-save categories optional;
- removed mandatory presence checks for optional `GameplayAPI.start/stop` and pause/resume events;
- removed the fixed "13 languages" rule and internal `setLang()` assumptions;
- corrected Game Ready timing from an internal 10-second heuristic to the documented 90-second moderation window;
- removed the blanket warning against `localStorage` for simple non-IAP games;
- updated IAP currency references from deprecated 3.8 wording to 1.13.2;
- changed interstitial user-gesture timing to contextual WARN because timer-based ads can be valid in long real-time gameplay;
- added REQ / REC / HEURISTIC labels and a conservative hard-fail policy;
- added public API `YGDebugChecker.open()`, `refresh()`, and `close()`;
- added tests, browser smoke test, CI, documentation and public audit notes.
