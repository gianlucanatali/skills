#!/usr/bin/env bash
# Deletes EXACTLY the branches/worktrees passed as arguments — nothing else,
# no re-derivation of what's "safe". This script trusts its caller: the
# agent must only pass names the user explicitly confirmed after reviewing
# inventory.sh's output. Run from the MAINTREE (not a worktree).
#
# Usage: skills/prune-dev-branches-and-worktrees/scripts/prune.sh <branch1> [branch2] ...
# Accepts both "some-branch" and "origin/some-branch" forms.
#
# For each name: removes any worktree checked out on it, deletes the local
# branch if it exists, deletes the remote branch on origin if it exists.
# Every git command's exit status is checked; a failure on one branch does
# NOT stop the script from attempting the rest, but the run ends with a
# non-zero exit code if anything failed (printed in the summary).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

# Protected branches: env override > .claude-skills.json (project-local, checked
# in) > default "main". See SKILL.md § "Configurazione per-progetto".
if [ -n "${PROTECTED_BRANCHES:-}" ]; then
  PROTECTED="$PROTECTED_BRANCHES"
elif [ -f .claude-skills.json ]; then
  PROTECTED=$(python3 -c "
import json
d = json.load(open('.claude-skills.json'))
print(' '.join(d.get('prune-dev-branches-and-worktrees', {}).get('protectedBranches', ['main'])))
")
else
  PROTECTED="main"
fi

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <branch1> [branch2] ..." >&2
  exit 1
fi

FAILED=0

for raw_name in "$@"; do
  name="${raw_name#origin/}"

  is_protected=false
  for p in $PROTECTED; do
    [ "$name" = "$p" ] && is_protected=true
  done
  if [ "$is_protected" = true ]; then
    echo "REFUSING to touch protected branch: $name" >&2
    FAILED=1
    continue
  fi

  echo "--- $name ---"

  # 1. Remove any worktree checked out on this branch. index() is a literal
  # substring search — using ~ (regex match) here was a real bug: awk's ~
  # treats "[name]" as a REGEX CHARACTER CLASS (any one of those chars),
  # not a literal bracketed string, so it matched almost every line.
  wt_path=$(git worktree list | awk -v b="[$name]" 'index($0, b) {print $1}')
  if [ -n "$wt_path" ]; then
    echo "  removing worktree: $wt_path"
    if ! git worktree remove "$wt_path" 2>&1; then
      echo "  worktree remove failed (uncommitted changes?) — trying --force" >&2
      if ! git worktree remove --force "$wt_path" 2>&1; then
        echo "  FAILED to remove worktree $wt_path" >&2
        FAILED=1
        continue
      fi
    fi
  fi

  # 2. Delete local branch, if it exists.
  if git show-ref --verify --quiet "refs/heads/$name"; then
    echo "  deleting local branch: $name"
    if ! git branch -D "$name" 2>&1; then
      echo "  FAILED to delete local branch $name" >&2
      FAILED=1
    fi
  fi

  # 3. Delete remote branch on origin, if it exists.
  if git show-ref --verify --quiet "refs/remotes/origin/$name"; then
    echo "  deleting origin/$name"
    if ! git push origin --delete "$name" 2>&1; then
      echo "  FAILED to delete origin/$name" >&2
      FAILED=1
    fi
  fi
done

echo ""
git worktree prune
git fetch origin --prune

if [ "$FAILED" -ne 0 ]; then
  echo "One or more deletions FAILED — see errors above." >&2
  exit 1
fi
echo "Done."
