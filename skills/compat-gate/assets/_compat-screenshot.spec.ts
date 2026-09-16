/**
 * Template git-tracked per lo screenshot before/after del compat-gate
 * (skills/compat-gate/SKILL.md, Fase 2 e Fase 4).
 *
 * NON è throwaway di per sé — è questo file, copiato così com'è in
 * `tests/e2e/_compat-screenshot.spec.ts` DENTRO il worktree "old" (Fase 2) e
 * poi DENTRO il worktree "new" (Fase 4). La copia nel worktree resta
 * throwaway (mai committata lì, rimossa a fine gate — vedi SKILL.md
 * "Cleanup"), ma la fonte non va reinventata/riscritta a mano ogni volta:
 * si copia da qui.
 *
 * ADATTA PRIMA DI USARE (sostituisci con i valori reali del tuo progetto):
 * - DEMO_EMAIL: l'utente demo/E2E del tuo progetto con dati realistici già
 *   seedati.
 * - PAGES: le rotte autenticate principali della tua app da fotografare.
 * - l'import di `login`/`loginAs` e di eventuali helper "salta questo tour/
 *   modale" — adatta ai nomi reali dei tuoi helper E2E (`./_helpers` qui è
 *   un placeholder per il file helper del tuo progetto).
 *
 * Import relativi scritti per la destinazione della copia
 * (tests/e2e/_compat-screenshot.spec.ts, stessa cartella dei tuoi helper
 * E2E) — NON per il percorso reale di questo file sorgente, che non viene
 * mai eseguito da qui.
 */
import { test } from "./_test"; // adatta al file base dei tuoi test E2E
import path from "node:path";
import { loginAs } from "./_helpers"; // adatta al tuo helper di login E2E

const DEMO_EMAIL = "e2e-demo@example.test"; // sostituisci con l'utente demo reale del tuo progetto
const PAGES = [
  "/dashboard",
  "/settings",
  // aggiungi qui le rotte autenticate principali del tuo progetto
];
const OUT_DIR = process.env.COMPAT_SCREENSHOT_DIR!;

test("compat-gate screenshot", async ({ page }) => {
  await loginAs(page, DEMO_EMAIL);
  for (const route of PAGES) {
    await page.goto(`${process.env.E2E_BASE_URL}${route}`);
    await page.waitForLoadState("networkidle");
    // Se il tuo progetto ha un onboarding/tour che intercetta i click al
    // primo login, chiama qui l'helper equivalente per saltarlo.
    await page.screenshot({
      path: path.join(OUT_DIR, `${route.slice(1).replace(/\//g, "-")}.png`),
      fullPage: true,
    });
  }
});
