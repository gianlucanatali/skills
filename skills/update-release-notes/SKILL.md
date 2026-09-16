---
name: update-release-notes
description: Use when the user wants to draft user-facing release notes/changelog content by diffing an upstream "already released" branch against a staging branch that has the next release's material, filtering out internal-only commits, and drafting "What's New"/"Fixes" content into a docs folder — ready to be copied into a separate changelog page/component if the site lives in a different repo. Trigger phrases — "aggiorna le release notes", "prepara il changelog per il rilascio", "cosa mettiamo nelle release notes questo mese", "bozza release notes".
---

# Aggiornare le release notes dell'app

Produce **solo contenuto** (markdown, nello stile "Novità"/"Correzioni" — o l'equivalente
del tuo progetto — imitato dalla pagina reale a ogni esecuzione, non congelato in questo
file, vedi punto 2) dentro `docs/release-notes/` (adatta il path alla convenzione del tuo
progetto) del repo dell'app. **Non tocca mai** il repo del sito/changelog se è separato — il
porting del contenuto nella pagina reale resta un passo manuale successivo, fatto quando si
pubblica.

## Il confronto: branch upstream "già rilasciato" vs branch di lavoro con il prossimo rilascio

- `<upstream-branch>` (es. `upstream/main`) = il riferimento "già rilasciato/condiviso".
- `<your-branch>` (es. `origin/staging`) = tutto quello che non è ancora arrivato
  all'upstream, cioè esattamente il materiale del prossimo rilascio.

Verifica i nomi reali con `git remote -v` sul tuo progetto — non chiedere ogni volta quale
branch usare una volta stabilita la convenzione, e non usare un branch di lavoro personale
o `HEAD` al posto del branch di staging condiviso.

## Input

**Periodo:** `$ARGUMENTS` (es. "Agosto 2026"). Se non specificato, usa il mese e l'anno
correnti in italiano — la data di oggi è già nel contesto della sessione, non serve un
`date` di shell (dipende dal locale della macchina).

## 1. Fetch e range del diff

```bash
git fetch <upstream-remote> <upstream-branch>
git fetch <your-remote> <your-branch>
git log <upstream-remote>/<upstream-branch>..<your-remote>/<your-branch> --oneline
```

Se l'output è vuoto: non c'è niente di nuovo da rilasciare. Dillo all'utente e fermati — non
creare un file vuoto.

## 2. Trova il riferimento di stile reale — PRIMA di scrivere qualunque riga

Le regole scritte sotto sono una baseline di fallback, non la verità permanente — se la
pagina reale del changelog cambia (nuove categorie, tono diverso, più o meno dettaglio), la
bozza deve seguire QUELLO, non un testo fermo scritto qui. Prima di generare contenuto,
cerca — in quest'ordine — l'esempio più recente di release notes REALE da imitare:

1. Il file/componente sorgente della pagina changelog reale, se accessibile in locale — è la
   fonte più autorevole perché è quello che è davvero pubblicato/verrà pubblicato. **Sola
   lettura**, non scriverci mai (vedi "Da non fare mai").
2. Se quel checkout locale non esiste o è chiaramente indietro, l'ultimo file in
   `docs/release-notes/*.md` generato da questa stessa skill.
3. Solo se nessuno dei due esiste (primissima esecuzione in assoluto), usa le regole scritte
   al punto 3 sotto come punto di partenza.

Dall'esempio trovato, estrai — non solo il markup, anche il **contenuto**: quante righe ha
"Novità" di solito, quanto sono lunghe le righe di "Correzioni", che **livello di
astrazione** usano (un bug di un tooltip specifico? o solo bug "importanti"?), come si
chiamano le categorie, che tono/persona usano, cosa viene tenuto fuori (voci troppo minori).
La bozza nuova deve somigliare a QUELLO nella forma — i contenuti ovviamente cambiano in
base al diff di questo mese.

## 3. Dispatch di un subagent per leggere il diff e scrivere la bozza

Il diff tra due branch di settimane/mesi di lavoro può essere grande — non leggerlo nel
thread principale. Usa un modello capace di giudizio (non un modello economico a basso
costo: capire cosa è user-facing e cosa è rumore interno è giudizio, non un task meccanico
a spec fissa).

Il prompt deve dare al subagent, esplicitamente:

- **L'esempio di stile trovato al punto 2** (incollato per intero nel prompt, non solo
  linkato — il subagent parte da zero e non lo trova da solo) con l'istruzione di imitarne
  forma, livello di dettaglio e tono **prima** di seguire le regole sotto, se i due sono in
  conflitto.
- Di orientarsi da solo nel repo con questi comandi:
  `git log <upstream>..<yours> --oneline`, `git log <upstream>..<yours> --stat`, e
  `git show <sha>` sui commit non chiari dal solo messaggio.
- **Cosa scartare interamente** (non genera nessuna riga): commit di refactor puro, test,
  CI/workflow, `chore`/dipendenze, migration senza effetto visibile per l'utente,
  documentazione, lavoro ancora dietro un flag disattivato per tutti.
- **Come classificare Novità vs Correzioni** — la domanda guida è: _l'utente ottiene una
  capacità che non aveva, o gli togliamo un fastidio che aveva?_ Solo la prima risposta va in
  Novità. Un miglioramento di performance o un bug che rendeva l'app inutilizzabile in un
  caso specifico resta comunque una Correzione, non una Novità, anche se il commit è
  corposo.
- **Stile — baseline di fallback**, usata solo se il punto 2 non ha trovato nessun esempio
  reale (primissima esecuzione):
  - **Novità**: poche righe (idealmente sotto le 8), una frase corta ciascuna, beneficio
    diretto per l'utente, seconda persona quando naturale ("Puoi...", "Ora..."). Zero
    paragrafi, zero "perché l'abbiamo fatto".
  - **Correzioni**: una riga secca per voce, **il fatto ORA**, non il comportamento
    precedente — "Il tooltip mostra l'importo corretto", non "Prima il tooltip mostrava
    sempre 0,00 €, ora è stato corretto". Raggruppa per area prodotto — deriva i gruppi da
    cosa è cambiato davvero, non da un elenco fisso.
  - **Zero gergo interno**: niente nomi di funzioni/tabelle/PR/branch, niente dettagli
    implementativi (framework usato, nome della migration). Tradotto in termini che un
    utente non tecnico capisce.
  - **Zero ripetizione**: ogni fatto compare una volta sola, o in Novità o in Correzioni,
    mai in entrambe.
  - **Italiano** (o la lingua del tuo prodotto), coerente con il tono già in uso nel resto
    del sito.
- Di restituire **solo** il markdown finale delle due sezioni (niente frontmatter, lo
  aggiunge questa skill), pronto per essere scritto su file.

## 4. Scrivi il file

`docs/release-notes/<YYYY-MM>.md` (es. `docs/release-notes/2026-08.md`), con in testa:

```markdown
# Release notes — <Mese Anno>

_Bozza generata da `update-release-notes` il <data odierna>. Range:
`<upstream>@<sha corto>..<yours>@<sha corto>`. Contenuto pronto per essere copiato (solo il
testo, non questo file) nella pagina/componente del changelog al momento della
pubblicazione._

## Novità

...

## Correzioni

### <Area>

...
```

Se il file per quel periodo esiste già (rilancio della skill più avanti nello stesso mese,
con più commit arrivati nel frattempo): sovrascrivilo con la bozza rigenerata — è tracciato
in git, la versione precedente resta comunque recuperabile dalla storia — ma **dillo
esplicitamente** all'utente prima di farlo, non farlo silenziosamente.

## 5. Aggiorna l'indice

`docs/release-notes/README.md` — una riga per periodo, la più recente in cima, dentro dei
marker:

```markdown
<!-- release-notes:index:start -->

- [Agosto 2026](2026-08.md) — <riassunto di una riga: le 1-2 novità principali>

<!-- release-notes:index:end -->
```

Se `docs/release-notes/README.md` non esiste ancora (prima esecuzione di questa skill),
crealo prima con questa struttura minima:

```markdown
# Release notes — bozze per il changelog pubblico

Bozze generate da `update-release-notes` (diff `<upstream>..<yours>`). Contenuto pronto per
essere copiato nella pagina/componente del changelog — questa cartella non pubblica nulla
da sola.

## Indice

<!-- release-notes:index:start -->

<!-- release-notes:index:end -->
```

## 6. Fermati per revisione umana

Mostra il contenuto generato (non solo "fatto") e chiedi conferma prima di considerare il
lavoro concluso — non committare da solo, salvo che il progetto committi automaticamente su
richiesta esplicita. Se qualcosa nel diff non è chiaro se sia user-facing o interno,
segnalalo esplicitamente invece di scegliere in silenzio.

## Da non fare mai

- Mai scrivere o modificare file dentro il repo del sito/changelog, se è separato — fuori
  scope di questa skill.
- Mai includere un fatto sia in Novità sia in Correzioni.
- Mai scrivere una riga di Correzioni che racconta il comportamento **precedente** — solo
  il fatto vero adesso.
- Mai una card/paragrafo per voce di Novità — sempre una riga sola.
- Mai gergo implementativo (nomi di funzioni, tabelle, PR) nel testo finale.
- Mai creare un file per un periodo senza commit reali nel range (`git log` vuoto →
  fermarsi, dirlo, non generare nulla).
- Mai committare i file generati senza che l'utente lo chieda esplicitamente.
