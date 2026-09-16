---
name: mobile-release
description: Add local preflight and release-evidence checks to Expo's eas-app-stores skill when shipping a mobile build.
---

# Mobile release extension

## Required upstream

Use the official [Expo eas-app-stores skill](https://github.com/expo/skills/tree/main/plugins/expo/skills/eas-app-stores) for build, signing, versioning, and submission procedures.
Load its installed SKILL.md and applicable references before proceeding; follow its Expo prerequisite routing too.

If unavailable, stop and give the user the installation command:
`npx skills@latest add expo/skills`
Select eas-app-stores and any prerequisites it documents. Installation is separate from invoking this extension; do not silently install or pretend the upstream skill ran.

## Additional checks

- Before a paid/cloud build, run the project's lockfile-respecting dependency check, Expo diagnostics, and supported local production bundle checks for each target platform. A local pass does not prove cloud success.
- Inspect whether native directories are tracked, generated, or customized. Do not delete them automatically to refresh configuration. Explain any regeneration and preserve native changes.
- Verify icon/splash assets and the intended backend environment before packaging.
- Record the source revision and inspect build inclusion/exclusion rules: a clean Git tree alone does not prove what EAS will upload.
- Change a minimum-supported-client gate only for an explicit compatibility requirement, not every release.
- Confirm the authorized platform, distribution track, and scope before build/submission. An existing explicit request suffices; do not expand a testing release into production.
- Record build and submission IDs. Check existing queued jobs before retrying; distinguish uploaded, processed, available to testers, and publicly released states.

Report source revision, platform/version, artifact IDs, checks, and observed distribution state. Do not call a queued submission a shipped release.
