# Orc Castle — before / after example

Этот пример показывает checker на реальной небольшой Canvas-игре, а не на искусственной тестовой странице.

Игра в обоих вариантах сохраняет ту же основную механику. `before` — исходная версия с подключённым checker'ом, но без исправления найденных проблем интеграции. `after` — та же игра после доработки под Яндекс Игры.

## Результат browser audit

Аудит запускает оба варианта в настоящем headless Chromium и использует локальный mock Yandex Games SDK только как тестовый runtime.

| Вариант | PASS | FAIL | WARN | N/V | SCORE |
|---|---:|---:|---:|---:|---:|
| `before` | 45 | 3 | 12 | 10 | 75% |
| `after` | 70 | 0 | 0 | 2 | 100% |

Машинные snapshots: [`reports/before.json`](reports/before.json) и [`reports/after.json`](reports/after.json).

### Три hard FAIL в `before`

1. Нет `YaGames.init()`.
2. Нет `LoadingAPI.ready()`.
3. `contextmenu` не блокируется на всей странице.

### Что исправлено в `after`

- `/sdk.js` загружается до checker'а и игрового кода;
- SDK инициализируется через `await YaGames.init()`;
- `ysdk.environment.i18n.lang` читается во время запуска;
- demo передаёт `resolveGameLanguage` через необязательный `window.YGDebugCheckerConfig`, поэтому fallback `be/kk/uk/uz → ru` checker проверяет исполнением функции, а не regex-догадкой;
- пользовательский ввод закрыт флагом `inputEnabled` до готовности;
- `LoadingAPI.ready()` вызывается после загрузки шрифтов и двух кадров рендера, когда стартовая кнопка уже может быть безопасно разблокирована;
- добавлена optional-разметка `GameplayAPI.start()/stop()` для старта, паузы, магазина, скрытия вкладки и game over;
- `contextmenu` и `selectstart` блокируются;
- добавлены `overscroll-behavior:none` и `-webkit-touch-callout:none`;
- canvas пересчитывается на `orientationchange` и `fullscreenchange`;
- AudioContext ставится на паузу при скрытии вкладки;
- кнопки имеют минимальный touch target 44px;
- добавлен переключатель звука.

## Почему в `after` остаются 2 NOT VERIFIED

Это намеренно и теперь **не считается WARN**.

`GameReady after first paint` не получает timestamp `window.load` в CDP harness, потому что checker инжектируется в уже открытый `about:blank`. Поэтому результат честно помечен `NOT VERIFIED`, а не риском. На реальном Yandex Stage timing будет наблюдаться штатно.

`Canvas text reminder` остаётся `NOT VERIFIED`, потому что текст, нарисованный через Canvas API, отсутствует в DOM. Checker не может доказать его локализацию без OCR/игрового контракта, поэтому не должен выдавать WARN только из-за Canvas.

## Файлы

- `before/index.html` — production-like before fixture с `/sdk.js` и checker'ом.
- `after/index.html` — production-like after fixture. **В нём нет mock SDK.**
- `after/index.mock.html` — только для GitHub Pages и browser tests; добавляет `../mock-sdk.js`.
- `mock-sdk.js` — маленькая локальная имитация API для demo/test среды. Не загружайте её в production-сборку игры.

## Запуск теста

Из корня репозитория:

```bash
npm run test:example:browser
```

Полный аудит проекта:

```bash
npm run audit
```

## Важное ограничение

`0 FAIL` означает только отсутствие hard failures, которые смог обнаружить checker. Это не является гарантией прохождения модерации. Перед публикацией проверяйте `after/index.html` в настоящем черновике Яндекс Игр и проходите [`../../docs/manual-checklist.md`](../../docs/manual-checklist.md).
