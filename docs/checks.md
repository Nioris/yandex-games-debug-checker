# Check catalog

This public release contains **99 executable checks**. The catalog is generated from `checks.csv`.

Classification meanings: `requirement` = tied to a published Yandex Games requirement; `recommendation` = tied to section 6 or another explicit recommendation; `heuristic` = best-effort engineering signal. The checker itself is unofficial.

| Section | Type | Check | Requirement | Class |
|---|---|---|---|---|
| SDK Integration | static | SDK script tag | 1.1 | requirement |
| SDK Integration | static | YaGames.init() | 1.19.1 | requirement |
| Lifecycle API | static | LoadingAPI.ready() | 1.19.2 | requirement |
| Authorization | static | No third-party auth markers (п.1.2) | 1.2 | requirement |
| Authorization | static | Yandex auth starts from user action (п.1.2.1) | 1.2.1 | requirement |
| Authorization | static | Auth benefits explained (п.1.2.1) | 1.2.1 | requirement |
| Authorization | static | Guest play available (п.1.2) | 1.2 | requirement |
| Sound Management | static | Sound stops on focus loss (п.1.3) | 1.3 | requirement |
| Sound Management | static | AudioContext suspend/resume | — | heuristic |
| Ads — Interstitial | static | showFullscreenAdv | — | heuristic |
| Ads — Interstitial | static | onOpen callback | — | heuristic |
| Ads — Interstitial | static | onClose callback | — | heuristic |
| Ads — Interstitial | static | onError callback | — | heuristic |
| Ads — Rewarded | static | showRewardedVideo | — | heuristic |
| Ads — Rewarded | static | onRewarded callback | — | heuristic |
| Ads — Rewarded | static | onOpen callback | — | heuristic |
| Ads — Rewarded | static | onClose callback | — | heuristic |
| Cloud Saves | static | player.setData() | — | heuristic |
| Cloud Saves | static | player.getData() | — | heuristic |
| In-App Purchases | static | getPayments() | — | heuristic |
| In-App Purchases | static | consumePurchase() | — | heuristic |
| In-App Purchases | static | getPurchases() | — | heuristic |
| In-App Purchases | static | getCatalog() called (REQ-1.13.2) | 1.13.2 | requirement |
| In-App Purchases | static | No hardcoded ₽/$/€ near numbers (REQ-1.13.2) | 1.13.2 | requirement |
| Localization (I18N) | runtime | environment.i18n.lang | 2.14 | requirement |
| Localization (I18N) | static | Yandex lang fallback | — | heuristic |
| UX & Mobile | static | Context menu disabled | 1.6.2.7 | requirement |
| UX & Mobile | static | Text selection disabled | 1.6.2.7 | requirement |
| UX & Mobile | static | touch-action configured | — | heuristic |
| UX & Mobile | static | Viewport meta tag | — | heuristic |
| UX & Mobile | static | Overflow hidden on body/html | 1.10.2 | requirement |
| UX & Mobile | static | overscroll-behavior | 1.10.2 | requirement |
| UX & Mobile | static | -webkit-touch-callout: none | — | heuristic |
| Common Rejections | static | Scroll prevention (п.1.10.2) | 1.10.2 | requirement |
| Common Rejections | static | Swipe-to-refresh blocked (iOS/Android) | 1.10.2 | requirement |
| Common Rejections | static | GameReady timing (п.1.19) | 1.19 | requirement |
| Common Rejections | static | I18N auto-detection (п.2.14) | 2.14 | requirement |
| Common Rejections | static | Sound paused during ads (п.4.7) | 4.7 | requirement |
| Common Rejections | static | Game paused during ads (п.4.7) | 4.7 | requirement |
| Common Rejections | static | Selection/callout in game area (п.1.6.2.7) | 1.6.2.7 | requirement |
| Dangerous Patterns | static | No alert() | — | heuristic |
| Dangerous Patterns | static | No confirm() | — | heuristic |
| Dangerous Patterns | static | No prompt() | — | heuristic |
| Dangerous Patterns | static | No document.write() | — | heuristic |
| Dangerous Patterns | static | No eval() | — | heuristic |
| Archive | static | No Yandex S3 URLs | 1.7 | requirement |
| Quality | static | No WebGL notice (п.1.6.1.7) | 1.6.1.7 | requirement |
| Quality | static | Video has no system controls (п.1.6.1.6/1.6.2.5) | 1.6.1.6 | requirement |
| Quality | static | Music via Web Audio, not <audio>/new Audio (п.1.6.1.6/1.6.2.5) | 1.6.1.6 | requirement |
| Quality | static | SDK language before URL fallback | — | heuristic |
| Quality | static | Language detected before the game is interactive (п.2.14/1.19) | 2.14 | requirement |
| Quality | static | Keyboard auto-shows on input (п.1.6.1.2) | 1.6.1.2 | requirement |
| Quality | static | No URL-based gating (п.1.18) | 1.18 | requirement |
| Quality | static | Fullscreen on mobile (п.1.6.1.1) | 1.6.1.1 | requirement |
| Quality | static | Desktop field aspect ≤ 2:1 (п.1.6.2.2) | 1.6.2.2 | requirement |
| Quality | static | Нет debug-инструментов в UI (п.1.15) | 1.15 | requirement |
| Quality | static | Ввод закрыт до ready() (REQ-1.19) | 1.19 | requirement |
| Quality | static | Keyboard control independent of layout (п.1.6.2.4) | 1.6.2.4 | requirement |
| Quality | static | No OS-shortcut key handlers (п.1.6.2.6) | 1.6.2.6 | requirement |
| Quality | static | No flat-black letterbox void (десктоп, 1.6.2.1) | — | heuristic |
| Quality | static | Game looks finished, not WIP (п.1.15) | 1.15 | requirement |
| Quality | static | No imitation ad blocks (п.1.16) | 1.16 | requirement |
| Quality | static | No YouTube/external video player (п.3.9) | 3.9 | requirement |
| Quality | static | Ad orientation matches game (п.4.3) | 4.3 | requirement |
| Quality | static | Sound toggle present (реком. 6.2) | 6.2 | recommendation |
| Quality | static | Pause available (реком. 6.3) | 6.3 | recommendation |
| Quality | static | Title without the word "игра/game" (реком. 6.5) | — | heuristic |
| Quality | static | No useless exit button (реком. 6.7) | 6.7 | recommendation |
| Quality | static | No profanity in UI text (п.8.2.4) | 8.2.4 | requirement |
| Quality | static | Canvas adapts to resize/orientation (п.1.10) | 1.10 | requirement |
| Quality | static | Progress preserved after orientation change (п.1.9) | 1.9 | requirement |
| Quality | static | ready() not tuned to pass the checker (integrity) | — | heuristic |
| Quality | static | Progress saved before ad (п.4.2) | 4.2 | requirement |
| Quality | static | Monetization present or explicitly waived (п.1.12) | 1.12 | requirement |
| Quality | static | No external ad networks | 4.1 | requirement |
| Leaderboard | static | Leaderboard API (current) | — | heuristic |
| Leaderboard | static | setScore() call | — | heuristic |
| Leaderboard | static | getEntries() call | — | heuristic |
| Leaderboard | static | Leaderboard name [a-zA-Z0-9] | — | heuristic |
| Timing Verification | runtime | GameReady after fonts | 1.19.2 | heuristic |
| Timing Verification | runtime | GameReady after first paint | 1.19.2 | heuristic |
| Timing Verification | runtime | GameReady not too late | 1.19.2 | requirement |
| Timing Verification | runtime | UI not interactive before SDK | 1.19.1 | heuristic |
| Timing Verification | runtime | Language detected before UI | 2.14 | requirement |
| Visual Overflow (п.1.10.1) | runtime | No elements overflow viewport | 1.10.1 | requirement |
| Visual Overflow (п.1.10.1) | runtime | Canvas fills screen | 1.6.2.1 | heuristic |
| Visual Overflow (п.1.10.1) | runtime | Touch targets >= 44px | 1.8 | heuristic |
| Language Check (Runtime) | runtime | SDK language read before Game Ready | 2.14 | requirement |
| Language Check (Runtime) | runtime | No untranslated Cyrillic on non-RU | 8.2.3 | heuristic |
| Language Check (Runtime) | runtime | Canvas text reminder | — | heuristic |
| Scroll/Refresh (Runtime) | runtime | No body scroll | 1.10.2 | requirement |
| Scroll/Refresh (Runtime) | runtime | Document not scrollable | 1.10.2 | requirement |
| Scroll/Refresh (Runtime) | runtime | touch-action blocks iOS refresh | 1.10.2 | requirement |
| Scroll/Refresh (Runtime) | runtime | contextmenu actually blocked | 1.6.2.7 | requirement |
| Ad Context (Runtime) | runtime | Interstitial start delay (REQ-4.4) | 4.4 | requirement |
| Ad Context (v2.4 Runtime) | runtime | All rewarded videos follow user gesture (REQ-4.5) | 4.5 | requirement |
| Runtime Detection | runtime | SDK loaded | 1.1 | requirement |
| Runtime Detection | runtime | SDK initialized | 1.19.1 | requirement |
| Runtime Detection | runtime | No console errors | 6.4 | recommendation |
