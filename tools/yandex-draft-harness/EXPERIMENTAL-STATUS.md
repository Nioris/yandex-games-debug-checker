# Yandex Draft Runtime Harness — experimental/runtime-harness-v1.2

Status: **experimental runtime snapshot**, tested locally against real Yandex Games draft pages.

Current tested checker candidate: `v1.2.8-test`.  
Harness: passive CDP/OOPIF runtime harness.

Practical install/run/report guide: [`README.md`](README.md).

## What this branch is

This branch preserves the runtime-harness work separately from stable `main` so it can be reviewed and reproduced without pretending that the experimental code is already a public release.

It contains:

- the documented runtime architecture and evidence model;
- the latest live-tested `v1.2.8-test` behavior;
- validation snapshots and regression notes;
- the tested builder and full `v1.2.0 → v1.2.8` patch-chain inside the verified development bundle;
- passive Harness launch tooling;
- a checksum-verifying installer for reconstructing the exact tested bundle from repository files.

The stable root `debugcheck.js` is intentionally not replaced.

## Reproducible bundle

The exact tested development ZIP is stored in `bundle/` as base64 parts because the repository write path used for this experimental snapshot is text-only.

`INSTALL-BUNDLE.ps1` reconstructs the ZIP, verifies it, and only then extracts its source files/launchers.

Expected SHA-256:

```text
87f64a93262589f39eb0c92253e8f756d38f848dcef392fd8de436ac2d7a340a
```

Run once:

```powershell
cd .\tools\yandex-draft-harness
.\INSTALL-BUNDLE.bat
```

Then run the checker with:

```powershell
.\RUN-CHECKER.bat
```

Repeat runs can use:

```powershell
.\RUN-CHECKER-QUICK.bat
```

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
- Language checks that cannot be proved automatically use an explicit manual/not-verified state instead of silently appearing as PASS.
- Runtime `contextmenu` probing is scoped to the actual game interaction surface/canvas.
- `GameReady timing` no longer claims `SDK init → ready → gameplay` unless `GameplayAPI.start()` was actually observed. A `stop()` without a `start()` is `NOT VERIFIED`, not PASS.

## Latest v1.2.8 regression case

The live regression that motivated v1.2.8 had:

- SDK init observed;
- `LoadingAPI.ready()` observed;
- `GameplayAPI.start()` not observed;
- `GameplayAPI.stop()` observed.

Correct result: lifecycle order is **NOT VERIFIED**. `stop()` may be emitted by platform ad/visibility handling and must not be treated as evidence that `start()` happened.

The tested `v1.2.7 → v1.2.8` patch is also preserved directly in:

`patches/upgrade-debugcheck-v1.2.7-to-v1.2.8.mjs`

The complete patch-chain is available after `INSTALL-BUNDLE`.

## Reports

Each launcher run writes a separate directory:

```text
reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>
```

Primary artifacts:

- `report.json` — structured checker/Harness report;
- `evidence.json` — reconciled STATIC/RUNTIME/PLATFORM evidence;
- `panel.txt` — text form of the checker panel;
- `console.json` — console/platform trace;
- `page.png` — final screenshot;
- `chrome.log` — Chrome/Harness technical log.

See [`README.md`](README.md) for the full test procedure and how to interpret these files.

## Local validation of this snapshot

Before publishing this repository snapshot, local `--self-test` passed for:

- `build-debugcheck-v1.2-test.mjs`;
- all eight upgrade stages from `v1.2.0` through `v1.2.8`;
- `yg-yandex-draft-harness-passive.mjs`.

These self-tests validate patch anchors/bootstrap/routing without requiring a live browser session. Live Yandex Games behavior still requires an actual runtime run.

## PR / merge status

A PR from this branch to `main` is useful for review and discussion, but should still be treated as **experimental / draft**.

Before a final merge we still want to:

- squash the experimental patch-chain into one clean checker candidate;
- convert the reconstructable development bundle into normal reviewed repository source layout;
- fix App ID extraction for slug URLs ending in `-<id>`;
- add compact regression fixtures from the already tested games;
- run the full project CI/regression suite against the consolidated candidate.

No merge to `main` is implied by this experimental branch.
