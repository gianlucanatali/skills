---
name: oss-publish-contribution
description: Publish exact commits and public replies approved by the owner for an upstream contribution, with remote verification and retry protection.
---

# Publish an approved contribution

Require explicit owner approval covering the candidate SHA, target repository and
branch, exact reply text, and any review threads to resolve. Existing approval in
the session suffices when those artifacts have not changed.

1. Verify the authenticated publishing identity, expected fork URL, PR head, and
   current remote SHA against the approved manifest.
2. Verify the candidate is a fast-forward of the current remote branch. Stop on
   any mismatch; never force-push as a repair.
3. Push only the approved branch and read back the resulting SHA.
4. Post only approved replies. Use a structured body or a properly quoted
   `--body-file`; never interpolate reply text into shell code.
5. Use a stable marker such as `<!-- contribution:<pr>:<thread>:<revision> -->`
   and inspect existing comments before retrying to avoid duplicate replies.
6. Resolve only explicitly approved threads whose findings the published changes
   address. Paginate API results and verify every resolution.
7. Save a local receipt with commit, reply IDs, thread IDs, and timestamp. Deliver
   it to a configured worker outbox only if that write is authorized.

Report actual public URLs and partial failures. Do not merge, close, delete
branches, open additional PRs, or broaden publication beyond the approval.
