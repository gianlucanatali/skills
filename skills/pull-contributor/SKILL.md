---
name: pull-contributor
description: Use to pull new contributor commits onto the current branch for review, tracking a per-branch reviewed tag. Run by the reviewer; use allineami-a for contributor alignment and push-to-dev to return reviewed changes.
---

# Pull external developer changes for review

Fetch the latest commits from a remote branch and apply them as unstaged
modifications on the current branch for review. A per-branch tag tracks the
last reviewed commit so each invocation picks up only new work.

**Branch to pull:** $ARGUMENTS

If no branch name was provided, ask the user which remote branch to use before
proceeding.

## Steps

1. Set `BRANCH=$ARGUMENTS` and `TAG=reviewed/$ARGUMENTS`.

2. Run `git fetch origin $BRANCH` to get latest remote state.

3. Capture the commit log of new commits before moving the tag:
   `git log $TAG..origin/$BRANCH --oneline` (if tag exists) or
   `git log HEAD...origin/$BRANCH --oneline` (if tag does not exist).
   If the output is empty, tell the user there are no new commits and stop.

4. Apply the changes as unstaged modifications:
   - If tag `$TAG` **exists**:
     `git diff $TAG origin/$BRANCH | git apply --3way`
   - If tag `$TAG` **does not exist**:
     `git diff HEAD...origin/$BRANCH | git apply --3way`

5. Update the tag: `git tag -f $TAG origin/$BRANCH`

6. Run `npm install` to pick up any new dependencies.

7. Run `git status --short` and report a clear summary:
   - Commit messages from step 3 (what the developer worked on)
   - Files added (A), modified (M), deleted (D)

8. Tell the user the changes are ready to review and you are ready to help
   rewrite and fix them.
