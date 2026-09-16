---
name: e2e-test
description: Add data-isolation and regression-evidence checks to Microsoft's Playwright test agents when creating or repairing end-to-end tests.
---

# Playwright test extension

## Required upstream

Use Microsoft's [Playwright test agents](https://playwright.dev/docs/test-agents) for browser exploration, planning, and test generation. These are agent definitions, not an automatically installed skill dependency.

Read the installed planner/generator definitions and relevant seed test before proceeding. If unavailable, stop and provide the official setup instructions. In a project with a compatible Playwright version, the documented setup is `npx playwright init-agents --loop=codex` or `--loop=claude`. Setup changes project files: do not run it implicitly. If the harness cannot invoke these agents, report that limitation rather than claiming delegation occurred.

## Additional checks

- Reuse the project's actual authentication, seed, and data helpers. Isolate mutable fixtures across concurrent tests and scope cleanup to records the test owns; never assume a particular database or hard-code a privileged client.
- Fail clearly when required seed data is missing. A missing user must not silently skip setup.
- Where persistence is part of the requirement, assert the saved state through the project's supported API/database helper as well as the visible result.
- After a database reset, regenerate affected authentication state instead of trusting stale sessions. Inspect the real setup dependency graph; filtering a spec does not necessarily filter setup.
- Choose fast-gate versus extended-regression placement by actual cost, determinism, and importance of the invariant.
- Do not suppress failures with skips, test.fixme, weakened assertions, or swallowed errors to obtain green output. If using the upstream healer, this restriction still applies. Report product defects separately from test defects.
- Remove temporary probes, run the focused test and relevant regression suite, and report the exact commands and passed/failed/skipped counts. Explain any unrun coverage.

Keep upstream procedures upstream; this file owns only these additional checks.
