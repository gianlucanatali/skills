---
name: start-isolated-worktree
description: Use when the user wants to start new work (bug fixes, a feature, or a plan file) in an isolated environment — a dedicated git worktree with its own branch, its own local dev stack (DB, backend services), and its own dev server port — or when tearing down/cleaning up one of these isolated worktrees once the work is done, including deciding whether the branch should also be deleted.
---

# Avviare un worktree isolato

Playbook generico per lavorare su un branch/feature in un worktree separato dal maintree,
con un proprio stack di sviluppo isolato (DB, servizi backend, dev server) così da non
toccare mai l'ambiente condiviso. Il "come" avviare/fermare lo stack (Supabase, Docker
Compose, un DB locale, ecc.) è specifico del progetto — usa
`scripts/start-isolated-worktree-template.mjs` come punto di partenza, personalizzando le
funzioni `setupStack()`/`teardownStack()` per il tuo stack reale.

## Quando usarla

L'utente vuole iniziare un lavoro (fix, feature, o un piano) partendo da un branch remoto
(es. `origin/main`) senza toccare il worktree principale né lo stack di sviluppo condiviso.

## 1. Determina branch sorgente + slug del worktree

- **Branch:** quello indicato esplicitamente dall'utente. Se manca e non è deducibile da un
  piano allegato, chiedi — non indovinare il branch sorgente.
- **Slug:** kebab-case, **basato sull'intento**, non sul nome del branch. "risolvere bug nel
  login" → `fix-login`; "implementare l'export CSV" → `feat-csv-export`. Se l'utente allega
  un file di piano, leggilo prima: titolo/obiettivo del piano è la fonte migliore per lo
  slug.
- Verifica che il path del worktree (es. `.worktrees/<slug>`) non esista già (`git worktree
  list`); se esiste, scegli un altro slug o chiedi se riprendere quello.

## 2. Esegui lo script di setup

```bash
node scripts/start-isolated-worktree-template.mjs --branch <branch-sorgente> --name <slug>
```

Esegui questo **dal maintree** (mai da dentro un altro worktree — lo script rifiuta di
partire se `cwd` è già sotto la cartella dei worktree). Il template:

1. `git fetch origin <branch>`
2. `git worktree add <worktrees-dir>/<slug> -b <slug> origin/<branch>`
3. sceglie porte libere per i servizi del tuo stack (scansione a partire da una porta base,
   incrementando se occupata) e per il dev server
4. isola la configurazione dello stack **dentro il worktree** — per costruzione di `git
   worktree`, un file di config modificato lì non tocca mai quello del maintree, non serve
   alcun `git checkout` di ripristino
5. eredita i secret di runtime locali dal **maintree**, se un file `.env`/equivalente esiste
   lì (mai in git), sovrascrivendo solo i valori che devono puntare al dev server isolato
   (es. un allow-list di origin CORS)
6. installa le dipendenze dentro il worktree
7. scrive le variabili pubbliche necessarie al dev server

Stampa a fine corsa porte, branch, il comando per il dev server, **e se ha trovato o no** un
file di secret da ereditare nel maintree.

**Se non l'ha trovato:** lo stack isolato non avrà le chiavi/token di servizi esterni —
qualunque funzionalità che dipende da quei servizi **fallirà qui in modo sistematico**, per
qualunque input, non solo quello che stai testando. Un pattern "fallisce per tutto, non solo
per un caso specifico" è il segnale che è questo gap, **non un bug nel codice che hai appena
scritto**. Prima di fare debugging su un fallimento del genere in un worktree isolato,
controlla l'output di creazione del worktree per vedere se i secret sono stati ereditati; se
non ci sono, il fix è configurare il file di secret nel maintree e ricreare il worktree — non
c'è nulla da aggiustare nel codice applicativo.

## 3. Aggancia la sessione al worktree

```
EnterWorktree(path="<worktrees-dir>/<slug>")
```

Da qui in poi ogni comando di questa sessione (e di ogni subagent lanciato con lo stesso cwd)
opera dentro il worktree, non nel maintree — è la barriera che evita che un agente sbagli
directory e tocchi lo stack condiviso. Se lanci subagent dedicati per lavorare lì, passa loro
il path assoluto del worktree come cwd: mai il path del maintree.

## 4. Avvia il dev server

```bash
npm run dev -- --port <devPort> --strictPort
```

Riporta all'utente: path del worktree, branch, porte assegnate.

### Verificare che il dev server abbia legato la porta (obbligatorio)

Avvia il dev server catturando il log e verifica leggendo il log, MAI con un bare `curl`:

```bash
npm run dev -- --port <PORT> --strictPort > /tmp/dev-<name>.log 2>&1 &
for i in $(seq 1 20); do grep -q "localhost:<PORT>/" /tmp/dev-<name>.log && break; sleep 1; done
grep -q "localhost:<PORT>/" /tmp/dev-<name>.log && echo OK || { echo FAIL; tail -20 /tmp/dev-<name>.log; }
```

Un `curl :<PORT>` che torna 200 **non è una prova**: un dev server di un ALTRO worktree,
puntato a un ALTRO backend, può già occupare quella porta. `--strictPort` fa fallire il TUO
dev server se la porta è occupata, ma il fallimento finisce solo nel log — se non lo leggi, i
test girano silenziosamente contro il backend sbagliato (caso reale: ore perse a inseguire un
bug fantasma che era solo "database sbagliato, dato di test assente").

## 5. Teardown

Due modi in cui parte:

- **Richiesta esplicita** dell'utente ("cancella questo worktree", "chiudi l'ambiente
  isolato", "butta via fix-login").
- **Proposta proattiva tua**: quando il task per cui hai creato il worktree è finito
  (feature/fix completati, o piano chiuso), **prima** di chiudere/riassumere il lavoro
  **chiedi** all'utente se vuole smontare l'ambiente isolato. Non farlo mai in silenzio, e
  non lasciarlo aperto senza chiedere — chi ha lo stack isolato ancora acceso consuma
  risorse (Docker/porte/processi) senza saperlo.

Se la sessione è ancora agganciata al worktree via `EnterWorktree`, esci prima con
`ExitWorktree(action="keep")` (il teardown vero lo fa lo script, non
`ExitWorktree(action="remove")`).

```bash
node scripts/start-isolated-worktree-template.mjs --teardown --name <slug> [--delete-branch]
```

Esegui questo **dal maintree**, come per la creazione. Il template:

1. **Rifiuta se ci sono modifiche non committate** nel worktree diverse dai file di config
   isolati attesi — in quel caso si ferma e stampa cosa manca da salvare, senza toccare
   nulla.
2. Se ci sono commit locali sul branch **non pushati** su un remote, li segnala (il branch
   resterà l'unico posto in cui esistono, dopo il teardown).
3. Ferma il dev server e lo stack isolato (`teardownStack()`).
4. `git worktree remove` — **il branch non viene toccato di default.**

**Cancellazione del branch — solo con `--delete-branch`, e solo se sicuro:** di default il
branch resta locale. Se l'utente chiede anche di cancellarlo, passa `--delete-branch`: lo
script cancella (`git branch -d`, mai `-D`) **solo se** verifica che il branch è mergiato —
PR mergiata o ancestor del suo upstream — **e** non ha commit locali non pushati. Se anche
una sola di queste condizioni non è verificata, si rifiuta e stampa il motivo (es. "N commit
non pushati", "non risulta mergiato"): non forzare mai la cancellazione a mano in quel caso,
riporta il motivo all'utente e lascia decidere lui (pushare prima? aprire la PR? tenerlo così
com'è?).

Se l'utente non menziona il branch, **chiedi prima di passare `--delete-branch`** — non è la
scelta di default.

## Da non fare mai

- Non avviare/fermare lo stack isolato dal maintree per "sistemarlo" — sono ambienti separati
  (porte/identificatori diversi), non serve e rischia di confondere quale stack stai
  toccando.
- Non fare `git worktree add` da dentro un altro worktree per questo flusso — lo script
  blocca il caso, ma bypassarlo a mano rischia di annidare i worktree nel path sbagliato.
- Non riusare uno slug/worktree esistente per un task diverso — crea confusione su quale
  branch/porte appartengono a cosa; se il lavoro precedente è finito, fai teardown prima.
- Non cancellare mai un branch a mano (`git branch -D`) per "bypassare" un rifiuto dello
  script su `--delete-branch` — se dice che non è sicuro (commit non pushati, non mergiato),
  è così: chiedi all'utente cosa fare, non forzare.
- Non fare teardown senza prima chiedere se il task nel worktree è davvero finito — se hai
  anche solo il dubbio, chiedi invece di dare per scontato.
