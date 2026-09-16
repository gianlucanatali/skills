---
name: push-workdir
description: Use to sync and push a private scratch backup directory (personal plans, notes, spike scripts) to a dedicated personal GitHub repo. Scans for accidentally-included secrets before committing.
---

# Push un backup scratch privato su GitHub

Pensato per un pattern comune: una cartella di scratch personale (piani, note, script
esplorativi) che vive DENTRO un repo di progetto ma è in realtà un repository git
indipendente e separato (remote proprio, spesso con sparse-checkout limitato a una
sotto-cartella), completamente separato dal repo principale — di norma quella cartella
è gitignorata nel repo principale, quindi questo repo scratch non interferisce mai con i
branch condivisi.

**Non è un repo che dovrebbe coinvolgere dati sensibili per design** — ma resta scratch
personale scritto in sessioni diverse, quindi questo skill fa comunque una scansione di
sicurezza prima di ogni push, non si fida ciecamente.

## Configurazione per-progetto

```json
{ "push-workdir": { "path": "_local/Workdir", "repo": "yourname/Workdir" } }
```

in `.claude-skills.json` alla root del repo. `path` è la cartella locale (relativa alla
root del repo) che ospita il repo scratch indipendente; `repo` è `owner/nome` del repo
GitHub target. Se `.claude-skills.json` non esiste o non ha la chiave `push-workdir`,
FERMATI e chiedi all'utente questi due valori — non indovinarli.

---

## Dispatch

Task meccanico (comandi git, grep, nessun giudizio architetturale): esegui questo skill
dispatchando un `Agent` con `model: "haiku"` (subagent generico) invece di lanciare i
comandi inline nella sessione principale. Passa a quell'agente il contenuto di questo
file come istruzioni.

**Eccezione:** se lo scan di sicurezza (step 3) trova un possibile segreto, NON risolverlo
autonomamente — riporta il problema alla sessione principale e fermati, è una decisione
che richiede giudizio umano.

---

## Steps

1. `cd <path>` e verifica che sia il repo giusto:
   `git remote get-url origin` deve contenere `<repo>`. Se non corrisponde o la cartella
   non esiste, fermati e segnala — non provare a ricrearla da zero.

2. `git status --short`. Se vuoto, riporta "niente da sincronizzare" e fermati — non
   creare un commit vuoto.

3. **Scansione di sicurezza PRIMA di stageare qualunque cosa.** Sui file nuovi/modificati
   (`git status --short` ti dice quali), cerca pattern di segreti reali:

   ```bash
   git status --short | awk '{print $2}' | xargs grep -lE \
     "sk_live|sbp_[a-f0-9]{20,}|vcp_[A-Za-z0-9]{20,}|GOCSPX-|AIzaSy[A-Za-z0-9_-]{25,}|-----BEGIN (RSA |EC |)PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{12,}" \
     2>/dev/null
   ```

   Se questo comando stampa anche un solo file: **FERMATI**, non committare e non
   pushare nulla. Riporta all'utente esattamente quale file e quale pattern ha fatto
   scattare l'allarme, e chiedi conferma esplicita prima di procedere (potrebbe essere un
   falso positivo — es. un fixture di test con valore fittizio — ma la decisione se
   procedere resta umana).

4. Se lo scan è pulito, stagea tutto — questo è un repo scratch personale, non il repo
   principale, `git add -A` è appropriato qui (a differenza di eventuali regole generali
   del progetto contro `-A`):

   ```bash
   git add -A
   ```

5. Componi un messaggio di commit breve che riassuma cosa è cambiato (nuovi piani
   aggiunti, note modificate, ecc. — usa `git status --short` prima dell'add per la lista
   file). Esempio:

   ```bash
   git commit -m "sync: aggiornamento scratch ($(date +%Y-%m-%d))"
   ```

6. `git push origin main`.

7. Riporta un riepilogo breve: quanti file aggiunti/modificati/rimossi, e il messaggio di
   commit usato.
