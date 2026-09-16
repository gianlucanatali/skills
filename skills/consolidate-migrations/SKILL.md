---
name: consolidate-migrations
description: Use before opening a PR when the branch has accumulated many small/fixup migration files not yet merged into the shared branch (e.g. "create table" → "fix column" → "fix again" on the same object). Consolidates a fixup cluster into one clean migration, preserving load-bearing rationale comments, then realigns the LOCAL Supabase migration history — never touches the shared/remote project.
---

# Consolidare le migration prima di una PR

Pensata per progetti Supabase (CLI + file di migration SQL numerati), ma il criterio di
consolidamento (stato finale, non concatenazione) si applica a qualunque tool di migration
sequenziale a file (Flyway, Rails, Django, ecc.) con adattamenti minimi ai comandi CLI.

## Input

- **Branch di lavoro**: quello attualmente checkout — non assumerlo implicitamente da `HEAD`,
  verificalo esplicitamente come primo comando (`git branch --show-current`). Se questa skill
  gira da un subagent/worktree, conferma che il `cwd` sia davvero il branch/worktree che
  l'utente intende consolidare prima di procedere.
- **Riferimento**: il branch condiviso del tuo progetto che rappresenta l'ultimo ambiente
  realmente deployato con migration (es. `staging`, `develop`, `main` — sostituiscilo sotto).
  Non usare l'ultimo tag di release come riferimento, e non consolidare contro un branch
  diverso da quello che riceve davvero i push di migration nel tuo flusso.

```bash
BRANCH=$(git branch --show-current)
SHARED_BRANCH=staging   # sostituisci con il branch condiviso reale del tuo progetto
```

Ogni comando successivo di questa skill usa `$BRANCH`/`$SHARED_BRANCH` — renderli espliciti
evita di consolidare per sbaglio l'intervallo di un altro branch se il `cwd` non è quello
atteso.

## Due modalità

- **Cluster di fixup** (default, sezioni sotto): consolida solo i gruppi di migration che
  ri-toccano lo stesso oggetto in sequenza ravvicinata — il resto del branch resta
  file-per-file.
- **Consolidamento totale del branch** (quando l'utente lo chiede esplicitamente, es.
  "consolida tutto in un solo file"): l'intero `git diff $SHARED_BRANCH...$BRANCH --
  supabase/migrations/` diventa UN SOLO cluster, indipendentemente da quanti oggetti
  distinti tocca. Si applica **lo stesso identico criterio** del passo 2 sotto (stato finale
  esatto, create+drop nell'intervallo sparisce del tutto, commenti di motivazione
  preservati) — semplicemente il perimetro del cluster è "tutto il diff", non un
  sottoinsieme. Il passo 3 (dispatch subagent) passa l'intera lista ordinata
  cronologicamente invece di un sottogruppo. Tutto il resto della procedura (revisione
  umana, riallineo bookkeeping locale, verifica schema-diff) resta identico.

## Quando ha senso (e quando no)

Ha senso **solo** per migration che il branch corrente ha aggiunto rispetto a
`$SHARED_BRANCH` e che **non sono mai state pushate** verso il progetto Supabase condiviso.
Se il tuo flusso permette push manuali da branch di lavoro (non solo via CI sul branch
condiviso), **fermati e chiedi prima** — squashare file già visti da un progetto condiviso
disallinea la bookkeeping remota (`supabase_migrations.schema_migrations`), e correggerla
richiede `supabase migration repair` sul progetto collegato: un comando da trattare come
**azione solo umana**, mai automatizzata da un agente senza conferma esplicita. Vale anche:
mai rinominare/toccare un file di migration già mergiato nel branch condiviso o su un altro
branch di lavoro attivo — questa skill opera **solo** sull'intervallo
`git diff $SHARED_BRANCH...$BRANCH -- supabase/migrations/`.

**Non è uno squash cieco di "tutto il branch in un file".** Molti progetti hanno migration
con commenti che portano motivazioni non ovvie (race condition trovate con test manuali,
finding di security review, riferimenti a un piano/issue). Concatenare/cancellare quel testo
alla cieca butta via esattamente il tipo di "perché" che vale la pena preservare. Consolida
**solo cluster di fixup evidenti** — più migration che ri-creano/alterano lo stesso oggetto
in sequenza ravvicinata — non l'intero branch.

## 1. Perimetro: solo il diff verso il branch condiviso

```bash
git diff $SHARED_BRANCH...$BRANCH --name-status -- supabase/migrations/
```

## 2. Il criterio: non "meno file", ma "zero comandi ridondanti"

Lo scopo non è avere meno file per estetica — è che nessun oggetto venga creato/alterato
più volte nella storia che finisce nel branch condiviso. Se una tabella viene creata, poi una
migration successiva le aggiunge un vincolo, poi un'altra lo corregge, la versione
consolidata **crea la tabella già con il vincolo giusto la prima volta** — i passaggi
intermedi (il vincolo sbagliato, la sua correzione) non devono sopravvivere come comandi
separati, solo lo stato finale.

Il segnale non è la data o il nome del file, è **quanti file distinti nell'intervallo
toccano lo stesso oggetto**:

```bash
for f in $(git diff $SHARED_BRANCH...$BRANCH --name-only -- supabase/migrations/); do
  grep -ohE '(FUNCTION|TABLE) "?public"?\."?[a-zA-Z_]+"?' "$f" | sed -E 's/"//g' | sort -u | sed "s|^|$f\t|"
done | awk -F'\t' '{print $2}' | sort | uniq -c | sort -rn
```

Oggetti con conteggio `1` restano soli (nessuna churn da eliminare, anche se la migration
resta di per sé un buon candidato a essere lasciata così com'è). Oggetti con conteggio `>1`
sono un cluster candidato — esempio illustrativo: una tabella `widgets` che compare in 3
file distinti (creazione → fix colonna → fix colonna di nuovo) è un cluster; una migration
indipendente che crea una tabella mai più toccata non lo è.

**Caso limite — create+drop dello stesso oggetto interamente dentro l'intervallo:** se sia
il `CREATE` sia il `DROP` di un oggetto ricadono in `git diff $SHARED_BRANCH...$BRANCH`,
l'oggetto **non deve comparire per niente** nella migration consolidata — non un `CREATE`
seguito da un `DROP`, proprio nessuna traccia, come se non fosse mai stato scritto.
**Attenzione al confine**: un `DROP` di un oggetto il cui `CREATE` è **già** nel branch
condiviso resta invece una migration vera e permanente — è un contratto reale (rimuove una
feature deployata), non un'annullabile che si può far sparire: verifica sempre se il
`CREATE` corrispondente è anch'esso dentro l'intervallo prima di decidere che una coppia
create/drop si annulla.

## 3. Dispatch di un subagent per riscrivere il cluster (mai meccanico)

Capire "qual è lo stato finale" e "quale commento di motivazione è ancora rilevante" richiede
giudizio, non un diff di testo — usa un modello capace di giudizio per questo dispatch (non
un modello economico a basso costo: non è un task meccanico a spec fissa). Il prompt deve:

- passare i path esatti dei file del cluster (nell'ordine cronologico) e il loro contenuto
- chiedere di produrre **una singola migration** che riproduce lo **stato finale esatto**
  (non una concatenazione — se una tabella viene creata e poi una colonna droppata nello
  stesso cluster, la migration consolidata crea la tabella già senza quella colonna)
- chiedere di **preservare** in un commento in testa ogni motivazione non ovvia trovata nei
  file originali (bug trovato, race condition, finding di security review) — non un
  changelog passo-passo, ma il "perché" che servirebbe a chi legge il file fra un anno
- se il tuo progetto richiede un `COMMENT ON` per ogni `CREATE TABLE`/`ADD COLUMN`, o ha uno
  script di safety-check sulle migration, far girare quello script sul file consolidato —
  **non basta "ricordarlo"**, eseguilo davvero. Se lo script usa regex per riconoscere
  `ADD COLUMN`, verifica che non abbia falsi positivi su pattern SQL simili (es.
  `ALTER TABLE ... ADD CONSTRAINT <nome>` letto come se `CONSTRAINT` fosse il nome di una
  colonna) prima di fidarti ciecamente di un check verde
- **non toccare la documentazione delle decisioni architetturali** (ADR o equivalente): se
  il tuo progetto le tiene granulari e permanenti, restano fuori scope anche se la migration
  sottostante viene consolidata

## 4. Revisione umana obbligatoria

Mostra il file generato e il diff (file eliminati + file nuovo) e **fermati per conferma
esplicita** prima di procedere — mai cancellare gli originali senza che l'utente abbia visto
il risultato. Se qualcosa nel cluster non è ovviamente superato dall'ultima versione (es. un
GRANT che una migration successiva ha revocato e nessuna ha più ri-concesso), segnalalo
esplicitamente invece di assumere.

## 5. Applica: cancella gli originali, aggiungi il consolidato

```bash
git rm supabase/migrations/<vecchio-file-1>.sql supabase/migrations/<vecchio-file-2>.sql ...
# nuovo file già scritto al passo 3, con un nuovo timestamp coerente con l'ordine esistente
```

## 6. Riallinea SOLO la bookkeeping locale — `migration repair --local`, mai altre forme

`supabase db reset` va evitato come flusso automatico da agente (rischio di distruggere dati
locali senza che l'utente lo chieda esplicitamente). `supabase migration repair` va lanciato
**solo** nella forma esplicita con `--local` in coda — qualunque altra forma (senza
`--local`, o con `--linked`) tocca il progetto Supabase remoto/collegato e va evitata:

```bash
supabase migration repair --status reverted <vecchia-versione-1> <vecchia-versione-2> --local
```

Poi verifica che `supabase migration list --local` mostri il nuovo file come applicato e
nessun residuo dei vecchi:

```bash
supabase migration list --local
```

## 7. Verifica

```bash
npm test && npm run build   # adatta ai comandi reali del tuo progetto
```

Se il tuo progetto ha un check dedicato per le migration (safety/lint), lanciarlo qui a
parte se non è incluso nella suite generale.

**Prova che lo schema finale è identico, non solo "i test passano".** Lo stack locale attuale
non viene mai ricostruito dal file consolidato — il passo 6 corregge solo la sua bookkeeping,
non rigioca le migration — quindi da solo non dimostra che il nuovo file, eseguito **da
zero**, produca lo stesso schema. Serve una seconda istanza usa-e-getta, completamente
scaffoldata (auth/cron/net/ruoli — un Postgres nudo non li ha). **Non `supabase init` da
zero** (scaffold diverso dal progetto reale, rischia default disallineati) — copia il
`config.toml` vero e cambia solo `project_id` + porte:

```bash
# pg_dump vuole la connection URI intera — con -h/-p/-U separati chiede una password
# interattiva e si blocca (stessa cosa vale per psql, ma lì è meno comune sbagliarla)
pg_dump --schema-only "postgresql://postgres:postgres@127.0.0.1:54322/postgres" > /tmp/schema-before.sql

# copia isolata usa-e-getta: NON un git worktree, solo una cartella temporanea da cancellare a fine test
mkdir -p /tmp/migtest
cp -r supabase /tmp/migtest/supabase
rm -f /tmp/migtest/supabase/migrations/*.sql
cp <nuovo-file-consolidato>.sql /tmp/migtest/supabase/migrations/   # + tutte le migration invariate del range

# project_id va SOSTITUITO (riga 1, esiste già), [api]/[db] vanno AGGIUNTI se non esistono
# ancora — mai fare un `cat >> ` cieco se [studio]/[analytics]/[inbucket] esistono già in
# supabase/config.toml: appenderli duplica la tabella TOML e rompe il parsing
sed -i '' 's/^project_id = .*/project_id = "migtest"/' /tmp/migtest/supabase/config.toml
cat >> /tmp/migtest/supabase/config.toml <<'EOF'

[api]
port = 55321

[db]
port = 55322
shadow_port = 55320
EOF

# --exclude: per un confronto di solo schema serve solo il DB. NON escludere anche `kong` —
# è il gateway su cui `supabase start` fa il proprio health-check di avvio, escluderlo fa
# fallire lo start con "connection refused" anche se il DB si è avviato bene.
(cd /tmp/migtest && supabase start --exclude analytics,edge-runtime,functions,imgproxy,inbucket,realtime,storage,studio,vector)

pg_dump --schema-only "postgresql://postgres:postgres@127.0.0.1:55322/postgres" > /tmp/schema-after.sql
diff /tmp/schema-before.sql /tmp/schema-after.sql   # vuoto (a parte \restrict/\unrestrict) = schema identico

(cd /tmp/migtest && supabase stop --no-backup)   # smaltisce container + volume
rm -rf /tmp/migtest                              # nessun git checkout da fare: mai stato un file tracciato
```

Le righe `\restrict <token>`/`\unrestrict <token>` nel diff sono rumore atteso — `pg_dump`
genera un token di sessione casuale a ogni dump, non è schema. Qualunque altra riga diversa è
un vero disallineamento da controllare — se il `diff` mostra righe inattese anche senza aver
consolidato nulla, sospetta un drift locale: `migration up --local` traccia le versioni
applicate per **nome file**, non per contenuto — modificare in-place una migration già
applicata localmente non la ri-esegue.

Un `diff` pulito (a parte i due token `\restrict`) è la prova che tabelle, colonne, vincoli e
`GRANT`/`REVOKE` sono tutti identici — non solo che i test applicativi passano. Nessun
comando "solo umano" coinvolto (`start --exclude`/`stop`/`migration up` locali sono normali
operazioni locali); lo stack usa-e-getta gira su porte diverse da quello reale e non lo
tocca mai, né tocca il progetto remoto.

Se il cluster consolidato tocca RLS/ownership/funzioni `SECURITY DEFINER`, verifica anche i
grant risultanti:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name = '<nome_funzione>';
"
```

## Da non fare mai

- Mai consolidare migration già mergiate nel branch condiviso, o applicate (anche una volta
  sola) al progetto Supabase condiviso — solo l'intervallo `git diff $SHARED_BRANCH...$BRANCH`.
- Mai `supabase db reset` in automatico da agente. `supabase migration repair` va lanciato
  solo nella forma esplicita con `--local` in coda; qualunque altra forma tocca il progetto
  remoto e va evitata.
- Mai squashare l'intero branch in un file unico "perché è più pulito" — solo cluster di
  fixup evidenti sullo stesso oggetto.
- Mai cancellare un commento che spiega un bug/race/finding di security trovato durante lo
  sviluppo — va preservato nel commento consolidato, non buttato per fare spazio.
- Mai toccare la documentazione delle decisioni architetturali in questo passo, se il tuo
  progetto ne tiene una separata — resta fuori scope.
- Mai cancellare i file originali senza aver mostrato il consolidato all'utente e ricevuto
  conferma esplicita.
