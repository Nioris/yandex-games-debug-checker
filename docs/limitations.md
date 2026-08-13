# Limitations

1. **Minification and obfuscation.** Static regex checks can miss code or match generated text accidentally.
2. **WASM and engine builds.** Unity, Godot and similar builds often hide game logic from static inspection. Runtime probes remain useful, but coverage is lower.
3. **Framework wrappers.** A valid SDK integration hidden behind generated wrappers may not match direct API signatures.
4. **Visual quality.** "Looks finished", overflow and similar checks are necessarily heuristic and cannot replace a human review on multiple devices.
5. **Localization.** The checker can verify SDK language access and inspect visible DOM text, but it cannot prove that every language declared in the Yandex draft is complete, especially Canvas/WebGL text.
6. **Saving.** The checker cannot prove a save round-trip across reload/device. `localStorage` can be valid for simple games without IAP; cloud saves are required for IAP and useful for cross-device continuity.
7. **Purchases.** Source signatures cannot prove that a purchased item is granted correctly or that console-side product configuration matches the build.
8. **Advertising context.** The checker cannot reliably infer whether a game is real-time or turn-based, whether a particular click is gameplay/non-gameplay, or whether a timer-based interstitial is valid. Such evidence is WARN unless the violation is direct.
9. **Archive metadata.** A browser script cannot accurately verify total uncompressed archive size, filenames, draft settings, declared platforms, orientation or promo assets.
10. **Moderation is broader.** Content rules, age rating, gameplay depth, controls, descriptions, screenshots, copyright and other manual criteria remain outside automated coverage.


## NOT VERIFIED vs WARN

`WARN` means the checker observed a concrete risk signal. `NOT VERIFIED` means it lacked enough evidence to decide automatically. A `NOT VERIFIED` item is not counted as a defect and is excluded from the score. For runtime-sensitive checks, re-run after startup/interactions; for custom language resolvers, the optional `YGDebugCheckerConfig.resolveLanguage` contract can provide deterministic evidence.
