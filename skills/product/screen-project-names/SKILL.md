---
name: screen-project-names
description: Check a proposed project or product name for existing uses and potential trademark conflicts, with dated sources and explicit unknowns. Use after brainstorming; this is preliminary research, not legal clearance.
---

# Screen project names

Turn an existing naming shortlist into an evidence table. This skill adds source tracking and uncertainty handling to naming workflows; it does not duplicate name generation.

## Inputs and upstream use

Use the supplied names, product category, and intended markets. If markets or category are missing, ask or label the research as a general web screen with trademark scope unresolved.

If the user also needs ideas, use the installed [domain-name-brainstormer](https://github.com/ComposioHQ/awesome-claude-skills/tree/master/domain-name-brainstormer) skill first, then apply this screening step to its output. Read its instructions; do not assume it has been invoked or its availability claims verified. If it is missing, give this setup command and pause generation:

`npx skills@latest add ComposioHQ/awesome-claude-skills --skill domain-name-brainstormer`

Supplied names can be screened without that dependency. Do not install dependencies, register domains, contact owners, or buy anything implicitly.

## Evidence checks

For each candidate:

1. Search the exact name and plausible spelling or phonetic variants, combined with the product category. Check relevant product sites, repositories and package registries. Open the supporting pages; a search snippet is a lead, not verification.
2. Record existing uses with their source and category. Separate an obvious same-market collision from an unrelated use; neither is a legal ruling.
3. For trademark screening, use the relevant official national or regional registers. [USPTO](https://www.uspto.gov/trademarks/search) and [WIPO](https://www.wipo.int/en/web/global-brand-database) are starting points, not complete global coverage. Record which registers, terms, markets, and goods/services were actually checked. A blocked registry remains unchecked; an exact-name search does not rule out confusing similarity.
4. Keep domain, repository-handle, and trademark findings separate. A missing website, HTTP 404, available handle, or zero search results does not establish legal availability. Claim domain availability only from a current registrar check, not a web search.
5. If browsing is unavailable, return an unchecked shortlist and the outstanding checks. Never invent a citation or present recall as a current search.

## Result

For every candidate, report:

| Name | Existing uses and dated sources | Trademark scope checked | Unchecked areas | Recommendation |
| --- | --- | --- | --- | --- |

Use recommendations such as **reject for practical collision**, **investigate further**, or **no conflict found in the checks performed**. Include clickable source URLs, the actual search terms, and the check date so the work can be repeated. For supplied evidence, cite its provided URL and label it supplied rather than independently verified. If no searches ran, say so instead of inventing search terms.

Never label a name unique, trademark-free, legally safe, or cleared. For a commercial launch, flag jurisdiction-specific professional clearance as a separate step. An invented spelling or unusual phonetic blend is not evidence of availability.
