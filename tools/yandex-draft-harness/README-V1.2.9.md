# v1.2.9-test — August 2026 runtime evidence

Основное обновление Runtime Harness под изменения требований Яндекс Игр августа 2026.

- REQ 1.2 / 1.2.1: runtime observation of Yandex auth dialog timing.
- REQ 1.3: real focus-loss events + AudioContext.suspend correlation (<= 2s).
- REQ 1.9: orientation event is observed, semantic progress remains MANUAL/NOT VERIFIED.
- REQ 1.10: resize/orientation evidence + final overflow/scroll state.
- REQ 1.12: ads/IAP presence can be runtime-confirmed; no monetization is NOT VERIFIED, not FAIL.
- REQ 1.15: completeness remains manual unless an obvious WIP signal is found.
- REQ 4.4: actual interstitial start delay uses callbacks.onOpen when observable.
- Node.js 22+ is required; Python/pip/websocket-client fallback is removed/not used.
- Evidence schema bumped to v2.

Primary launcher: RUN-CHECKER.bat
Reports: reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>
