# Skills

Reusable agent skills for development, testing, releases, and naming.
Pick the workflows you need, read their instructions, and adapt them to your project.

Each skill uses the open [Agent Skills format](https://agentskills.io): a
`skills/<name>/SKILL.md` entry point with optional scripts and templates.
The collection works with compatible agents, including Claude Code and Codex.
Some instructions are in Italian.

## Install

With Node.js installed, choose skills and agents interactively:

```bash
npx skills@latest add gianlucanatali/skills
```

Preview the catalog without installing:

```bash
npx skills@latest add gianlucanatali/skills --list
```

Install a single skill in the current project:

```bash
npx skills@latest add gianlucanatali/skills --skill contextual-naming --agent codex
```

Or install for Claude Code across projects:

```bash
npx skills@latest add gianlucanatali/skills --skill contextual-naming --agent claude-code --global
```

Update Skills CLI installations:

```bash
npx skills@latest update
```

These commands use the [Skills CLI](https://github.com/vercel-labs/skills).
For clients without an installer, copy the selected skill directory, including
its supporting files, into the client's documented skills directory.

### GitHub CLI alternative

If your GitHub CLI supports `gh skill`:

```bash
gh skill install gianlucanatali/skills contextual-naming --agent codex
gh skill update --all
```

Use `gh skill install --help` for available agents and scopes.
Choose one installer to avoid duplicate installations.

## Use

Ask for the task normally, or name the skill explicitly using your client's
invocation syntax, such as `$contextual-naming` in Codex or
`/contextual-naming` in Claude Code.

Examples:

- “Use contextual-naming to suggest five names for my session archive tool.”
- “Use debug-ci-failure to diagnose this failing CI run.”
- “Use usability-audit to review this application.”

Read a skill before using it. Skills are instructions, not preconfigured services:
some need GitHub access, local databases, browsers, or other tools. Release and
Git workflows can modify repositories and must follow the approvals described
in their instructions. The upstream-contribution workflows require an explicitly
configured worker host and outbox; no infrastructure is supplied by this repo.

## Catalog

### Development and collaboration

| Skill | Purpose |
| --- | --- |
| [contextual-naming](skills/contextual-naming/SKILL.md) | Invent names and screen for existing uses. |
| [context-doctor](skills/context-doctor/SKILL.md) | Review agent instructions for clarity and consistency. |
| [debug-ci-failure](skills/debug-ci-failure/SKILL.md) | Diagnose infrastructure and application CI failures. |
| [start-isolated-worktree](skills/start-isolated-worktree/SKILL.md) | Prepare an isolated development worktree and stack. |
| [prune-dev-branches-and-worktrees](skills/prune-dev-branches-and-worktrees/SKILL.md) | Inventory and clean up merged development work. |
| [allineami-a](skills/allineami-a/SKILL.md) | Align a contributor branch with reviewed changes. |
| [pull-contributor](skills/pull-contributor/SKILL.md) | Bring contributor changes into a review workflow. |
| [push-to-dev](skills/push-to-dev/SKILL.md) | Return reviewed changes to a contributor branch. |
| [push-workdir](skills/push-workdir/SKILL.md) | Sync a scratch workspace to a configured notes repository. |

### Testing and releases

| Skill | Purpose |
| --- | --- |
| [e2e-test](skills/e2e-test/SKILL.md) | Write Playwright tests from observed behavior. |
| [run-e2e](skills/run-e2e/SKILL.md) | Run and triage end-to-end tests. |
| [usability-audit](skills/usability-audit/SKILL.md) | Check accessibility and interactive UI behavior. |
| [compat-gate](skills/compat-gate/SKILL.md) | Compare compatibility in isolated environments. |
| [consolidate-migrations](skills/consolidate-migrations/SKILL.md) | Consolidate development database migrations. |
| [mobile-release](skills/mobile-release/SKILL.md) | Follow an Expo/EAS release workflow. |
| [ios-simulator-local-build](skills/ios-simulator-local-build/SKILL.md) | Build and exercise an app in the iOS simulator. |
| [promote-to-prod](skills/promote-to-prod/SKILL.md) | Promote releases across configured repository boundaries. |
| [update-release-notes](skills/update-release-notes/SKILL.md) | Write user-facing release notes from changes. |

### Upstream contributions

| Skill | Purpose |
| --- | --- |
| [work-on-oss-projects](skills/work-on-oss-projects/SKILL.md) | Coordinate review of prepared upstream contributions. |
| [oss-fetch-from-fleet](skills/oss-fetch-from-fleet/SKILL.md) | Fetch contribution branches and manifests. |
| [oss-review-contribution](skills/oss-review-contribution/SKILL.md) | Review code and proposed public replies. |
| [oss-publish-contribution](skills/oss-publish-contribution/SKILL.md) | Publish explicitly approved contributions. |

### Upstream prerequisites

Two entries are thin extensions, not standalone implementations:

- `mobile-release` builds on [Expo's eas-app-stores](https://github.com/expo/skills/tree/main/plugins/expo/skills/eas-app-stores). Install the official collection with `npx skills@latest add expo/skills` and select the release skill and its documented prerequisites.
- `e2e-test` builds on [Microsoft's Playwright test agents](https://playwright.dev/docs/test-agents). Follow their project setup instructions for your harness; these are agent definitions, not a Skills CLI dependency.

Install prerequisites separately. Each extension instructs the agent to load the
upstream instructions first and stop with setup guidance when they are unavailable.
Dependency installation and agent invocation are not automatic or universal.
No upstream implementation is copied into this repository.

## Contributing

Keep skills focused, document required configuration, and use synthetic fixtures.
Validate behavioral changes with relevant tests.

## License

No license has been selected yet. Public visibility does not grant a general
open-source license; check with the owner before redistribution or reuse beyond
applicable permissions.

The installation-and-catalog presentation is inspired by
[Matt Pocock's skills collection](https://github.com/mattpocock/skills).
