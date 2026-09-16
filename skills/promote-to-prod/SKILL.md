---
name: promote-to-prod
description: Use when asked to promote/deploy a staging branch to production across two repos (a public fork/downstream and its upstream), open a "Deploy Prod" PR, or when an E2E/deploy check on a fork→upstream PR fails with secrets that look missing even though they are configured — that is almost always the GitHub cross-repository pull_request secrets restriction, not a missing secret. Covers the staging-mirror branch trick.
---

# Promote staging → prod (cross-repo)

Applicabile a qualunque progetto con questa topologia: un fork/downstream (dove vive
`staging`) e un repo upstream/originale (dove vive `main`/produzione), entrambi reali su
GitHub — non necessariamente un vero "fork" nel senso GitHub, basta che siano due repository
distinti con permessi push condivisi dallo stesso account.

## Perché esiste

Una PR diretta fork → originale è **cross-repository**: GitHub Actions non passa mai i
secrets ai workflow `pull_request` quando la PR è cross-repo (head repo ≠ base repo) —
protezione anti-esfiltrazione, non aggirabile via configurazione, anche se il secret è
configurato correttamente su entrambi i repo e anche se il "fork" è in realtà quello del
maintainer. Effetto pratico: una PR diretta fork → originale fa fallire (o rende inutile)
qualunque check E2E/deploy che dipende da un secret, che risulterà vuoto anche se
configurato bene ovunque.

## Il pattern: staging-mirror branch

Uno script di orchestrazione (adatta nome/comando al tuo progetto, es. `npm run
promote-to-prod`, backed da uno script git/gh dedicato):

1. `git fetch origin staging`, poi aggiorna un branch `prod-candidate` **dentro al
   fork/downstream** (remote `origin`): mergia `origin/staging` in `prod-candidate` (crea il
   branch alla prima esecuzione) e lo pusha su `origin`. Fallo in un git worktree
   usa-e-getta, così **non tocca mai il branch/working tree correnti** — sicuro anche con
   modifiche non committate in corso. Risultato: il fork tiene sempre una traccia persistente
   di "cosa è stato effettivamente promosso", non solo lo stato corrente (mutevole) di
   `staging`.
2. Forza un branch `staging-mirror` **dentro** il repo upstream/originale ad allinearsi a
   `origin/prod-candidate` (force-push deliberato: `staging-mirror` esiste solo per
   rispecchiare lo stato corrente, nessuna storia propria da preservare).
3. Apre (o riusa, se già aperta) la PR `staging-mirror → main` **dentro** il repo
   upstream/originale — **stesso repo**, non più cross-repo: la CI lì vede i secrets
   normalmente.

Se il merge di `staging` in `prod-candidate` va in conflitto (raro: succede solo se
`prod-candidate` ha divergenza propria, es. un hotfix pushato lì direttamente e non ancora
rientrato in `staging`), lo script dovrebbe fermarsi e stampare il path del worktree
temporaneo con le istruzioni per risolvere a mano e rilanciare.

Nessun secret nuovo da gestire: usa le credenziali `git`/`gh` già autenticate in locale
(accesso push diretto già presente sul repo upstream/originale) — un PAT dedicato è
un'alternativa più rischiosa (scope di scrittura ampio su un intero repo, non scoped a un
singolo servizio).

## Procedura (per qualunque agente o da terminale)

1. Conferma con l'utente che vuole davvero promuovere lo stato attuale di `staging`
   (fork/downstream) verso una PR di produzione sul repo upstream/originale — è un'azione
   visibile ad altri (apre/aggiorna una PR reale su un repo che non è il proprio).
2. Esegui lo script/comando di promote del tuo progetto.
3. Riporta l'URL della PR restituito e ricorda che il check E2E lì (stesso repo, non
   cross-repo) vedrà i secret normalmente — se fallisce ora è un bug vero, non un problema
   di secret mancanti.

## Fix mirato direttamente su prod (non tutta `staging`)

Quando l'utente chiede un fix specifico **su `main` di produzione**, non "promuovi
staging" — es. un branch creato da `upstream/main` per un bug che riguarda solo prod —
**non usare lo script di promote** (quello porta _tutto_ `staging`, sproporzionato per un
fix mirato) **e non aprire la PR dal fork** (`origin` → `upstream`): è cross-repo, stesso
limite sui secrets di sopra, il check E2E lì fallisce sempre per il secret mancante a
prescindere da quanto sia corretto il codice.

Invece: crea il branch da `upstream/main`, e quando è pronto **pusha il branch direttamente
su `upstream`** (`git push upstream <branch>`), non su `origin` — l'accesso push diretto al
repo upstream/originale è già disponibile (stesse credenziali `git`/`gh` di sopra). Poi apri
la PR `<branch> → main` **dentro** il repo upstream/originale (`gh pr create --repo
<owner>/<upstream-repo> --head <branch>`, niente prefisso `owner:` sull'head — same-repo,
non cross-repo). La CI vede i secret normalmente, il check E2E gira per davvero.

Se il branch era già stato pushato per errore su `origin` (fork) con una PR cross-repo già
aperta lì: pusha lo stesso branch anche su `upstream`, chiudi la PR cross-repo con un
commento che rimanda alla nuova, apri la PR same-repo sul branch appena pushato. Il branch
duplicato su `origin` non è dannoso, è solo ridondante — si può lasciare o cancellare.

**Allineare `staging` in parallelo, per evitare conflitti alla prossima promote**: se il fix
su prod tocca righe che `staging` ha già modificato diversamente (verificalo con `git log
--all -S '<stringa>' -- <file>` e `git merge-base --is-ancestor <commit> origin/staging`),
porta lo stesso fix anche su un branch da `origin/staging` con una PR verso `staging` sul
fork — altrimenti la prossima promote genera un conflitto testuale reale (o peggio,
silenzioso) su quelle righe.
