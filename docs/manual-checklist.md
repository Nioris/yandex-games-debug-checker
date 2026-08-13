# Manual pre-submission checklist

Use this after the checker reports no unexplained hard failures.

- Open the draft with the official Yandex Games debug panel and repeat the startup flow after manually dismissing the platform loader.
- Verify `LoadingAPI.ready()` changes at the actual moment the menu/game becomes interactive, including a cold load.
- Test every language declared in the Draft field, using Yandex language mocks; inspect Canvas/WebGL text manually.
- Reload after meaningful progress and confirm the exact state is restored. For mobile games, verify state after orientation changes.
- If IAP exists, test catalog display, currency/icon, purchase grant, consume flow, reload persistence and cloud save behavior.
- If rewarded ads exist, verify the user explicitly chooses the ad and the promised reward is granted once.
- Test interstitial placement in the context of the actual game type; user-action placements must start immediately, while long real-time games can use the documented timer flow.
- Verify sound and gameplay pause/resume through all fullscreen ad callbacks and after tab minimization.
- Test supported browsers, mobile/desktop orientations and the platforms declared in the draft.
- Verify archive size, `index.html` placement and filename rules outside the browser checker.
- Review console errors during startup, gameplay, ads, orientation changes, save/load and repeated sessions.
- Review title, description, controls, screenshots, icons, age tag, content and promotional material against the current official requirements.
