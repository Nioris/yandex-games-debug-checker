# Manual pre-submission checklist

Use this after the checker reports no unexplained hard failures. Requirements were re-audited on 1 September 2026.

- Open the draft with the official Yandex Games debug panel and repeat the startup flow after manually dismissing the platform loader.
- Verify `LoadingAPI.ready()` changes at the actual moment the menu/game becomes interactive, including a cold load.
- If authorization exists, verify only Yandex ID is offered, the dialog opens only after a dedicated user action, the login offer explains its benefits, and the game remains usable as a guest if the player declines login (REQ 1.2/1.2.1).
- Test every language declared in the Draft field, using Yandex language mocks; inspect Canvas/WebGL text manually.
- Reload after meaningful progress and confirm the exact state is restored. For mobile games, make progress, rotate portrait↔landscape, and confirm the exact state is still present (REQ 1.9).
- Resize the desktop browser and rotate every supported mobile orientation; verify no clipping, overlap, system scroll/swipe-to-refresh or broken canvas layout (REQ 1.10).
- If IAP exists, test catalog display, currency/icon, purchase grant, consume flow, reload persistence and cloud save behavior.
- Verify monetization under REQ 1.12: the game contains ads or IAP, or—if monetization is intentionally disabled—the Draft developer comment explicitly says so. The startup ad does not count.
- If rewarded ads exist, verify the user explicitly chooses the ad and the promised reward is granted once.
- Test interstitial placement in the context of the actual game type. For user-action placements, verify the real ad starts without a reproducible delay over 0.33s; Yandex recommends comparing the normal device, incognito and another device. Draft mode uses real platform ads (REQ 4.4).
- Verify sound stops on every documented focus-loss case: minimize the browser/app, switch to another tab, and open the browser tab switcher. A stop delay up to 2 seconds is allowed; review the documented platform exceptions (REQ 1.3).
- Verify sound and gameplay pause/resume through fullscreen ad callbacks.
- Check desktop keyboard gameplay controls under at least two layouts (for example EN and RU); physical letter controls must not depend on the active layout (REQ 1.6.2.4).
- Review the full build for REQ 1.15: all texts, graphics, controls and mechanics are complete; no WIP screens, broken controls, placeholder assets or development-only UI remain.
- Test supported browsers, mobile/desktop orientations and the platforms declared in the draft.
- Verify archive size, `index.html` placement and filename rules outside the browser checker.
- In the Draft, verify the current console-only fields separately; as of 28 August 2026 the horizontal video field is mandatory.
- Review console errors during startup, gameplay, ads, orientation changes, save/load and repeated sessions.
- Review title, description, controls, screenshots, icons, age tag, content and promotional material against the current official requirements.
