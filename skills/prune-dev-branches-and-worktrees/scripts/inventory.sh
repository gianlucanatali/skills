#!/usr/bin/env bash
# Deterministic, read-only inventory of git worktrees/branches (local + remote,
# origin only) for the prune-dev-branches-and-worktrees skill. Never deletes
# anything — only classifies. Run from the MAINTREE (not a worktree).
#
# Output: four sections, machine-parseable (one "kind\tname\treason" line each):
#   NEVER_TOUCH   - protected branches, or checked out in a worktree right now
#   SAFE_DELETE   - remote already gone (local stale ref) OR PR state=MERGED
#   NEEDS_REVIEW  - no PR found at all, or PR is CLOSED (not merged) — ask the user
#   WORKTREE      - worktree paths, paired with the branch they're on
#
# Usage: skills/prune-dev-branches-and-worktrees/scripts/inventory.sh
set -euo pipefail
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

# True if $1 (a ref, e.g. "origin/some-branch") is fully an ancestor of (or
# equal to) at least one protected branch — i.e. its content already made
# it into the mainline WITHOUT necessarily leaving a `gh pr` record (rebase
# merges, squash-without-a-linked-PR, cherry-picks — `gh pr list --head`
# alone can miss branches whose content was fully merged this way). This is
# a STRONGER signal than PR state alone and is checked in addition to it,
# never instead of it.
is_ancestor_of_any_protected() {
  local ref="$1" tip
  tip=$(git rev-parse "$ref" 2>/dev/null) || return 1
  for p in $PROTECTED; do
    if git rev-parse "origin/$p" >/dev/null 2>&1; then
      local mb
      mb=$(git merge-base "$ref" "origin/$p" 2>/dev/null) || continue
      [ "$mb" = "$tip" ] && { echo "$p"; return 0; }
    fi
  done
  return 1
}

echo "=== WORKTREE ==="
git worktree list | while read -r line; do
  wt_path=$(echo "$line" | awk '{print $1}')
  branch=$(echo "$line" | grep -oE '\[[^]]+\]' | tr -d '[]' || echo "(detached)")
  echo -e "WORKTREE\t$wt_path\ton branch: $branch"
done

echo ""
echo "=== LOCAL BRANCHES ==="
# Branches currently checked out in any worktree — never touch, in use.
CHECKED_OUT_BRANCHES=$(git worktree list | grep -oE '\[[^]]+\]' | tr -d '[]' || true)

git for-each-ref --format='%(refname:short)|%(upstream:short)|%(upstream:track)' refs/heads/ | while IFS='|' read -r branch upstream track; do
  is_protected=false
  for p in $PROTECTED; do
    [ "$branch" = "$p" ] && is_protected=true
  done
  is_checked_out=false
  for co in $CHECKED_OUT_BRANCHES; do
    [ "$branch" = "$co" ] && is_checked_out=true
  done

  if [ "$is_protected" = true ]; then
    echo -e "NEVER_TOUCH\t$branch\tprotected branch"
  elif [ "$is_checked_out" = true ]; then
    echo -e "NEVER_TOUCH\t$branch\tcurrently checked out in a worktree"
  elif [[ "$track" == *"gone"* ]]; then
    echo -e "SAFE_DELETE\t$branch\tupstream $upstream is gone (already deleted on origin)"
  else
    # Has a live upstream or no upstream at all — check PR status to decide.
    pr_json=$(gh pr list --state all --head "$branch" --json number,title,state,url --limit 1 2>/dev/null || echo "[]")
    pr_state=$(echo "$pr_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['state'] if d else 'NONE')" 2>/dev/null || echo "NONE")
    case "$pr_state" in
      MERGED)
        pr_url=$(echo "$pr_json" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['url'])")
        echo -e "SAFE_DELETE\t$branch\tPR merged: $pr_url"
        ;;
      OPEN)
        echo -e "NEVER_TOUCH\t$branch\tPR still open"
        ;;
      CLOSED)
        pr_url=$(echo "$pr_json" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['url'])")
        echo -e "NEEDS_REVIEW\t$branch\tPR closed WITHOUT merging: $pr_url — confirm before deleting"
        ;;
      NONE|*)
        merged_into=$(is_ancestor_of_any_protected "refs/heads/$branch" || true)
        if [ -n "$merged_into" ]; then
          echo -e "SAFE_DELETE\t$branch\tno PR found, but fully merged into $merged_into (verified via merge-base)"
        else
          echo -e "NEEDS_REVIEW\t$branch\tno PR found for this branch — could be personal/WIP work, confirm before deleting"
        fi
        ;;
    esac
  fi
done

echo ""
echo "=== REMOTE-ONLY BRANCHES (origin, no local tracking branch) ==="
LOCAL_BRANCHES=$(git for-each-ref --format='%(refname:short)' refs/heads/)
git for-each-ref --format='%(refname:short)' refs/remotes/origin/ | grep -vE '^origin(/HEAD)?$' | sed 's#^origin/##' | while read -r rbranch; do
  has_local=false
  for lb in $LOCAL_BRANCHES; do
    [ "$rbranch" = "$lb" ] && has_local=true
  done
  [ "$has_local" = true ] && continue

  is_protected=false
  for p in $PROTECTED; do
    [ "$rbranch" = "$p" ] && is_protected=true
  done
  if [ "$is_protected" = true ]; then
    echo -e "NEVER_TOUCH\torigin/$rbranch\tprotected branch"
    continue
  fi

  pr_json=$(gh pr list --state all --head "$rbranch" --json number,title,state,url --limit 1 2>/dev/null || echo "[]")
  pr_state=$(echo "$pr_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['state'] if d else 'NONE')" 2>/dev/null || echo "NONE")
  case "$pr_state" in
    MERGED)
      pr_url=$(echo "$pr_json" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['url'])")
      echo -e "SAFE_DELETE\torigin/$rbranch\tPR merged: $pr_url"
      ;;
    OPEN)
      echo -e "NEVER_TOUCH\torigin/$rbranch\tPR still open"
      ;;
    CLOSED)
      pr_url=$(echo "$pr_json" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['url'])")
      echo -e "NEEDS_REVIEW\torigin/$rbranch\tPR closed WITHOUT merging: $pr_url — confirm before deleting"
      ;;
    NONE|*)
      merged_into=$(is_ancestor_of_any_protected "origin/$rbranch" || true)
      if [ -n "$merged_into" ]; then
        echo -e "SAFE_DELETE\torigin/$rbranch\tno PR found, but fully merged into $merged_into (verified via merge-base)"
      else
        echo -e "NEEDS_REVIEW\torigin/$rbranch\tno PR found — could be someone's personal/WIP branch (e.g. dev-*), confirm before deleting"
      fi
      ;;
  esac
done
