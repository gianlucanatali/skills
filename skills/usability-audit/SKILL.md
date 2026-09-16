---
name: usability-audit
description: Audit di usabilità/accessibilità di un repo React — scanner statico (pattern su src/) + react-axe (DOM reale in dev) + workflow browser dal vivo (Chrome DevTools MCP / Playwright MCP). Usa quando l'utente chiede un audit di accessibilità/usabilità, prima di chiudere un piano WCAG 2.2 AA, o periodicamente per verificare che non ci sia regressione.
---

# Usability audit

Tre livelli, in ordine di costo/affidabilità crescente — usali in sequenza, non solo il primo:

## 1. Scanner statico (secondi, nessun browser)

```bash
node scripts/usability-audit.mjs [--app-file src/App.tsx] [--modal-component AppModal]
```

Legge le vere route dal tuo file di routing (default `src/App.tsx`, un router entry file in
stile React Router — passa `--app-file` per un path diverso; se il tuo progetto non ha
questo pattern, punta a un file inesistente per disattivare il check "pagina senza h1" e
appoggiati ai livelli 2/3). Categorie: `keyboard` (onClick senza tastiera), `focus-visible`
(outline rimosso senza sostituto), `consistency` (window.confirm), `charts` (Recharts senza
accessibilityLayer), `tables` (senza caption/aria-label), `forms` (radio/checkbox senza
fieldset), `headings` (pagina senza h1), `form-submit`/`icon-name` (severità `review` —
euristiche, richiedono sempre conferma umana, non azionare alla cieca).

**Limiti noti** (documentali sempre quando riporti i risultati, non nasconderli):

- È basato su regex con uno scanner di profondità `{}` per delimitare i tag JSX (non un vero
  parser AST) — può avere falsi positivi/negativi su markup particolarmente annidato o
  dinamico.
- **Non vede markup reso da un componente condiviso importato** (cross-component
  blindness) — uno scanner `hasFieldset`/heading-check che grep-a solo il file chiamante non
  trova un `<h1>`/`<fieldset>` che vive dentro un componente wrapper condiviso (header di
  pagina, shell di layout, gruppo radio riusabile) invece che nel file della pagina stessa.
  Un finding su un file che usa uno di questi componenti condivisi va **sempre verificato a
  mano** leggendo il componente condiviso prima di trattarlo come reale — se mantieni un
  elenco dei componenti "che nascondono markup a11y allo scanner" nella tua documentazione,
  aggiornalo quando ne trovi uno nuovo.
- Le categorie `review` esistono apposta per i casi ambigui.

## 2. react-axe (dev, DOM reale, continuo)

Se agganciato nel tuo entry file principale dietro un flag di solo-sviluppo (es.
`import.meta.env.DEV`), ogni render stampa in console le violazioni axe-core reali
(contrasto calcolato dal browser, ARIA, focus, label) — leggile con Chrome DevTools MCP
`list_console_messages` (o Playwright MCP `browser_console_messages`, vedi nota sotto)
mentre navighi l'app, o direttamente nella console del browser durante sviluppo manuale.

## 3. Browser dal vivo (il livello che conta di più)

Usa `chrome-devtools-mcp:a11y-debugging` per Lighthouse audit, albero di accessibilità,
tracciamento Tab, tap target, su ogni pagina autenticata reale. È l'UNICO dei tre livelli
che verifica il comportamento reale (il focus si sposta davvero? il modale intrappola
davvero il Tab? uno screen reader annuncerebbe il nome giusto?) — i primi due leggono solo
il codice sorgente o i log statici, non l'interazione.

**Se il browser Chrome DevTools MCP condiviso risulta già in uso** (`Error: The browser is
already running for .../chrome-devtools/chrome-profile` — un'altra sessione/agente lo sta
usando in parallelo), non ucciderlo e non forzare un profilo alternativo alla cieca: usa gli
strumenti **Playwright MCP** (`mcp__plugin_playwright_playwright__browser_*`) come
alternativa equivalente — gestiscono un browser proprio, isolato, senza contendersi il
profilo condiviso. Le funzioni corrispondenti: `browser_navigate` (naviga), `browser_snapshot`
(albero a11y, equivalente a `take_snapshot`), `browser_press_key` (tastiera),
`browser_console_messages` (log console), `browser_click`/`browser_fill_form`/`browser_type`
(interazione).

### Autenticarsi per l'audit dal vivo

Usa credenziali di test già seedate dal tuo progetto (adatta al pattern reale del tuo E2E
setup) — non creare un utente ad-hoc se già ne esiste uno dedicato. Naviga alla route di
login reale della tua app, compila email/password, invia.

Un login manuale via MCP (non tramite gli helper E2E del progetto) **non** inietta
automaticamente eventuale stato "sbloccato" (chiave di crittografia, sessione avanzata) né
salta modal di onboarding — questo può essere intenzionale: ti porta esattamente sulla
schermata che un utente reale vedrebbe al primo accesso, utile per verificarla dal vivo
invece di bypassarla sempre. Se vuoi testare le pagine autenticate DOPO un onboarding
complesso da automatizzare via MCP, usa gli helper E2E del progetto dentro uno script
Playwright dedicato invece del browsing manuale.

### Gotcha ambientali per audit dal vivo in un ambiente isolato (worktree/staging locale)

Prima di concludere che login/bootstrap "non funziona" in un ambiente di sviluppo isolato,
verifica in quest'ordine:

1. **Il file di config/env dell'ambiente isolato punta allo stesso backend usato dal
   frontend?** Se il tuo script di seed E2E e il frontend leggono URL/chiavi da variabili
   d'ambiente diverse (o con default diversi), possono finire su due backend diversi — il
   seed crea l'utente su uno stack, il frontend autentica contro un altro, e il login
   fallisce con un errore di credenziali reale, non un problema di password. Verifica con
   una chiamata diretta all'endpoint di login su ENTRAMBI gli stack per confermare su quale
   esiste davvero l'utente prima di ipotizzare altro.
2. **Lo stack isolato ha tutte le migration applicate?** Un ambiente creato molto prima
   nella sessione (o i cui container sono sopravvissuti a una ricostruzione del branch) può
   avere uno schema indietro di diverse migration. Verifica quali container/processi
   appartengono davvero all'ambiente isolato prima di eseguire qualunque comando di
   migration mirato, per non toccare lo stack di un'altra sessione.
3. **Il primo bootstrap dopo il login può rispondere con un errore transitorio** (cold-start
   di un runtime edge/serverless locale) — lo stato iniziale lato client di un campo che
   dipende dal bootstrap può restare vuoto/null finché la chiamata non arriva con successo,
   facendo comparire schermate di "dato mancante" anche con i dati DB già corretti. Non è
   un bug applicativo: ripeti la navigazione.

## Quando fermarsi al livello 1

Per un controllo rapido pre-commit o in CI, il livello 1 basta (secondi, deterministico). Per
dichiarare una pagina/flusso "verificato accessibile", serve sempre il livello 3 almeno una
volta — ma un audit dal vivo esaustivo di OGNI route autenticata richiede tempo reale
(login, navigazione, interazione con ogni modale/wizard): se il tempo a disposizione è
limitato, verifica almeno i pattern più a rischio (un modale reale, il tab-order su una
pagina con form denso) invece di saltare il livello 3 del tutto — anche un campione mirato
batte zero verifica dal vivo.
