---
name: allineami-a
description: Run by an EXTERNAL DEVELOPER on their own local branch to rebase/align it onto a reviewer's target branch, keeping only the work the reviewer hasn't seen yet as staged changes. Not for the reviewer's side — see pull-contributor and push-to-dev for that.
---

# Allineati a un branch target

Questa skill è eseguita dallo **sviluppatore esterno** sul suo branch
locale. Porta il branch alla stessa storia del branch target, lasciando in staged
solo il lavoro nuovo che il revisore non ha ancora visto.

**Branch target:** $ARGUMENTS

**Smartness:** il revisore usa `pull-contributor` che aggiorna il tag `reviewed/<MY_BRANCH>`
ad ogni review. Tutto prima di quel tag è già integrato (e rifattorizzato) nel target.
La skill considera solo il lavoro DOPO quel watermark — non tutto il diff tra i due branch.

---

## Risultato atteso al termine

- Branch di backup creato su origin (nascosto, non compare in GitHub)
- Branch locale resettato alla storia del target (`git reset --hard`)
- Remote aggiornato subito con force-push (stato pulito, allineato)
- Lavoro post-review in **staged** localmente, pronto per revisione e commit
- La skill chiede: "Vuoi che rivediamo insieme le modifiche?"

---

## Step 1 — Controlli di sicurezza

Leggi il branch corrente. Se coincide con il branch target: fermati, non ha senso
allinearsi a se stessi. Se nessun argomento è stato passato: chiedi quale branch usare.

---

## Step 2 — Fetch

Scarica l'ultimo stato del branch target e tutti i tag da origin.
I tag includono `reviewed/<MY_BRANCH>` che il revisore ha pushato dopo l'ultima review.

Mostra all'utente i commit che esistono nel target ma non nel suo branch (le novità
del revisore) e quelli che esistono nel suo branch ma non nel target (il suo lavoro).

---

## Step 3 — Determina il watermark della review

Cerca il tag `reviewed/<MY_BRANCH>` in locale (appena fetchato).

- **Se esiste:** questo è il punto fino a cui il revisore ha già visto e integrato
  il lavoro dello sviluppatore. La patch includerà solo i commit SUCCESSIVI a questo tag.
  Mostra di quanti commit si tratta.
- **Se non esiste:** nessuna review è mai avvenuta. Usa il merge-base tra il branch
  corrente e il target come punto di partenza. Avvisa l'utente che verrà incluso
  tutto il suo lavoro e che sarebbe meglio che il revisore facesse `pull-contributor`
  almeno una volta prima.

Se non ci sono commit nuovi né WIP non committato: i branch sono già allineati.
Procedi direttamente al push (step 8) senza toccare nulla.

---

## Step 4 — Crea un backup nascosto su origin

Prima di qualsiasi operazione distruttiva, pusha il commit corrente su un ref
nel namespace `refs/backups/` con un timestamp (formato `YYYYMMDD-HHMMSS`).

Esempio: `refs/backups/contributor-topic-20990101-120000`

I ref sotto `refs/backups/` non compaiono nella lista branch di GitHub né in
`git branch -r` — sono invisibili a meno di cercarli esplicitamente.

Conferma all'utente che il backup è stato creato e qual è il ref esatto,
così sa come recuperarlo in caso di problemi:

```
git fetch origin refs/backups/<nome>:refs/backups/<nome>
git reset --hard FETCH_HEAD
```

---

## Step 5 — Salva lo stato locale prima del reset

1. Fai stash di tutto il lavoro non committato (staged, unstaged e untracked).
   Nota se lo stash è stato creato o se non c'era nulla.

2. Salva come patch il diff tra il watermark (step 3) e il HEAD corrente.
   Questi sono i commit nuovi dello sviluppatore che andranno in staged.
   Mostra un `--stat` di questa patch all'utente.

3. Se lo stash è stato creato, salva anche quello come patch separata
   (rappresenta il WIP non committato che tornerà in working tree).

---

## Step 6 — Mostra il riepilogo e chiedi conferma

Presenta all'utente:

- Branch corrente e target
- Ref del backup appena creato
- Watermark della review usato (tag o merge-base)
- Elenco dei file che finiranno in staged (dal `--stat` di step 5)
- Elenco del WIP non committato (se presente)
- Cosa NON verrà incluso (tutto il lavoro già rivisto)

Avvisa che il branch verrà riscritto e il remote aggiornato con force-push.
Chiedi conferma esplicita prima di procedere.

---

## Step 7 — Reset e riapplicazione del lavoro nuovo

1. Resetta il branch locale alla storia del target: `git reset --hard origin/<BRANCH>`.

2. Applica la patch dei commit post-review come modifiche **staged** (non committate).
   Usa `--3way` se l'apply diretto fallisce.
   Se fallisce anche con `--3way`: riporta i file in conflitto, lascia le patch in
   `_local/`, avvisa l'utente che può annullare tutto con
   `git reset --hard refs/backups/<nome>` e fermati.

3. Applica la patch del WIP come modifiche nel working tree (non staged).

---

## Step 8 — Push dello stato allineato

Pusha il branch resettato su origin con `--force-with-lease`.
Le modifiche staged non vengono incluse nel push — restano solo in locale.

Da questo momento i push futuri dello sviluppatore sono `git push` normali (fast-forward),
perché il remote è già sulla storia pulita del revisore.

Se il push fallisce perché qualcun altro ha pushato nel frattempo: fai fetch e riprova.

---

## Step 9 — Pulizia

Rimuovi i file patch temporanei in `_local/`.

---

## Step 10 — Report finale e proposta di review

Se ci sono file in staged:

```
✓ Branch allineato e pushato su origin/<MY_BRANCH>

Il remote è ora identico a origin/<BRANCH>.
Hai N file in staged con il tuo lavoro incrementale rispetto all'ultima review.
Il tuo WIP non committato (se presente) è nel working tree.
Backup nascosto: refs/backups/<nome> (cancella con: git push origin --delete refs/backups/<nome>)

Vuoi che rivediamo insieme le modifiche in staged per strutturare il commit?
```

Se staged è vuoto:

```
✓ Branch allineato — il tuo lavoro era già tutto coperto da <BRANCH>.
I push futuri funzionano normalmente con: git push origin <MY_BRANCH>
Backup: refs/backups/<nome> (cancella quando sei sicuro)
```
