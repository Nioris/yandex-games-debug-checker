# Methodology

The checker combines static pattern analysis with runtime observation.

## Static layer

`debugcheck.js` requests the current `index.html`, then fetches relative script and stylesheet URLs from the same origin. It concatenates those sources and runs small, intentionally transparent pattern checks. It does not upload source code and does not fetch absolute third-party URLs.

Static checks are useful for obvious integration mistakes but are not a parser or proof system. Minification, generated wrappers, engines and WASM can hide valid implementations or produce incidental matches. Therefore public policy downgrades non-audited static failures to WARN.

## Runtime layer

When loaded before the game scripts, the checker intercepts `YaGames.init()` and wraps selected SDK methods. It records events such as SDK initialization, `LoadingAPI.ready()`, gameplay markers, ad calls and SDK language access. Browser probes also inspect scroll behavior, viewport overflow, context-menu handling and console errors.

The instrumentation delegates to the original SDK methods. It is intended only for development/pre-submission builds.

## Verdict classes

- `REQ`: tied to a published Yandex Games requirement.
- `REC`: tied to a published recommendation.
- `HEURISTIC`: an engineering signal inferred from source or UI behavior.

These labels describe the source of the rule, not authorship. The implementation remains unofficial.

## Hard-fail policy

A public checker can do more harm than good if an implementation preference is presented as a platform violation. For that reason, only an audited allow-list can emit hard FAIL. Other negative results are rendered as WARN even if the underlying check function returned false.
