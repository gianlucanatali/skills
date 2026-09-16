---
name: push-to-dev
description: Use after reviewing and refactoring an external developer's commits (via pull-contributor) to push the improved code back to their remote branch as a new commit on top, preserving their original history so they can git pull and keep building on the refactored foundation.
---

# Push reviewed changes back to an external developer's branch

After reviewing and refactoring commits from an external developer (via pull-contributor),
push the improved code back to their branch as a new commit so they can `git pull`
and continue building on the refactored foundation.

This is the reverse of pull-contributor: instead of applying their diff onto us,
we apply our diff onto them. Their commit history is preserved; the refactoring
lands as a new commit on top.

**Branch to push to:** $ARGUMENTS

---

## Step 0 — Capture the current branch

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

You'll need this in Step 3 (to know which branch must stay untouched) and Step 5
(for the commit message).

---

## Step 1 — Verify no new commits from the developer

Set `BRANCH=$ARGUMENTS` and `TAG=reviewed/$BRANCH`.

Run:

```
git fetch origin $BRANCH
git log $TAG..origin/$BRANCH --oneline
```

- **If there are new commits:** STOP. Tell the user to run the `pull-contributor` skill for
  `$BRANCH` first to integrate the new work before pushing back. Otherwise our push would
  silently overwrite the developer's new commits.
- **If empty:** the developer has not pushed anything new since our last review.
  Continue.

---

## Step 2 — Compute what the developer is missing

```
git diff origin/$BRANCH HEAD --stat
```

This shows every file that differs between the developer's branch and ours.

- **If empty:** tell the user the branches are already in sync and stop.
- **If non-empty:** show the `--stat` output to the user and ask for confirmation
  before proceeding. The user must confirm they want to push these changes.

---

## Step 3 — Create an isolated worktree

Never modify the current working directory. Work entirely inside a temporary
worktree so `$CURRENT_BRANCH` is not touched.

```bash
mkdir -p _local/worktrees
git worktree add _local/worktrees/push-$BRANCH origin/$BRANCH -b pushback/$BRANCH
```

This creates a checkout of `origin/$BRANCH` (the developer's latest) in a temp
folder, on a new local branch `pushback/$BRANCH`.

---

## Step 4 — Apply the diff

```bash
git diff origin/$BRANCH HEAD | git -C _local/worktrees/push-$BRANCH apply --3way
```

- If `git apply` exits with errors: report the conflicting files, remove the
  worktree (`git worktree remove _local/worktrees/push-$BRANCH --force &&
git branch -D pushback/$BRANCH`), and stop. Do NOT force-push through conflicts.
- If it applies cleanly: continue.

---

## Step 5 — Commit in the worktree

```bash
git -C _local/worktrees/push-$BRANCH add -A
git -C _local/worktrees/push-$BRANCH commit -m "refactor: revisione integrativa da $CURRENT_BRANCH"
```

---

## Step 6 — Push to the developer's remote branch

```bash
git -C _local/worktrees/push-$BRANCH push origin HEAD:$BRANCH
```

This pushes `pushback/$BRANCH` (which now contains the developer's original
commits plus our refactoring) to `origin/$BRANCH`. It is a **fast-forward push**
(new commit on top of their last one), so it never rewrites history.

---

## Step 7 — Clean up

```bash
git worktree remove _local/worktrees/push-$BRANCH --force
git branch -D pushback/$BRANCH
```

---

## Step 8 — Report

Tell the user:

- Which branch was updated (`origin/$BRANCH`)
- How many files changed and a brief summary of what was pushed
- That the developer can now run `git pull` to receive the changes
- Update the tag so future pull-contributor runs start from the right point:
  `git tag -f $TAG origin/$BRANCH && git push origin $TAG -f`
