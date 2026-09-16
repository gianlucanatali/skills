---
name: compat-gate
description: Use when the user wants to verify that a branch's pending changes (migrations, schema-affecting code, encryption/wire-format changes) can be safely applied on top of a live-shaped environment (staging code + realistic data) without breaking anything — "verifica che non rompa staging", "gate di compatibilità", "test contro dati reali prima di mergiare", or before merging/deploying any change that touches the DB schema, an encrypted wire format, or another cross-version compatibility surface. Also covers re-running this gate for a NEW branch/feature using the same pattern. Written for a Supabase project — adapt the stack-specific commands if yours differs.
---

# Compat gate — verifica che il branch non rompa un ambiente live

## Quando usarla

Il branch corrente introduce **migration DB, un cambio di wire-format cifrato, o qualunque
altra modifica che deve restare compatibile con un ambiente già vivo** (staging, e per
estensione prod) — e prima di mergiare/deployare si vuole una prova concreta, non solo "le
migration non falliscono in CI", che applicare queste modifiche sopra dati e codice REALI
(staging) non rompe nulla.

**Non usarla per**: un giro E2E normale (usa `run-e2e`), un worktree isolato per sviluppo
normale senza bisogno di due versioni del codice sulla stessa DB (usa
`start-isolated-worktree`). Questa skill serve SPECIFICAMENTE al caso "due versioni di
codice, una DB condivisa, verifica che la seconda funzioni sopra i dati/schema scritti dalla
prima".

## Il pattern: due worktree, uno stack Supabase condiviso

- **Worktree "old"** = il codice ATTUALMENTE vivo nell'ambiente target (tipicamente
  `origin/staging`) — possiede lo stack Supabase isolato (`supabase start` gira SOLO qui).
- **Worktree "new"** = il branch sotto test, alla sua **tip CORRENTE** (mai un commit
  vecchio — se il worktree esiste già da una sessione precedente, aggiornalo prima di
  procedere, vedi Fase 0) — si connette allo STESSO stack via variabili d'ambiente, non
  lancia mai un proprio `supabase start`.

Verifica prima se esistono già worktree/stack riusabili da una sessione precedente (`git
worktree list`, `docker ps --format '{{.Names}}' | grep <project_id-candidato>`) prima di
crearne di nuovi — questo pattern è pensato per essere riacceso e riusato più volte nella
stessa sessione di lavoro (setup costoso, verifiche ripetute economiche).

## Fase 0 — Setup worktree (nuovo, o refresh di uno esistente)

```bash
# Se NON esistono ancora:
git worktree add ../<repo>-compat-<slug>-old <baseline-ref>   # es. origin/staging, o un commit fisso
git worktree add ../<repo>-compat-<slug>-new -b compat/<slug>-under-test <branch-sotto-test>

cd ../<repo>-compat-<slug>-old && npm install
cd ../<repo>-compat-<slug>-new && npm install
```

**Se il worktree "new" esiste già da prima**: il branch sotto test si muove, il worktree
no — aggiornalo SEMPRE alla tip corrente prima di procedere (altrimenti il gate verifica una
versione stale, non "il branch finale" come richiesto):

```bash
cd ../<repo>-compat-<slug>-new
git fetch <path-o-remote-del-branch-sotto-test> <branch-sotto-test>:refs/tmp-sync --force
git reset --hard refs/tmp-sync
git update-ref -d refs/tmp-sync
```

`supabase/config.toml` nel worktree "old": `project_id = "<progetto>-compat-<slug>"`, blocco
porte dedicato (offset sul default, verifica libero prima con `docker ps`/`lsof`). `.env`
(root) + `supabase/functions/.env` in ENTRAMBI i worktree: **il worktree "new" di solito non
li ha** (non lancia mai `supabase start`) — copiali dal worktree "old" con `cp`, **mai
`cat`/stampare il contenuto** (sono chiavi locali standard, non davvero segrete, ma il
classificatore le tratta come credenziali — copia il file, non stamparlo).

**Dev server**: porte distinte per i due worktree. `supabase/functions/.env`'s
`APP_ALLOWED_ORIGINS` (nel worktree "old", quello mountato nel container edge) deve elencare
**entrambe** le origin — `http://localhost:<portOld>,http://localhost:<portNew>` — poi
`supabase stop && supabase start` per far ripartire l'edge runtime con l'env aggiornato
(iniettato alla creazione del container, non hot-reload).

**Gotcha reale: `config.toml` copiato da "old" perde i blocchi di edge-function-config
specifici del branch sotto test.** Il branch "new" può aver aggiunto una nuova edge function
con `verify_jwt = false` (es. un endpoint pubblico senza sessione) — se il `config.toml`
isolato è una copia di quello di "old" con solo project_id/porte cambiati, quel blocco manca
e Kong applica il default `verify_jwt = true`, rifiutando con **401** ogni chiamata pubblica
pensata per funzionare senza bearer token. Sintomo: un test E2E che prima passava fallisce
con un 401 generico ATTRIBUIBILE al setup, non al branch — prima di concludere che è un bug
reale, `diff <(git show <baseline-ref>:supabase/config.toml) <(git show
<branch-sotto-test>:supabase/config.toml)`: se l'unica differenza oltre a `project_id` è un
blocco `[functions.*]` mancante, è il tuo `config.toml` isolato che va corretto (aggiungi il
blocco mancante in ENTRAMBI i worktree), non il codice del branch.

## Fase 1 — Verifica compatibilità migration (prima di toccare la DB)

```bash
comm -23 \
  <(git ls-tree -r <baseline-ref> --name-only -- supabase/migrations | sort) \
  <(git ls-tree -r <branch-sotto-test> --name-only -- supabase/migrations | sort)
```

**Output vuoto = sicuro**: ogni migration già applicata sull'ambiente live è ancora
presente, invariata, sul branch — solo aggiunte, nessuna riscrittura storica. Un output NON
vuoto è un blocker — fermati e riporta all'utente quali migration sono sparite/rinominate
prima di procedere oltre: mai rinominare una migration già deployata su un ambiente
condiviso.

## Fase 2 — Stack pulito da zero, seed con codice "old"

```bash
cd ../<repo>-compat-<slug>-old
npx supabase stop
docker volume rm supabase_db_<progetto>-compat-<slug> supabase_edge_runtime_<progetto>-compat-<slug> supabase_storage_<progetto>-compat-<slug>
npx supabase start   # riparte da <baseline-ref>, SOLO le sue migration
```

Avvia il dev server del worktree "old" (`npm run dev -- --port <portOld> --strictPort`,
verifica leggendo il log, non con un bare `curl` — stesso gotcha di `start-isolated-worktree`).

**Seed dati forma-produzione**: riusa uno spec E2E esistente e già ricco (uno che seeda un
dataset realistico completo per una persona demo) **eseguito dal worktree "old"**, puntato
allo stack isolato:

```bash
E2E_BASE_URL=http://localhost:<portOld> \
E2E_SUPABASE_URL=http://127.0.0.1:<apiPort> \
E2E_SERVICE_KEY=<Secret key da supabase start> \
E2E_PUBLISHABLE_KEY=<Publishable key da supabase start> \
CI=true \
npx playwright test --config <path-al-tuo-playwright-config> <spec-di-seed>.spec.ts
```

Se lo spec ha un test finale che AZZERA i dati (es. un test "skip/reset" a fine file —
comune nei flussi di onboarding), non lasciarlo come ultimo: rilancia con `--grep "<nome del
test più ricco>"` per lasciare quel dataset come stato finale persistente. `--grep` è
normalmente sconsigliato per un giro E2E normale (costo di un global setup a freddo su molti
utenti) — qui è già stato pagato una volta (stack isolato, sessioni già calde), quindi è
sicuro.

**Ordine non invertibile, verificato empiricamente**: seed SEMPRE PRIMA di migrare al branch
nuovo, mai dopo. Ri-seedare con codice "old" DOPO aver già applicato le migration del branch
"new" può rompersi (causa non investigata oltre, trattala come un vincolo procedurale, non
un bug da inseguire: se serve un secondo seed, wipe + restart da zero, mai un seed a metà
strada).

**Screenshot "before"**: con l'app "old" ancora viva sopra i dati appena seedati, cattura le
pagine principali autenticate per confrontarle più avanti con lo stato "after" (Fase 4).
**Non riscrivere lo script a mano** — è già un file git-tracked in
`skills/compat-gate/assets/_compat-screenshot.spec.ts`, adatta `PAGES`/`DEMO_EMAIL` alle
rotte e all'utente demo del tuo progetto (vedi il template), poi copialo così com'è nel
worktree "old" (resta throwaway LÌ — mai committato nel worktree, rimosso a fine gate, vedi
"Cleanup"; solo la fonte in `assets/` è permanente):

```bash
cp skills/compat-gate/assets/_compat-screenshot.spec.ts \
  ../<repo>-compat-<slug>-old/tests/e2e/_compat-screenshot.spec.ts
```

Il template fa login reale con l'utente demo standard del tuo progetto — adatta l'helper di
login usato al pattern reale del tuo E2E setup se differisce da quello nel template.

Se serve loggare pagine diverse da quelle di esempio, edita **la fonte in `assets/`** e
ricommitta — non la copia throwaway.

```bash
mkdir -p _local/tests/compat-gate/<slug>/before
COMPAT_SCREENSHOT_DIR="$(pwd)/_local/tests/compat-gate/<slug>/before" \
E2E_BASE_URL=http://localhost:<portOld> \
E2E_SUPABASE_URL=http://127.0.0.1:<apiPort> \
E2E_SERVICE_KEY=<...> E2E_PUBLISHABLE_KEY=<...> CI=true \
npx playwright test --config <path-al-tuo-playwright-config> _compat-screenshot.spec.ts
```

## Fase 3 — Applica le migration del branch sotto test

```bash
cd ../<repo>-compat-<slug>-new
npx supabase migration up --db-url "postgresql://postgres:postgres@127.0.0.1:<dbPort>/postgres?sslmode=disable"
```

**Gotcha reale**: senza `?sslmode=disable` il CLI fallisce con `LegacyDbConnectError: Failed
to connect` anche per un DB locale raggiungibile (verificato: `psql`/`nc` diretti
funzionano, è uno specifico comportamento del comando `migration up --db-url`) — aggiungi
sempre il parametro, non perdere tempo a diagnosticare la connessione TCP.

Verifica il conteggio totale:

```bash
psql -h 127.0.0.1 -p <dbPort> -U postgres -d postgres -c \
  "SELECT count(*) FROM supabase_migrations.schema_migrations;"
```

## Fase 4 — L'app funziona con la versione finale sopra dati migrati

**Passo obbligatorio, prima di qualunque test — far ripartire l'edge runtime sul codice
"new".** L'edge runtime bind-monta i file dal worktree da cui è partito `supabase start` —
sempre "old" fino a qui (Fase 2). Applicare le migration (Fase 3) NON cambia questo: il
container continua a servire funzioni/DAO/servizi del worktree "old", che possono
referenziare colonne già droppate dalle nuove migration → errori reali ma **falsi
positivi**, attribuibili al branch quando la causa è solo il bind-mount stale (es. un errore
"colonna non esiste" su una query che nel worktree "new" non seleziona affatto quella
colonna — il codice IN ESECUZIONE era ancora quello vecchio). Fix, prima di procedere:

```bash
cp ../<repo>-compat-<slug>-old/supabase/config.toml \
  ../<repo>-compat-<slug>-new/supabase/config.toml   # stesso project_id/porte — vedi gotcha Fase 0 sopra
cd ../<repo>-compat-<slug>-new
npx supabase stop     # preserva il volume DB (stesso project_id) — non è un reset
npx supabase start    # ricrea edge-runtime bind-montato su QUESTO worktree
```

Verifica che sia servito il codice giusto prima di proseguire:

```bash
docker inspect supabase_edge_runtime_<progetto>-compat-<slug> \
  --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep -c "compat-<slug>-new"
# >0 = ok. Se il container non esiste o è ancora sull'old, l'edge-runtime
# non si "aggiorna" da solo con un semplice restart selettivo — serve lo
# stop/start dell'INTERO stack dalla directory "new" come sopra.
```

Avvia il dev server del worktree "new" (`npm run dev -- --port <portNew> --strictPort`).
Esegui un giro E2E generico e leggero (non serve l'intera suite — un file rappresentativo)
puntato al worktree "new":

```bash
E2E_BASE_URL=http://localhost:<portNew> \
E2E_SUPABASE_URL=http://127.0.0.1:<apiPort> \
E2E_SERVICE_KEY=<...> E2E_PUBLISHABLE_KEY=<...> CI=true \
npx playwright test --config <path-al-tuo-playwright-config> <spec-generico>.spec.ts
```

Verde qui = "le migration non falliscono E l'app renderizza/funziona normalmente sopra dati
migrati", non solo il primo.

**Screenshot "after"**: stesso template della Fase 2
(`skills/compat-gate/assets/_compat-screenshot.spec.ts`), copialo ora nel worktree "new"
(stessa DB condivisa, stesso utente demo seedato), stesse pagine, output in `after/`:

```bash
cp skills/compat-gate/assets/_compat-screenshot.spec.ts \
  ../<repo>-compat-<slug>-new/tests/e2e/_compat-screenshot.spec.ts
mkdir -p _local/tests/compat-gate/<slug>/after
COMPAT_SCREENSHOT_DIR="$(pwd)/_local/tests/compat-gate/<slug>/after" \
E2E_BASE_URL=http://localhost:<portNew> \
E2E_SUPABASE_URL=http://127.0.0.1:<apiPort> \
E2E_SERVICE_KEY=<...> E2E_PUBLISHABLE_KEY=<...> CI=true \
npx playwright test --config <path-al-tuo-playwright-config> _compat-screenshot.spec.ts
```

Confronta ogni coppia `before/<pagina>.png` vs `after/<pagina>.png` (`Read` supporta le
immagini — leggi entrambe e confrontale visivamente, non serve un diff-pixel: differenze
attese come timestamp/animazioni/ordine di rete darebbero falsi positivi a un confronto
pixel-perfect). Annota per ogni pagina: identiche, oppure cosa è cambiato — layout rotto,
dato mancante, errore visibile, o una differenza attesa e innocua (es. un timestamp).
Riporta l'esito in Fase 6, non qui — questo è solo lo scatto.

**Gotcha reale: un grafico (recharts/canvas) bianco/non renderizzato nello screenshot
"after" non è necessariamente un bug.** Il template fa solo `waitForLoadState("networkidle")`,
che non garantisce che un container di grafico responsive abbia già misurato il proprio
contenitore. Prima di riportarlo come regressione: cerca uno spec E2E esistente che asserisca
sul grafico con un selettore reale e rilancialo puntato al worktree "new". Se passa, il blank
è un artefatto del template (timing dello screenshot), non del branch — annotalo come tale
in Fase 6 invece di bloccare il gate.

## Fase 5 — Verifica specifica del rischio (task-dependent, scrivi ad-hoc)

Questa è la parte NON generalizzabile — dipende da cosa introduce il branch. Scrivi un test
E2E **throwaway** (mai committato — vive solo nel worktree "new", rimosso a fine gate) che
esercita per davvero il percorso a rischio, via UI reale dove possibile (non uno script Node
che chiama le funzioni direttamente — quello prova solo il motore, non l'integrazione UI↔DB
come la userà davvero un utente). Esempio: per una rotazione di chiave di cifratura, un
click reale sul bottone che avvia il flusso, verifica via query DB dirette (spesso senza
bisogno di decrypt — se il tuo formato ha metadati in chiaro tipo un tag di
versione/epoca nell'envelope, usali per una verifica ampia a basso costo invece di decifrare
ogni riga).

**Se il test include un'operazione distruttiva/irreversibile** (un DELETE reale, un ritiro
di chiavi, ecc.) e la feature ha una regola "richiede firma umana prima del primo uso su
dati reali": qui è sicuro eseguirla per davvero — lo stack è isolato e usa-e-getta, non dati
di produzione. La firma umana si applica SOLO al primo uso contro un ambiente REALE, non a
questo gate. Se non sei sicuro se questa distinzione si applica al tuo caso, chiedi prima di
eseguire l'operazione irreversibile.

**Navigazione post-azione in un test che gestisce lo sblocco a mano** (non tramite l'helper
standard del progetto): usa click su link (routing client-side), mai `page.goto()` — un hard
reload perde qualunque sessione sbloccata programmaticamente che non sia coperta da un
`addInitScript` di ripristino.

Rimuovi il file throwaway subito dopo l'uso (`rm`), verifica `git status` pulito nel
worktree "new" prima di considerare il gate chiuso. Stessa regola per
`_compat-screenshot.spec.ts` in ENTRAMBI i worktree — throwaway, mai committato.

Verifica anche che la suite intera di E2E si esegua sul nuovo codice, partendo dalla base
aggiornata e migrata attraverso staging.

## Fase 6 — Report e decisione

Riporta all'utente, per ognuna delle fasi 1-5: passato/fallito + causa se fallito. **Non
proporre un fix "per far passare il test" se il fallimento è nel test stesso** (come il
gotcha `page.goto()` sopra) — distingui sempre un bug del test throwaway da un bug reale
trovato dal test (entrambi possono succedere, tienili separati nel report).

Includi anche l'esito del confronto screenshot before/after (una riga per pagina: identica /
differenza attesa e innocua / differenza da investigare) — una differenza inattesa in una
pagina che non c'entra col rischio testato in Fase 5 è spesso il primo segnale di una
regressione non prevista.

Se tutto passa: il gate è chiuso. Aggiorna il piano/ADR pertinente se ne tieni uno, con
l'esito.

## Cleanup — MAI silenzioso

Stessa regola di `start-isolated-worktree`: non smontare stack/worktree senza una richiesta
esplicita dell'utente o una tua proposta esplicita che l'utente approva. Se l'utente dice di
tenere l'ambiente attivo per riusarlo (es. per un prossimo gate sullo stesso pattern),
lascialo com'è — questo pattern è pensato per essere riacceso più volte nella stessa
iniziativa di lavoro, non ricreato da zero ad ogni verifica.

```bash
# Lo stack potrebbe essere stato riavviato dal worktree "new" in Fase 4
# (per farlo bind-montare il codice nuovo) — ferma da lì se è quello attivo,
# non serve farlo da entrambi (stesso project_id/container).
cd ../<repo>-compat-<slug>-new && npx supabase stop
cd <maintree>
git worktree remove ../<repo>-compat-<slug>-old --force
git worktree remove ../<repo>-compat-<slug>-new --force
git branch -D compat/<slug>-under-test
```

**Lezione nota**: fermare lo stack PRIMA di qualunque `git restore`/checkout su un worktree
con `config.toml` modificato — mai affidarsi a `supabase stop` dopo un restore silenzioso del
config (il container potrebbe non fermarsi per nome).

## Da non fare mai

- Non riscrivere a mano lo script di screenshot before/after — copia
  `skills/compat-gate/assets/_compat-screenshot.spec.ts` (Fase 2/4), ed editane la fonte lì
  se serve una variante.
- Non copiare `config.toml` da "old" a "new" senza controllare che i blocchi `[functions.*]`
  del branch sotto test siano tutti presenti (Fase 0/4) — una function nuova senza il suo
  `verify_jwt=false` copiato fallisce con 401, un falso positivo attribuibile per errore al
  branch.
- Non fidarsi che applicare le migration (Fase 3) basti per Fase 4 — l'edge runtime resta
  bind-montato sul worktree da cui è partito l'ultimo `supabase start` finché non lo fai
  ripartire da "new" (Fase 4, primo passo) — altrimenti stai testando codice vecchio su
  schema nuovo e gli errori che ne escono sono falsi positivi, non regressioni del branch.
- Non seedare con codice "old" DOPO aver applicato le migration del branch "new" (vedi Fase
  2) — wipe e riparti da zero se serve un secondo seed.
- Non riusare un worktree "new" senza prima aggiornarlo alla tip corrente del branch — un
  gate contro un commit stale non prova nulla sul branch reale che verrà mergiato.
- Non decidere da solo se una distinzione "sicuro qui, richiede firma altrove" si applica al
  tuo caso — se il piano/ADR della feature non lo dice esplicitamente, chiedi prima di
  eseguire l'irreversibile.
- Non fare teardown senza chiedere — questo pattern è costoso da rimontare, vale la pena
  lasciarlo acceso tra un gate e il successivo nella stessa iniziativa.
