# Skills

Small, original add-ons for gaps that established skills do not cover well. Prefer an
authoritative upstream skill when it already fits the job.

## Included skills

| Skill | What it does | What it needs |
| --- | --- | --- |
| [screen-project-names](skills/product/screen-project-names/SKILL.md) | Checks a naming shortlist for existing uses and possible trademark conflicts; reports dated evidence and unchecked areas instead of claiming a name is legally safe. | Web access for current checks; product category and target markets for scoped trademark research. |
| [contribute-to-upstream](skills/oss/contribute-to-upstream/SKILL.md) | Prepares a maintainer-ready OSS contribution from the target repository's actual rules, local conventions, and evidence. | A selected repository and scoped issue or agreed problem. |

Skills are grouped by domain (`product`, `oss`), then kept one focused capability per leaf folder.
The category is for discovery; the skill's name and description remain the installation and
selection contract.

`screen-project-names` is a preliminary research workflow, not legal clearance. It has been
reviewed for instruction coverage and independently exercised on three synthetic scenarios, with
a fresh retest after a source-link omission. This is not a broad behavioral benchmark. For
generating names, use the upstream naming skill below. The add-on can screen names supplied by a
user without another skill.

## Install and use

Requires Node.js. Install just the add-on for your agent:

```bash
npx skills@latest add gianlucanatali/skills --skill contribute-to-upstream --agent codex
# Or:
npx skills@latest add gianlucanatali/skills --skill screen-project-names --agent claude-code
```

Add `--global` for a user-level installation; omit it for the current project.
Preview with `npx skills@latest add gianlucanatali/skills --list`.
Update Skills CLI installations with `npx skills@latest update`.

Examples:

- “Use screen-project-names to check these three names for a developer tool marketed in the EU and US. Separate existing-use evidence from unverified trademark status.”
- “Use contribute-to-upstream for issue #123 in this repository. Read its contribution rules and local test conventions, make the smallest justified change, and give me the contribution brief. Do not open a pull request.”

If asked to generate names too, `screen-project-names` first loads the installed
`domain-name-brainstormer` skill. It stops with setup guidance if that prerequisite is
missing. Dependencies are not installed automatically.

`contribute-to-upstream` intentionally stops short of selecting issues, coordinating
workers, or publishing under a personal identity. Those are separate concerns and should
remain in project or private configuration.

## Use upstream for these tasks

These are recommendations, not copies bundled with this repo. Read their instructions
and prerequisites before installing; provider-specific tools and permissions still apply.

| Task | Upstream skill or tool | Why use it |
| --- | --- | --- |
| Diagnose difficult bugs | [Matt Pocock: diagnosing-bugs](https://github.com/mattpocock/skills/tree/main/skills/engineering/diagnosing-bugs) | Builds a reproducible feedback loop, tests hypotheses, and verifies the original failure. |
| Review code against requirements and standards | [Matt Pocock: code-review](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review) | Separates specification compliance from code standards; requires its documented tracker setup. |
| Write agent instructions | [Matt Pocock: writing-for-agents](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents) | Covers triggering, progressive disclosure, completion criteria, and pruning. |
| Find stale documentation | [GitHub: docs-sync-audit](https://github.com/github/awesome-copilot/tree/main/skills/docs-sync-audit) | Includes a checker for broken links and documented commands; prose still needs review. |
| Inspect failing GitHub Actions checks | [OpenAI: gh-fix-ci](https://github.com/openai/skills/tree/main/skills/.curated/gh-fix-ci) | Includes check/log retrieval and an approval boundary before fixes. |
| Create Playwright tests | [Microsoft: Playwright test agents](https://playwright.dev/docs/test-agents) | Maintainer-provided planning and browser-observed generation. Agent definitions, not a normal skill package. |
| Run existing Playwright tests | [Playwright CLI](https://playwright.dev/docs/test-cli) | Use the project's configured runner and reports; no extra skill needed. |
| Release Expo apps | [Expo: eas-app-stores](https://github.com/expo/skills/tree/main/plugins/expo/skills/eas-app-stores) | Maintainer instructions for builds, signing, versions, and submission. |
| Set up Git worktrees | [Superpowers: using-git-worktrees](https://github.com/obra/superpowers/tree/main/skills/using-git-worktrees) | Handles existing isolation, harness-native worktrees, setup and baseline checks. Put application-specific ports and databases in project scripts. |
| Audit browser accessibility | [Chrome DevTools: a11y-debugging](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/a11y-debugging) | Browser accessibility tree, Lighthouse, keyboard, focus and contrast checks. Requires Chrome DevTools MCP; not a conformance guarantee. |
| Draft release notes | [Composio: changelog-generator](https://github.com/ComposioHQ/awesome-claude-skills/tree/master/changelog-generator) | Covers version ranges, user-facing categories and existing style guidance. |
| Brainstorm names | [Composio: domain-name-brainstormer](https://github.com/ComposioHQ/awesome-claude-skills/tree/master/domain-name-brainstormer) | Generates naming ideas; independently verify any availability claims. |
| Learn OSS contribution basics | [OSS-Skills: oss-contribute](https://github.com/chiruu12/OSS-Skills/tree/main/oss-contribute) | An MIT-licensed, educational workflow for people learning to contribute. |

Examples using the [Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills@latest add mattpocock/skills --skill diagnosing-bugs --agent codex
npx skills@latest add mattpocock/skills --skill writing-for-agents --agent codex
npx skills@latest add gianlucanatali/skills --skill contribute-to-upstream --agent codex
npx skills@latest add github/awesome-copilot --skill docs-sync-audit --agent codex
npx skills@latest add ChromeDevTools/chrome-devtools-mcp --skill a11y-debugging --agent codex
npx skills@latest add ComposioHQ/awesome-claude-skills --skill domain-name-brainstormer --agent codex
```

Replace `codex` with `claude-code` for that agent. Preview any source with
`npx skills@latest add OWNER/REPO --list` and select only what you need.
For Playwright agents, use the linked official setup rather than Skills CLI.

## Migrating from the initial catalog

The initial 22-skill catalog was too broad. Its general-purpose workflows are no longer
bundled; use the upstream recommendations above. The old `contextual-naming` entry is
replaced by the narrower `screen-project-names` add-on. The OSS workflow was reconsidered:
the reusable upstream-facing core is now `contribute-to-upstream`; personal worker,
approval, and publishing adapters are deliberately not public.
Updating does not necessarily remove previously installed skills or rename them.
Review and remove obsolete installations explicitly; this repo does not change them for you.

## License and attribution

No license has been selected for the original material in this repository.
Upstream projects retain their own licenses; their implementations are not copied here.
The installation-and-catalog presentation is inspired by
[Matt Pocock's collection](https://github.com/mattpocock/skills), with original prose.
