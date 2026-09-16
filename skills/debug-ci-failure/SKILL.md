---
name: debug-ci-failure
description: Use when a GitHub Actions CI check fails on a PR (E2E, build, migration safety, etc.) — especially when it passes locally, looks intermittent, or you're tempted to call it "flaky". Covers pulling the real run artifacts (screenshots, traces, server/edge logs), verifying which commit actually ran, and distinguishing a CI-infrastructure cause (edge runtime isolate kills, wall-clock limits, cold/slow CI) from an application-code bug.
---

# Debug a CI failure on a PR

## Il principio

**Mai concludere "flaky", "CI è lenta", o "probabilmente si è risolto da solo" senza una
prova concreta.** Un fallimento CI è quasi sempre spiegabile — o è un bug di codice reale
(allora va riprodotto/testato), o è una causa infrastrutturale reale e verificabile (allora
la soluzione è retry/backoff nel punto giusto, non ignorarla — vedi il caso illustrativo
sotto). "Ci ho provato in locale e passava" non è una diagnosi, è solo un dato — la causa
vera si trova negli artifact della run che è effettivamente fallita.

## 1. Identifica la run e verifica che sia quella giusta

```bash
gh pr checks <PR> --repo <owner>/<repo>
gh run view <run-id> --repo <owner>/<repo> --json status,conclusion,headSha
```

Se il check è ancora `in_progress`, **aspetta che finisca** prima di trarre conclusioni da
un log parziale — usa un loop di polling in background (Bash `run_in_background` con un
`until` che esce quando lo status cambia), non dedurre da un output a metà.

**Verifica sempre quale commit ha girato davvero**, prima di assumere che una run rifletta
(o non rifletta) un tuo fix:

```bash
gh pr view <PR> --repo <owner>/<repo> --json headRefOid
```

Confronta con lo SHA del commit che pensi sia stato testato. Una run che sembra "ignorare"
un fix appena pushato è quasi sempre stata lanciata PRIMA del push, non un segno che il fix
non funziona — verificalo, non presumerlo.

## 2. Scarica gli artifact reali

```bash
gh run download <run-id> --repo <owner>/<repo>
```

Non fidarti solo del log incollato/troncato in chat — scarica e apri:

- **Screenshot del fallimento** (`playwright-report/data/*.png` per Playwright) — mostra lo
  stato REALE della UI al momento del timeout, spesso più eloquente di qualunque log (in un
  caso reale, lo screenshot ha rivelato un valore numerico "congelato" identico al log
  originale — la prova che il ricalcolo non convergeva mai, non che fosse solo lento).
- **Log del server/edge function**, se il workflow li carica come artifact (es. log delle
  funzioni serverless/edge, log del backend applicativo — il nome e il path dipendono dal
  tuo workflow CI). Qui vivono segnali che il codice applicativo non può vedere.
- Trace Playwright (`*.zip`, apribile con `npx playwright show-trace`) per il timeline
  completo di rete/console/DOM.

## 3. Cerca segnali infrastrutturali nei log server-side, PRIMA di sospettare il codice

Grep mirato per pattern che indicano un problema dell'ambiente CI, non della logica
applicativa:

```bash
grep -n "early termination\|wall clock duration warning\|memory limit\|isolate.*terminat\|ECONNRESET\|timeout\|OOM\|Killed" <log-scaricato>
```

Un "early termination"/"wall clock duration warning" (un runtime edge/serverless che
uccide un'istanza per superamento limite) è una prova diretta che una richiesta di rete
critica può essere stata interrotta a metà — su una VM CI più lenta/più contesa di una
macchina locale questo può succedere ripetutamente durante un'intera run senza mai comparire
in locale. Se il framework applicativo logga-e-abbandona un fallimento di background (nessun
retry automatico), questo produce un sintomo "bloccato per sempre" indistinguibile a prima
vista da un bug di race condition nel codice — controlla qui PRIMA di passare ore a scrivere
test su ipotesi di logica.

**Correla i timestamp** tra il log delle richieste client (mutation log, network tab, trace
Playwright) e il log server — un evento infrastrutturale che cade esattamente nella finestra
critica del test è una prova forte, non una coincidenza da ignorare.

**Caso illustrativo:** un test E2E fallisce in modo deterministico solo su CI, mai in
locale. Lo screenshot del fallimento mostra un valore numerico congelato identico al log
originale — non un placeholder, un compute reale mai aggiornato. Il log del backend mostra
un "early termination"/kill dell'istanza esattamente nella finestra critica del test (tra la
scrittura che innesca un ricalcolo e il ricalcolo atteso), ripetuto più volte in tutta la
run — un pattern ricorrente dell'ambiente, non un evento isolato. Causa reale: un modulo che
logga-e-abbandona un ricalcolo in background fallito, senza retry — un fallimento di rete
transiente (l'istanza uccisa) fa ripiombare il sistema sul solo trigger di fallback rimasto
(es. un TTL di qualche minuto). Fix: retry con backoff limitato sul ricalcolo in background —
applicabile anche in produzione, dove la stessa classe di fallimento transiente può succedere
per altre cause (provider esterno lento, un picco di carico), non solo per un limite CI.

## 4. Riproduci in locale — ma non aspettarti un ambiente identico

Se disponibile, usa la skill `start-isolated-worktree` per uno stack isolato dal
branch/commit della PR. Aspettati rumore ambientale non correlato al bug reale (un DB mai
"scaldato" da run precedenti si comporta diversamente da uno condiviso e riscaldato) — non
confondere quel rumore con la causa che stai cercando; se persiste ed è riproducibile, è
comunque un secondo problema reale da segnalare a parte, non da ignorare né da far passare
per il bug originale.

Se il fallimento non si riproduce affatto in locale nonostante più tentativi puliti, quello è
ESATTAMENTE il segnale per guardare i log server-side del passo 3 — non per etichettare il
tutto "flaky" e andare avanti.

## 5. Solo ora, ipotesi di codice — e testale, non indovinarla

Se i passi 1-3 escludono (o non spiegano del tutto) una causa infrastrutturale, e il sospetto
è una race/interleaving nel codice: scrivi un test mirato con un gate esplicito e
controllabile (una Promise che risolvi tu, non un timeout indovinato) per forzare ESATTAMENTE
l'interleaving sospetto, invece di affidarti a un vero race timing-dependent che potrebbe non
ripetersi. Esempio del pattern:

```ts
let release!: () => void;
const gate = new Promise<void>((resolve) => {
  release = resolve;
});
// ... nel punto sospetto, `await gate` prima di procedere ...
// il test decide QUANDO risolvere `gate`, orchestrando l'ordine esatto degli eventi
```

Se il test passa pulito, hai escluso quell'ipotesi con certezza (non "sembra a posto") —
passa alla prossima superficie (livello React/hook, funzione di calcolo pura con dati
realistici, ecc.) invece di insistere sulla stessa.

## Da non fare mai

- Non concludere "probabilmente flaky" senza aver letto uno screenshot/trace/log reale della
  run fallita.
- Non fidarti di un log incollato/troncato in chat come fonte primaria — scarica sempre gli
  artifact reali quando disponibili.
- Non assumere che una run rifletta il tuo ultimo commit — verifica lo SHA.
- Non alzare un timeout come primo tentativo di fix senza prima aver verificato se il
  fallimento è "in ritardo" o "bloccato per sempre" (un valore congelato in uno screenshot lo
  dice subito) — un timeout più alto non risolve un fallimento che non converge mai.
- Non scrivere test di race "a sensazione" con `setTimeout`/attese indovinate — usa sempre un
  gate esplicito che il test controlla.
- Se la causa reale è un fallimento transiente (rete, edge runtime, provider esterno): la fix
  è retry con backoff nel punto giusto, mai un timeout più largo da solo — un timeout più
  largo nasconde un fallimento che non converge, non lo risolve.
