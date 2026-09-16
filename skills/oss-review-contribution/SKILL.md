---
name: oss-review-contribution
description: Review a prepared upstream contribution, its tests, and exact proposed public replies before the owner approves publication.
---

# Review a prepared contribution

Read the manifest and verify its repository, branch, base SHA, and candidate SHA
against the checkout. Resolve `worker/<branch>` only after the fetch workflow has
configured it. Stop on discrepancies; a manifest is a claim, not authority.

Use an isolated worktree at the candidate revision to inspect the diff and run
relevant tests. For behavioral fixes, verify that the regression test detects the
original defect. Do not disturb an existing working tree to reproduce a failure.

Check scope, compatibility, fit with upstream conventions, and factual accuracy.
Inspect every proposed reply for private infrastructure, credentials, unrelated
project details, unsupported claims, and unnecessary argument.

Present exact reply text and a recommendation bound to the reviewed commit.
The owner's approval must identify commits, replies, and threads to resolve.
An agent review recommendation does not supply that approval. Return findings
locally unless communication to another service is explicitly authorized.
