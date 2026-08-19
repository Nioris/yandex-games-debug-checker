# v1.2.8-test — Gameplay lifecycle evidence

Исправлен false PASS в строке:

GameReady timing (п.1.19)

Раньше checker мог написать:

Runtime order confirmed: SDK init → ready() → gameplay

даже если `GameplayAPI.start()` вообще не был замечен.

Теперь:

- SDK init + ready + GameplayAPI.start after ready -> PASS
- GameplayAPI.start before ready -> FAIL
- ready есть, start нет -> NOT VERIFIED
- stop есть, start нет -> NOT VERIFIED с явным текстом "stop observed without start"
- ready более чем на 1s позже start -> WARN

То есть наличие `GameplayAPI.stop()` (в том числе платформенного stop из-за рекламы)
больше никогда не считается доказательством того, что `GameplayAPI.start()` был вызван.

Harness также печатает:

[Harness] GAMEPLAY lifecycle=...

Рабочая папка не меняется:
F:\ProjectForgeUniversal\yg-yandex-draft-harness

Отчёты:
reports\<APP_ID>_<YYYY-MM-DD>_<HH-MM-SS>
