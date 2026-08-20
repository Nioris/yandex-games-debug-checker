# Yandex Draft Runtime Harness

Экспериментальный runtime-harness для проверки уже загруженной игры прямо на странице Яндекс Игр — без добавления `debugcheck.js` в архив самой игры.

Ветка: `experimental/runtime-harness-v1.2`  
Проверенный checker candidate: `v1.2.8-test`  
Harness: passive CDP/OOPIF runtime harness.

> Это экспериментальная ветка. `main` остаётся стабильной публичной версией checker'а. Harness не является официальным инструментом Яндекса, а PASS не гарантирует прохождение модерации.

## Что делает Harness

Harness запускает отдельный Chrome/Edge через CDP, открывает страницу игры в Яндекс Играх, находит реальный game iframe/OOPIF и внедряет checker без изменения загруженной сборки игры.

Он сводит три типа доказательств:

- **STATIC** — сигнатура или вызов найден в исходниках/DOM;
- **RUNTIME** — вызов реально замечен внутри game frame;
- **PLATFORM** — событие подтверждено runtime/debug-логами платформы Яндекс Игр.

Это особенно полезно для Unity/WASM и других сборок, где обычный поиск текста в JavaScript часто даёт false negative.

## Что нужно установить

На Windows нужны:

- Node.js 18+;
- Google Chrome или Microsoft Edge;
- PowerShell;
- доступ к нужной игре в Яндекс Играх;
- для draft-ссылок — аккаунт Яндекса, у которого есть доступ к черновику.

Проверить Node.js:

```powershell
node --version
```

## 1. Один раз установить bundle из этой ветки

GitHub-коннектор хранит точный development bundle в `bundle/` как проверяемые base64-части. Это тот же ZIP, который был протестирован локально.

Из корня репозитория:

```powershell
cd .\tools\yandex-draft-harness
.\INSTALL-BUNDLE.bat
```

или напрямую:

```powershell
powershell -ExecutionPolicy Bypass -File .\INSTALL-BUNDLE.ps1
```

Installer:

1. соединяет все части bundle;
2. восстанавливает исходный ZIP;
3. проверяет SHA-256;
4. только после успешной проверки распаковывает launchers, builder и весь patch-chain в текущую папку.

Ожидаемый SHA-256 bundle:

```text
87f64a93262589f39eb0c92253e8f756d38f848dcef392fd8de436ac2d7a340a
```

Если checksum не совпадёт, installer остановится и ничего не будет запускать.

## 2. Обычный запуск

После установки bundle запусти:

```powershell
.\RUN-CHECKER.bat
```

Launcher попросит полную ссылку на игру. Например:

```text
https://yandex.ru/games/app/568143?debug-mode=16&draft=true&lang=ru
```

Дальше он автоматически:

1. определяет App ID для URL вида `/games/app/<ID>`;
2. закрывает старый Harness Chrome с тем же выделенным профилем;
3. собирает `debugcheck-v1.2.0-test` из audited public base;
4. последовательно применяет patch-chain `v1.2.0 → v1.2.8`;
5. запускает passive Harness;
6. открывает страницу Яндекс Игр;
7. находит реальный game frame/OOPIF;
8. внедряет `debugcheck-v1.2.8-test`;
9. собирает runtime/platform evidence;
10. сохраняет отдельный отчёт для этого прогона.

Стабильный `debugcheck.js` в корне репозитория этим не заменяется.

## 3. Что делать, когда открылась игра

Дождись сообщения в консоли:

```text
[Harness] GAME/CHECKER FRAME FOUND
```

После этого используй игру как реальный пользователь. Для полезного runtime-прогона желательно:

- нажать старт/продолжить;
- сделать несколько игровых действий;
- открыть паузу;
- переключить вкладку и вернуться;
- вызвать interstitial/rewarded ad, если она доступна;
- проверить сохранение/загрузку, если игра это поддерживает;
- попробовать ранний input сразу после старта страницы;
- для локализации повторить прогон с `&lang=ru`, `&lang=en` и другими заявленными языками.

Когда сценарий закончен, вернись в окно PowerShell и нажми Enter. Harness соберёт финальный report и скриншот.

## 4. Быстрый повторный запуск

После первого успешного обычного запуска уже существует:

```text
debugcheck-v1.2.8-test.js
```

Тогда можно не пересобирать весь patch-chain:

```powershell
.\RUN-CHECKER-QUICK.bat
```

Quick launcher использует уже собранный `debugcheck-v1.2.8-test.js`, снова спрашивает URL и создаёт новый отчёт.

Если checker ещё не собран, quick launcher попросит сначала запустить `RUN-CHECKER.bat`.

## Где лежат отчёты

Каждый прогон сохраняется отдельно:

```text
reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>
```

Например:

```text
reports\568143_2026-08-20_09-15-42
```

Если App ID не удалось извлечь из URL, вместо него будет `unknown`.

## Что смотреть в отчёте

Начинать удобнее в таком порядке:

### `panel.txt`

Текстовое состояние панели checker'а. Быстрый способ увидеть PASS / FAIL / WARN / MANUAL / NOT VERIFIED.

### `report.json`

Главный structured report. Его стоит использовать для автоматизации и сравнения прогонов.

Особенно важны:

- `summary` — итоговые счётчики и score;
- `checks` — результаты отдельных проверок;
- `timing` — runtime timing;
- `page.timeline` — порядок SDK/ready/gameplay событий;
- runtime/session/frame данные Harness.

### `evidence.json`

Сведённые STATIC / RUNTIME / PLATFORM доказательства. Полезен, когда нужно понять, почему конкретная проверка получила статус.

### `console.json`

Console + platform trace. Здесь ищут реальные SDK/advertising/platform события и ошибки страницы.

### `page.png`

Скриншот страницы в момент завершения прогона.

### `chrome.log`

Технический лог Chrome/Harness. Нужен в первую очередь для диагностики проблем CDP, frame attachment и запуска браузера.

## Как читать статусы

- **PASS** — автоматических доказательств достаточно;
- **FAIL** — подтверждён hard-fail сигнал;
- **WARN** — найден риск или эвристический сигнал;
- **MANUAL** — этот пункт нельзя надёжно доказать автоматически, нужна ручная проверка; MANUAL не должен искусственно превращаться в PASS;
- **NOT VERIFIED / N/V** — данных недостаточно для автоматического вывода;
- **N/A** — функция в этом прогоне не используется или не обнаружена.

## Event Timeline

Для startup/lifecycle особенно смотри timeline:

- `ORDER OK` — наблюдаемый порядок событий корректен;
- `ORDER RISK` — есть риск, но недостаточно доказательств для hard fail;
- `ORDER FAIL` — подтверждён неправильный порядок/ранняя реакция игры.

В `v1.2.8-test` `GameplayAPI.stop()` больше не считается доказательством того, что `GameplayAPI.start()` когда-либо происходил. Если `start()` не замечен, lifecycle остаётся `NOT VERIFIED`.

## Ручная проверка языка

Если checker не смог доказать чтение `ysdk.environment.i18n.lang`, пункт может стать `MANUAL`/`NOT VERIFIED` вместо искусственного PASS.

Для проверки:

1. запусти игру с `debug-mode=16`;
2. проверь I18N status в debug-панели Яндекс Игр;
3. запусти с `&lang=ru`;
4. повтори с `&lang=en` или другим заявленным языком;
5. убедись, что видимый интерфейс реально меняет язык;
6. отдельно проверь Canvas-текст, который DOM-анализ может не увидеть.

## Если draft не открывается

Harness использует отдельный постоянный браузерный профиль:

```text
F:\ProjectForgeUniversal\yg-debug-profile
```

Если Яндекс просит авторизацию, войди в нужный аккаунт в окне браузера, запущенном Harness, закрой прогон и запусти его снова. Cookies сохраняются в этом профиле.

Не запускай два Harness одновременно с одним и тем же profile directory.

## Известное ограничение URL

Текущий launcher автоматически извлекает App ID только из URL вида:

```text
/games/app/568143
```

Для slug URL, где ID находится только в конце имени, проверка может работать, но папка отчёта получит `unknown`. Исправление slug App ID extraction остаётся отдельной задачей.

## Проверка source tooling без браузера

Builder, каждый upgrader и сам Harness имеют self-test. Например:

```powershell
node .\build-debugcheck-v1.2-test.mjs --self-test
node .\upgrade-debugcheck-v1.2.7-to-v1.2.8.mjs --self-test
node .\yg-yandex-draft-harness-passive.mjs --self-test
```

Перед публикацией этого snapshot локально были успешно пройдены self-test builder'а, всех восьми upgrade-ступеней и Harness.

## Дополнительные файлы

- [`EXPERIMENTAL-STATUS.md`](EXPERIMENTAL-STATUS.md) — что уже доказано live-прогонами и что ещё экспериментально;
- [`README-V1.2.8.md`](README-V1.2.8.md) — regression notes для последнего candidate;
- `README-BUNDLE.md` — исходный README из development bundle; появляется после `INSTALL-BUNDLE`;
- `*-VALIDATION.*` — сохранённые validation snapshots отдельных стадий разработки.

## Безопасность и ограничения

- Harness не является официальным инструментом Яндекса;
- PASS не гарантирует прохождение модерации;
- некоторые Unity/WASM события могут подтверждаться только platform evidence;
- отсутствие рекламного инвентаря само по себе не является ошибкой игры;
- MANUAL пункты действительно требуют проверки человеком;
- runtime instrumentation предназначена для тестирования, не для production-сборки игры.
