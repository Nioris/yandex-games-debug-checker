# Community guide

Yandex Games Debug Checker uses GitHub Discussions for open-ended conversation and GitHub Issues for concrete reproducible defects.

## Recommended Discussions categories

- **Q&A / Help** — questions about checker results and how to interpret them.
- **Ideas** — proposals for new checks, UI improvements, reports, and developer workflow ideas.
- **Rule discussion / False positives** — uncertain or disputed rule interpretation and possible false positives that are not yet confirmed as reproducible defects.
- **Show your results** — before/after reports, integration stories, and examples from games using the checker.
- **Announcements** — release notes and important checker-policy changes. New topics in this category should be maintainer-only when possible.

## Routing

Use **Discussions** when you want to ask a question, propose an idea, discuss a rule, or determine whether a result is actually wrong.

Use the **Bug report** Issue form when the checker itself has a reproducible defect.

Use the **False positive / incorrect check** Issue form when a specific check has a reproducible incorrect result and you can provide evidence or a minimal reproduction.

Use a **Pull Request** for a concrete fix with tests.

## Suggested welcome discussion

**Title:** Welcome to Yandex Games Debug Checker Discussions

Welcome. This is the place to ask questions about checker results, propose new checks, discuss rule interpretation, report possible false positives before filing a defect, and share before/after integration results.

Please keep a few things in mind:

- This project is independent and is not an official Yandex product.
- A checker PASS does not guarantee moderation approval.
- For requirement interpretation, the current official Yandex Games documentation remains the source of truth.
- If you have a reproducible checker bug, use the Bug report Issue form.
- If a specific check produces a reproducible incorrect result, use the False positive / incorrect check Issue form.
- Do not post private production credentials, API keys, player data, or unpublished secrets.

When discussing a specific rule, include the checker version and check ID/title whenever possible.

## Moderation principle

Do not convert ambiguous framework-, naming-, regex-, minification-, or architecture-dependent evidence into a hard FAIL without strong reproducible evidence. The public checker should prefer conservative signals because developers may treat its output as a pre-moderation indicator.
