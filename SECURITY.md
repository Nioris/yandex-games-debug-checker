# Security

The checker is intended for development and pre-submission builds only. Remove it from production builds.

The public distribution does not contain telemetry and does not intentionally send game source to external services. Static analysis fetches only same-origin documents and relative JS/CSS resources referenced by the current page.

If you discover code execution, data mutation, cross-origin leakage, or another security issue caused by the checker, report it privately to the repository maintainer rather than publishing exploit details in a public issue.
