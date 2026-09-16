---
name: prune-dev-branches-and-worktrees
description: Use when the user wants to clean up merged/stale git worktrees and branches (local + remote on origin) — "pulisci i branch vecchi", "ripulisci worktree e branch non più necessari", "prune dei branch mergiati". Runs a deterministic inventory script (never guesses), always confirms explicitly with the user before deleting anything.
---

# Prune dev branches and worktrees

**Sempre dal MAINTREE** (mai da un worktree — un worktree non può rimuovere se stesso in
modo pulito). Gli script rilevano da soli il toplevel del repo corrente
(`git rev-parse --show-toplevel`) — non serve un path hardcoded.

## Configurazione per-progetto

I branch protetti (mai toccati, oltre a `main` che è sempre incluso) si configurano in un
file opzionale `.claude-skills.json` alla root del repo:

```json
{ "prune-dev-branches-and-worktrees": { "protectedBranches": ["main", "staging"] } }
```

Precedenza: variabile d'ambiente `PROTECTED_BRANCHES` (override una tantum, spazio-separata)
> `.claude-skills.json` (persistente, committato nel progetto) > default (`main`).

## 1. Inventario (deterministico, read-only)

```bash
chmod +x skills/prune-dev-branches-and-worktrees/inventory.sh
skills/prune-dev-branches-and-worktrees/inventory.sh
```

Lo script classifica OGNI branch/worktree in una di quattro categorie, senza che l'agente
debba re-derivare la logica ogni volta:

- `NEVER_TOUCH` — branch protetti, branch attualmente checked out in un worktree, o con una
  PR ancora aperta.
- `SAFE_DELETE` — upstream già sparito su origin (ref locale stale), oppure PR con stato
  `MERGED`.
- `NEEDS_REVIEW` — nessuna PR trovata per quel branch (potrebbe essere lavoro personale/WIP
  di qualcuno, es. `dev-someone-*`), oppure PR chiusa SENZA merge.
- `WORKTREE` — elenco dei worktree con il branch su cui sono.

## 2. Presenta all'utente, chiedi conferma esplicita

**Mai cancellare `NEEDS_REVIEW` senza conferma esplicita, branch per branch o come gruppo.**
`SAFE_DELETE` può essere proposto come batch, ma va comunque mostrato all'utente prima di
eseguire — non cancellare in autonomia nemmeno quelli, è comunque un'azione distruttiva.

Presenta la tabella classificata, chiedi esplicitamente quali nomi procedere a cancellare
(usa `AskUserQuestion` se la lista è corta e le opzioni chiare, altrimenti chiedi in prosa
quali branch confermare).

## 3. Esecuzione (solo sui nomi confermati)

```bash
chmod +x skills/prune-dev-branches-and-worktrees/prune.sh
skills/prune-dev-branches-and-worktrees/prune.sh <branch1> <branch2> ...
```

Lo script:

- rifiuta esplicitamente i branch protetti anche se passati per errore (secondo livello di
  protezione, non fidarti solo della classificazione a monte);
- rimuove il worktree associato PRIMA di cancellare il branch, se presente;
- cancella il branch locale (se esiste) e quello remoto su `origin` (se esiste);
- non si ferma al primo errore — tenta tutti i branch passati, poi riporta un riepilogo di
  eventuali fallimenti;
- fa `git worktree prune` + `git fetch origin --prune` alla fine per pulire i riferimenti
  stale.

## Note

- I branch remoti "ambigui" senza nessuna PR (es. `dev-someone-2` — probabile lavoro
  personale di un collaboratore) vanno SEMPRE segnalati come `NEEDS_REVIEW`, mai proposti
  come cancellazione automatica anche se sembrano vecchi — potrebbero essere lavoro in corso
  di qualcun altro non ancora aperto come PR.
- Se `inventory.sh` non trova `gh` autenticato o senza accesso al repo, fallisce
  rumorosamente sulle chiamate `gh pr list` (non silenziosamente) — verifica `gh auth status`
  se la sezione PR sembra vuota in modo sospetto.
