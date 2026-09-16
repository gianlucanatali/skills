---
name: work-on-oss-projects
description: Gather upstream contributions prepared by a configured agent fleet, present them for selection, and route selected items through review and approved publication.
---

# Work on upstream contributions

Use the project's explicit worker-host and outbox configuration. Preparation and
publication have separate owners; do not distribute publishing credentials to
workers as a convenience.

1. Use `oss-fetch-from-fleet` to obtain manifests and their exact commits.
2. Present each upstream PR, behavioral change, test evidence, and proposed
   replies. Report discrepancies and transport failures separately from no work.
3. Let the owner select items, or follow an existing explicit selection.
4. Use `oss-review-contribution` for each selected item.
5. Use `oss-publish-contribution` only for explicitly approved artifacts.

Do not infer approval from a worker's completion status. Keep project data scoped
to its configured repository. This entry point alone does not authorize public
messages, pushing, or changes to worker infrastructure.
