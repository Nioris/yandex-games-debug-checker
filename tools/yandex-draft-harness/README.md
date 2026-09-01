# Yandex Games Runtime Harness v1.2.9-test

Runtime Harness проверяет уже загруженную игру прямо на странице Яндекс Игр через Chrome DevTools Protocol и OOPIF. В отличие от обычного встроенного checker, Harness видит фактические runtime-события и сохраняет STATIC / RUNTIME / PLATFORM evidence отдельно.

## Требования

- Windows 10/11;
- Node.js **22+**;
- Chrome или Edge;
- доступ к draft игры, если проверяется черновик.

**Python, pip и `websocket-client` не используются.** CDP WebSocket работает через встроенный WebSocket Node.js 22+. Если появляется `Checking websocket-client...` или попытка `pip install`, запущен не текущий штатный launcher v1.2.9.

## Установка из GitHub ZIP

1. Открой ветку `experimental/runtime-harness-v1.2`.
2. `Code -> Download ZIP`.
3. Распакуй ZIP в новую папку.
4. Открой `tools\yandex-draft-harness`.
5. Двойным кликом запусти `INSTALL-BUNDLE.bat`.
6. После `Bundle installed successfully.` запускай `RUN-CHECKER.bat`.

`INSTALL-BUNDLE.ps1` вручную из своей PowerShell-сессии запускать не нужно. Штатная точка входа установки — `.bat`.

## Обычный запуск

Двойной клик:

```text
RUN-CHECKER.bat
```

Вставь полную ссылку, например:

```text
https://yandex.ru/games/app/568867?debug-mode=16&draft=true&lang=ru
```

Launcher:

1. проверит Node.js 22+;
2. определит App ID, включая обычный `/games/app/568867` и slug URL с числовым ID;
3. использует локальный браузерный профиль `yg-debug-profile` рядом с Harness;
4. соберёт checker candidate до `v1.2.9-test`;
5. откроет игру и подключится к game frame/OOPIF;
6. после теста сохранит отдельную папку отчёта.

## Что сделать после GAME/CHECKER FRAME FOUND

Поиграй и, если функция есть в игре:

- попробуй авторизацию;
- переключись на другую вкладку и обратно или сверни/разверни браузер, чтобы проверить звук при потере фокуса;
- измени размер окна;
- на мобильном устройстве/режиме поверни экран;
- вызови interstitial и rewarded рекламу;
- сделай действие, меняющее игровой прогресс;
- проверь паузу/resume.

После этого вернись в окно Harness и нажми Enter.

## Отчёты

Папка:

```text
reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>
```

Основные файлы:

- `report.json` — полный отчёт;
- `evidence.json` — reconciled STATIC/RUNTIME/PLATFORM evidence;
- `panel.txt` — текст панели checker;
- `console.json` — события console/CDP;
- `page.png` — итоговый screenshot;
- `chrome.log` — лог браузера.

`evidence.json` v1.2.9 использует `schemaVersion: 2`.

## Новые правила августа 2026

### REQ 1.2 / 1.2.1 — авторизация

Harness наблюдает `ysdk.auth.openAuthDialog()` и фиксирует, был ли до него пользовательский ввод. Диалог до любого пользовательского действия считается сильным runtime-риском автоматической авторизации. Если ввод был раньше, это ещё не доказывает причинную связь, поэтому Harness не рисует ложный PASS.

### REQ 1.3 — звук при потере фокуса

Harness фиксирует реальные `blur`, `visibilitychange`, `pagehide` и сопоставляет их с `AudioContext.suspend()`. Если suspend наблюдается в пределах 2 секунд, это сильное runtime evidence. Если игра использует другой механизм mute, результат остаётся `NOT VERIFIED`, а не FAIL.

### REQ 1.9 — прогресс после поворота

Harness фиксирует сам факт orientation change. Но он не может надёжно понять смысл состояния игры — уровень, счёт, доску, инвентарь. Поэтому сохранение прогресса после поворота остаётся `MANUAL/NOT VERIFIED`.

### REQ 1.10 — отображение после resize/orientation

После реального resize/orientation Harness сохраняет события и проверяет финальный overflow/scroll. Чистый runtime probe усиливает уверенность, но screenshot всё равно нужно просмотреть на перекрытия и визуальные деформации.

### REQ 1.12 — монетизация

Реклама или IAP могут быть подтверждены runtime evidence. Если они не наблюдались, это не FAIL: намеренный отказ от монетизации может быть указан в комментарии разработчика в черновике.

### REQ 1.15 — завершённость

Очевидные WIP/placeholder признаки можно подсветить, но общий факт «игра полностью готова» автоматически не доказывается. Итог — MANUAL/NOT VERIFIED.

### REQ 4.4 — задержка показа рекламы

Для interstitial Harness v1.2.9 измеряет фактический `callbacks.onOpen` относительно пользовательского действия, когда callback доступен. Вызов `showFullscreenAdv()` сам по себе больше не считается моментом фактического старта рекламы.

## Статусы evidence

- `PASS_*` — есть положительное доказательство указанного типа;
- `FAIL_CONFIRMED_*` — есть сильное фактическое доказательство нарушения;
- `WARN_*` — обнаружен риск, требующий перепроверки;
- `NOT_VERIFIED*` — данных недостаточно;
- `MANUAL_*` — правило требует осмысленной проверки человеком.

Отсутствие evidence не превращается автоматически в FAIL, а наличие строки в исходнике не подменяет runtime evidence.

## Browser profile

Профиль создаётся рядом с Harness:

```text
yg-debug-profile
```

Если Яндекс просит авторизацию, войди в нужный аккаунт в браузере Harness. Cookies сохранятся в этом профиле.

## Quick run

После того как `RUN-CHECKER.bat` уже собрал `debugcheck-v1.2.9-test.js`, можно использовать:

```text
RUN-CHECKER-QUICK.bat
```

Quick run не пересобирает checker.

## Self-tests

Без браузера/сети:

```text
node build-debugcheck-v1.2-test.mjs --self-test
node upgrade-debugcheck-v1.2-to-v1.2.1.mjs --self-test
node upgrade-debugcheck-v1.2.1-to-v1.2.2.mjs --self-test
node upgrade-debugcheck-v1.2.2-to-v1.2.3.mjs --self-test
node upgrade-debugcheck-v1.2.3-to-v1.2.4.mjs --self-test
node upgrade-debugcheck-v1.2.4-to-v1.2.5.mjs --self-test
node upgrade-debugcheck-v1.2.5-to-v1.2.6.mjs --self-test
node upgrade-debugcheck-v1.2.6-to-v1.2.7.mjs --self-test
node upgrade-debugcheck-v1.2.7-to-v1.2.8.mjs --self-test
node upgrade-debugcheck-v1.2.8-to-v1.2.9.mjs --self-test
node yg-yandex-draft-harness-passive.mjs --self-test
```
