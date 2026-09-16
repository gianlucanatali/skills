---
name: contribute-to-upstream
description: Prepare and implement a maintainer-ready contribution to an existing open-source project by following its contribution rules, local code patterns, tests, and pull-request process. Use after selecting a repository and scoped issue; not for issue discovery, fleet orchestration, or publishing without approval.
---

# Contribute to an upstream project

Treat the target repository—not a generic workflow—as the source of truth. The result is a
small, evidenced contribution brief and, when authorized, a patch that a maintainer can review
without rediscovering the project's process.

## Establish the upstream contract

Before proposing or changing code, inspect the relevant repository material:

- `CONTRIBUTING`, development/setup documentation, and local agent instructions;
- issue and pull-request templates, labels, CI workflows, and release or compatibility policy;
- security policy when the work could expose a vulnerability; use the project's private reporting
  route instead of a public issue when required;
- the selected issue or discussion, including maintainer responses and duplicate/related work;
- nearby production code and tests that establish the local design, naming, error-handling, and
  test conventions.

Record the exact commands, requirements, and unresolved conflicts. If repository sources disagree,
prefer the more specific and more recently maintained source; surface the conflict rather than
inventing a rule.

Stop and explain why if the issue is unowned, the proposed change is out of scope, the repository
does not accept the contribution type, or a required decision is still missing. Do not turn an
ambiguous request into an unsolicited redesign.

## Make the smallest useful change

State the intended behavior and acceptance evidence before editing. Reuse an established local
pattern when one exists. Keep unrelated formatting, refactors, dependencies, and generated files
out of the patch unless the upstream contract requires them.

Run the narrowest relevant checks first, then every project-required check that is practical in the
available environment. Distinguish a passing command from an unrun or unavailable one; never
describe unexecuted checks as verified.

Review the final diff as a maintainer would:

- it addresses the selected issue and no larger one;
- public API, compatibility, documentation, changelog, and test expectations are met when the
  repository requires them;
- the implementation and tests match nearby local precedent;
- no credentials, private paths, personal infrastructure, or unrelated changes are present.

## Deliver a contribution brief

Before handing off, provide:

```markdown
## Contribution brief
- Upstream contract: <files/links consulted and the rules that mattered>
- Scope: <issue or agreed problem, including exclusions>
- Local precedent: <files or symbols followed>
- Change: <what changed, or why no change was made>
- Evidence: <commands run and observed result; clearly mark checks not run>
- Maintainer handoff: <PR title/body or remaining question, if requested>
```

Opening issues or pull requests, posting comments, pushing branches, assigning labels, and merging
are external actions. Do them only when the user explicitly authorizes the specific action and the
repository's process permits it.

This skill does not choose projects or issues, teach a contribution workflow, coordinate workers,
or act as an identity/approval system. Add those concerns as private adapters around this public
core when they are genuinely needed.
