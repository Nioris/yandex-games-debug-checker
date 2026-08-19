# Yandex Draft Runtime Harness

Экспериментальный runtime-harness для проверки уже загруженной игры прямо на странице Яндекс Игр — **без встраивания `debugcheck.js` в архив игры**.

Ветка: `experimental/runtime-harness-v1.2`.

> Важно: это экспериментальная ветка. Она нужна для проверки runtime-подхода и подготовки следующей версии checker'а. `main` пока остаётся публичной стабильной версией.

## Что делает Harness

Harness запускает отдельный Chrome через CDP, открывает страницу игры в Яндекс Играх, находит реальный game iframe/OOPIF и внедряет checker до выполнения игровой логики, насколько это позволяет браузерный lifecycle.

Он собирает три вида доказательств:

- **STATIC** — сигнатуры и вызовы найдены в исходниках/DOM;
- **RUNTIME** — вызов реально перехвачен внутри game frame;
- **PLATFORM** — событие подтверждено debug/runtime-логами самой платформы Яндекс Игр.

Это позволяет корректнее проверять Unity/WASM и другие сборки, где обычный поиск текста в исходниках даёт false negative.

## Что уже проверяется в experimental runtime flow

- загрузка `/sdk.js` и `YaGames.init()`;
- фактический `LoadingAPI.ready()`;
- порядок SDK init → ready → GameplayAPI lifecycle;
- `GameplayAPI.start()` / `stop()` без подмены `stop` за доказательство `start`;
- pause/resume игры при interstitial;
- ранний пользовательский input до SDK init / ready;
- подтверждённая реакция игрового UI до ready как hard FAIL;
- `Event Timeline`: `ORDER OK`, `ORDER RISK`, `ORDER FAIL`;
- runtime `contextmenu` на реальной игровой поверхности/canvas;
- Cloud Saves и Payments с разделением static/runtime evidence;
- локализация с отдельным статусом `MANUAL`, если автоматическое доказательство невозможно.

## Статусы

- **PASS** — есть достаточное автоматическое доказательство;
- **FAIL** — подтверждён hard-fail сигнал;
- **WARN** — обнаружен риск/эвристический сигнал;
- **MANUAL** — автоматическая проверка не может надёжно доказать результат, пользователь должен проверить пункт вручную; MANUAL не снижает quality score;
- **N/V** — недостаточно данных, но отдельной ручной инструкции для этого пункта нет;
- **N/A** — функция не используется.

## Текущий протестированный кандидат

Checker: `v1.2.8-test`  
Harness: `1.0.0-summary-integrity`

Важное исправление v1.2.8: checker больше не пишет `SDK init → ready → gameplay`, если `GameplayAPI.start()` не был реально замечен. Если наблюдался только `stop()`, результат lifecycle — `NOT VERIFIED`.

Подробности: [`README-V1.2.8.md`](README-V1.2.8.md) и [`EXPERIMENTAL-STATUS.md`](EXPERIMENTAL-STATUS.md).

## Как пользоваться сейчас

Текущий полностью протестированный рабочий экземпляр запускается из одной постоянной папки:

```powershell
cd F:\ProjectForgeUniversal\yg-yandex-draft-harness
.\RUN-CHECKER.bat
```

Launcher попросит ссылку на игру. Вставьте draft/debug URL, например:

```text
https://yandex.ru/games/app/574662?debug-mode=16&draft=true&lang=ru
```

или обычную ссылку на опубликованную/черновую игру, если доступ к ней уже есть в вашем аккаунте.

Дальше launcher:

1. собирает текущий experimental checker candidate;
2. запускает отдельный Chrome с постоянным debug-профилем;
3. открывает страницу Яндекс Игр;
4. находит game iframe;
5. внедряет checker;
6. собирает runtime/platform evidence;
7. после нажатия Enter сохраняет отчёт.

После первой успешной сборки можно использовать быстрый запуск:

```powershell
cd F:\ProjectForgeUniversal\yg-yandex-draft-harness
.\RUN-CHECKER-QUICK.bat
```

## Что делать во время теста

После сообщения `GAME/CHECKER FRAME FOUND` поиграйте в игру как обычный пользователь:

- нажмите старт/продолжить;
- откройте паузу;
- переключите вкладку и вернитесь;
- вызовите interstitial/rewarded ad, если это возможно;
- проверьте сохранение/загрузку, если функция есть;
- специально попробуйте нажимать на игровые элементы очень рано при старте — Harness проверяет, может ли игра реагировать до SDK init / `LoadingAPI.ready()`.

После этого вернитесь в PowerShell и нажмите Enter.

## Где лежат отчёты

Каждый прогон сохраняется отдельно:

```text
reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>
```

Основные файлы:

- `report.json` — полный structured report;
- `evidence.json` — reconciled STATIC/RUNTIME/PLATFORM evidence;
- `panel.txt` — текст панели checker'а;
- `console.json` — собранная console/platform трассировка;
- `page.png` — скриншот страницы;
- `chrome.log` — лог Chrome/Harness.

Для автоматизации в первую очередь используйте `report.json`:

```json
{
  "summary": {
    "pass": 63,
    "fail": 3,
    "warn": 9,
    "manual": 7,
    "notVerified": 1,
    "score": "84%"
  },
  "page": {
    "timeline": {
      "status": "FAIL",
      "hardFail": true,
      "risk": false
    }
  }
}
```

## Ручная проверка языка

Если checker не может доказать `ysdk.environment.i18n.lang`, пункт становится `MANUAL`, а не серым N/V и не искусственным PASS.

Порядок ручной проверки:

1. открыть игру с `debug-mode=16`;
2. проверить официальный I18N status в debug-панели Яндекс Игр;
3. запустить игру с `&lang=ru`;
4. затем с другим заявленным языком, например `&lang=en`;
5. убедиться, что видимый интерфейс действительно меняет язык до `LoadingAPI.ready()`;
6. отдельно осмотреть Canvas-текст, если он не доступен DOM-анализу.

## Что находится именно в этой ветке

Эта ветка сейчас сохраняет **проверенный experimental snapshot**, а не выдаёт его за готовый `main` release:

- статус и описание runtime-архитектуры;
- regression notes для `v1.2.8-test`;
- validation snapshot;
- последнюю проверенную patch-ступень `v1.2.7 → v1.2.8`.

Полный локальный patch-chain и launch tooling пока остаются в рабочей development-копии и будут затем схлопнуты в чистые repository sources. Это сделано намеренно: сначала сохраняем доказанный runtime-подход, затем рефакторим без потери поведения.

## Ограничения

- Harness не является официальным инструментом Яндекса;
- PASS не гарантирует прохождение модерации;
- некоторые Unity/WASM вызовы могут подтверждаться только platform evidence;
- raw click до ready сам по себе не всегда FAIL: hard FAIL появляется, когда подтверждена реакция игрового UI или gameplay state;
- отсутствие рекламного инвентаря не является ошибкой игры;
- MANUAL пункты действительно требуют проверки человеком.

## PR status

Эта ветка предназначена для review/runtime experimentation. PR из неё в `main` лучше держать как experimental/draft, пока patch-chain не будет схлопнут в чистый `debugcheck.js` и нормальный standalone Harness source.
