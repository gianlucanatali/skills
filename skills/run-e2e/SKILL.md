---
name: run-e2e
description: Use to run the Playwright E2E suite (full or a single spec) in the background and save timestamped output to a log directory, then report pass/fail counts with failure causes from error-context.md. Covers stale-session recovery after a DB reset and why not to use --grep alone.
---

# Esegui la suite E2E e riporta il risultato

Esegui i test E2E (intera suite o il file spec passato come argomento) e salva l'output in
una cartella di log (es. `_local/tests/e2e/`) con un nome che include il timestamp, così i
risultati precedenti restano accessibili.

**Spec opzionale:** $ARGUMENTS (es. `tests/e2e/deploy/import-storico.spec.ts`)

---

## Dispatch

Task meccanico (comando npm, tail log, grep `error-context.md`, report pass/fail — nessun
giudizio architetturale): esegui questo skill dispatchando un `Agent` con `model: "haiku"`
(subagent generico) invece di lanciare i comandi inline nella sessione principale. Passa a
quell'agente il contenuto di questo file come istruzioni.

---

## Obiettivo

1. Assicurati che la cartella di log esista.
2. Genera un timestamp nel formato `YYYYMMDD-HHMMSS` (ora locale).
3. Salva stdout+stderr in `<log-dir>/<timestamp>.txt`.
4. Esegui in background se la suite è completa (può durare diversi minuti).

Il comando npm da usare (adatta ai nomi reali degli script del tuo progetto — questi sono
solo esempi):

- Intera suite: `npm run test:e2e`
- Solo un bucket veloce/gate: `npm run test:e2e:deploy` (se il tuo progetto ne ha uno)
- Solo un bucket lento/regression: `npm run test:e2e:regression` (idem)
- Solo un file spec: `npm run test:e2e -- $ARGUMENTS`

Usa il metodo più adatto all'ambiente corrente per redirigere l'output su file e ottenere il
timestamp (shell built-in, `date`, PowerShell, ecc.).

---

## Al termine

1. Leggi le ultime 25 righe del file di log appena creato per il sommario.
2. Se ci sono test falliti, elenca le directory in `test-results/` e leggi
   `error-context.md` dentro ciascuna per capire il fallimento.
3. Riporta all'utente: N passati, M falliti, lista dei falliti con causa.
4. Per confrontare con un run precedente, leggi il file con il timestamp precedente nella
   cartella di log.

---

## Regola sessioni stantie

Se dopo un reset del DB molti test falliscono con dati/sezioni vuote, le sessioni salvate
(storage state) sono stantie (l'ID utente sottostante è cambiato).

**Fix:** i test isolati devono usare un login esplicito con l'email specifica dello spec
invece di riutilizzare la sessione salvata (adatta ai nomi dei tuoi helper — es. `loginAs(page,
specEmail)` invece di `login(page)`). Dopo un reset, esegui la suite completa una volta per
rigenerare tutte le sessioni.

---

## Non usare `--grep`

`--grep` avvia il global setup per tutti gli utenti isolati (possono essere molti login
paralleli) anche per un singolo test. Con rete lenta, i login vanno in timeout. Usa il
percorso del file spec: `npm run test:e2e -- tests/e2e/<bucket>/nome.spec.ts`.
