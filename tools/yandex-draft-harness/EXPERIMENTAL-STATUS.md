# Yandex Draft Runtime Harness — experimental/runtime-harness-v1.2

Status: **experimental runtime snapshot**, tested locally against real Yandex Games draft pages.

Current tested checker candidate: `v1.2.8-test`.  
Current Harness: `1.0.0-summary-integrity`.

Practical usage guide: [`README.md`](README.md).

## What this branch is

This branch preserves the runtime-harness work separately from stable `main` so it can be reviewed without pretending that the experimental code is already a public release.

It currently contains:

- the documented runtime architecture and evidence model;
- the latest live-tested `v1.2.8-test` behavior;
- validation notes;
- the exact latest patch step `v1.2.7 → v1.2.8`;
- user-facing instructions for the tested local workflow.

The stable root `debugcheck.js` is intentionally not replaced yet. The local development toolchain will be consolidated into clean repository sources after review.

## What is already proven in live draft runs

- CDP/OOPIF attachment to the actual game iframe inside `yandex.ru/games/app/...`.
- Checker injection without modifying the uploaded game build.
- Official Yandex platform events are collected as a second evidence source.
- `LoadingAPI.ready()` can be confirmed from runtime/platform evidence for Unity/WASM builds where static source scanning is insufficient.
- SDK initialization is not considered proven merely because `window.YaGames` exists.
- Interstitial pause/resume can be confirmed from `game_api_pause` / `game_api_resume`.
- Early game-frame input is latched and is not erased by a later successful SDK/ready state.
- A strong game control that reacts before SDK/`ready()` is reported as a hard failure.
- `Event Timeline` exposes `ORDER OK`, `ORDER RISK`, or `ORDER FAIL`, and native `timeline.status` is included in the structured report.
- Language checks that cannot be proved automatically use a separate `MANUAL` status with explicit instructions instead of silently appearing as PASS or generic WARN.
- Runtime `contextmenu` probing is scoped to the actual game interaction surface/canvas.
- `GameReady timing` no longer claims `SDK init → ready → gameplay` unless `GameplayAPI.start()` was actually observed. A `stop()` without a `start()` is `NOT VERIFIED`, not PASS.

## Latest v1.2.8 regression case

The live regression that motivated v1.2.8 had:

- SDK init observed;
- `LoadingAPI.ready()` observed;
- `GameplayAPI.start()` not observed;
- `GameplayAPI.stop()` observed.

Correct result: lifecycle order is **NOT VERIFIED**. `stop()` may be emitted by platform ad/visibility handling and must not be treated as evidence that `start()` happened.

The exact tested v1.2.7 → v1.2.8 patch is stored in:

`patches/upgrade-debugcheck-v1.2.7-to-v1.2.8.mjs`

## How to use the tested local workflow

The fully tested development copy currently runs from one permanent folder:

```powershell
cd F:\ProjectForgeUniversal\yg-yandex-draft-harness
.\RUN-CHECKER.bat
```

Paste a Yandex Games URL when prompted. After the first build, quick repeat runs use:

```powershell
cd F:\ProjectForgeUniversal\yg-yandex-draft-harness
.\RUN-CHECKER-QUICK.bat
```

Reports are stored separately as:

`reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>`

See [`README.md`](README.md) for the full testing procedure, status meanings, report files, manual language verification, and known limitations.

## PR / merge status

A PR from this branch to `main` is useful for review and discussion, but should be treated as **experimental / draft** for now.

Before a final merge we still want to:

- squash the local v1.2.x patch chain into one clean `debugcheck.js` candidate;
- add the Harness and launchers as normal standalone repository source files;
- fix App ID extraction for slug URLs ending in `-<id>`;
- add compact regression fixtures from the already tested games.

No merge to `main` is implied by this experimental branch.