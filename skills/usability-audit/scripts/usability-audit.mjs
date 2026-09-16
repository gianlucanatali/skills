#!/usr/bin/env node
// Usability/accessibility static scanner for a React (Router) `src/` tree.
//
// Why this exists instead of a generic third-party scanner: generic WCAG
// scanners tend to treat every .tsx FILE as a standalone HTML page needing
// its own <main>/skip-link, with no notion of React composition (flagging a
// modal, a banner, or a tiny status-indicator component all for "missing
// <main> landmark"). This scanner instead reads the REAL route table from
// your router entry file to know which files are actual pages, and checks
// components/modals only for things that apply to them regardless of
// composition (keyboard reachability, focus indicators, form semantics) —
// not landmark/skip-link, which is usually centralized in one shell
// component and should be checked once, not per file.
//
// ponytail: regex-based, not an AST parser. An AST-based version would catch
// more and false-positive less, but the marginal cases here are exactly the
// kind that need a human glance anyway (is this input+button really a
// submit flow, or a filter that live-updates?). Upgrade path: swap the regex
// checks for @typescript-eslint's parser if false positives become a real
// cost in practice — nothing downstream depends on the regex implementation
// detail.
//
// Usage:
//   node usability-audit.mjs [--json] [--app-file src/App.tsx] [--modal-component AppModal]
//
// --app-file: your router entry file, containing the <Route element={<X>}>
//   table used to detect which files are actual pages. Defaults to
//   src/App.tsx (a common React Router convention) — override for a
//   different router setup, or if pages aren't detectable this way, skip
//   the headings check entirely by pointing --app-file at a nonexistent
//   file (page-file detection then yields zero pages, so check #9 never
//   fires) and rely on level 2/3 of the SKILL.md instead.
// --modal-component: the name of your project's shared modal component (if
//   it has one), used by check #7. Defaults to "AppModal" as a placeholder —
//   override to match your project's real component name, or drop check #7
//   if your project has no single modal primitive.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const argv = process.argv.slice(2);
const JSON_OUTPUT = argv.includes("--json");
const APP_FILE = argv.includes("--app-file")
  ? argv[argv.indexOf("--app-file") + 1]
  : path.join(SRC, "App.tsx");
const MODAL_COMPONENT = argv.includes("--modal-component")
  ? argv[argv.indexOf("--modal-component") + 1]
  : "AppModal";

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name.endsWith(".test.tsx"))
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (
      entry.isFile() &&
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
    )
      out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

// ─── Step 1: build the real page-route list from your router entry file ───
// Only these files get checked for <h1> presence — everything else is a
// component/modal, not a "page", and doesn't need its own h1/landmark.
// Matches two common React Router patterns: lazy-loaded pages
// (`const X = lazy(() => import("./pages/X"))`) and plain top-level page
// imports (`import X from "./pages/X"`).
function findPageFiles() {
  if (!fs.existsSync(APP_FILE)) return new Set();
  const appTsx = fs.readFileSync(APP_FILE, "utf8");
  const appDir = path.dirname(APP_FILE);
  const importMap = {}; // ComponentName -> resolved file path
  for (const m of appTsx.matchAll(
    /const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("(\.\/[^"]+)"\)\)/g,
  )) {
    const [, name, importPath] = m;
    const resolved = path.join(appDir, importPath.replace(/^\.\//, ""));
    for (const ext of [".tsx", ".ts", "/index.tsx"]) {
      if (fs.existsSync(resolved + ext)) {
        importMap[name] = resolved + ext;
        break;
      }
    }
  }
  for (const m of appTsx.matchAll(
    /^import\s+(\w+)\s+from\s+"(\.\/pages\/[^"]+)"/gm,
  )) {
    const [, name, importPath] = m;
    const resolved = path.join(appDir, importPath.replace(/^\.\//, ""));
    for (const ext of [".tsx", ".ts", "/index.tsx"]) {
      if (fs.existsSync(resolved + ext)) {
        importMap[name] = resolved + ext;
        break;
      }
    }
  }
  const pages = new Set();
  for (const m of appTsx.matchAll(/<Route\s[^>]*?element=\{<(\w+)/g)) {
    const componentName = m[1];
    if (importMap[componentName]) pages.add(importMap[componentName]);
  }
  return pages;
}

// Scans forward from the start of a JSX opening tag (`<div`, `<button`, ...)
// and returns just that tag's own text, up to its closing `>`/`/>` — tracking
// `{}` depth so an arrow function inside a prop value (`onClick={() => ...}`,
// whose `=>` contains a literal `>`) is never mistaken for the tag boundary.
// This is the fix for the false-positive flood a naive `[^>]*>` regex
// produces on every JSX file that has an inline arrow-function prop.
function findOpeningTag(content, startIdx) {
  let i = startIdx;
  let depth = 0;
  while (i < content.length) {
    const c = content[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth <= 0) return content.slice(startIdx, i + 1);
    i++;
  }
  return content.slice(startIdx, i);
}

// Given the position/text of a JSX element's opening tag, returns the text
// between it and its matching closing tag (depth-tracked, so nested same-name
// tags don't confuse the boundary). Used by the nested-interactive check both
// for `<div>`/`<span>` wrappers and for JSX call sites of a named component.
function extractTagBody(content, tagName, matchIndex, openTag) {
  const openRe = new RegExp(`<${tagName}\\b`, "g");
  const closeRe = new RegExp(`</${tagName}>`, "g");
  let depth = 1;
  let pos = matchIndex + openTag.length;
  let bodyEnd = content.length;
  while (pos < content.length && depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const nextOpen = openRe.exec(content);
    const nextClose = closeRe.exec(content);
    if (!nextClose) break;
    if (nextOpen && nextOpen.index < nextClose.index) {
      const innerOpenTag = findOpeningTag(content, nextOpen.index);
      if (!/\/>\s*$/.test(innerOpenTag)) depth++;
      pos = nextOpen.index + innerOpenTag.length;
    } else {
      depth--;
      pos = nextClose.index + nextClose[0].length;
      if (depth === 0) bodyEnd = nextClose.index;
    }
  }
  return content.slice(matchIndex + openTag.length, bodyEnd);
}

// ─── Checks ─────────────────────────────────────────────────────────────
const findings = []; // {severity, category, file, line, message}

function add(severity, category, file, lineNum, message) {
  findings.push({
    severity,
    category,
    file: rel(file),
    line: lineNum,
    message,
  });
}

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length;
}

function checkFile(file, content, isPage) {
  // 1. onClick on non-interactive elements without keyboard support.
  //    Skip the well-known non-issue: a handler whose ENTIRE body is
  //    `stopPropagation()` — it performs no action, so there is nothing for
  //    a keyboard user to trigger.
  for (const m of content.matchAll(/<(div|span|li|td|img)\b/g)) {
    const tag = findOpeningTag(content, m.index);
    if (!/\bonClick=/.test(tag)) continue;
    const onClickMatch = tag.match(/onClick=\{([\s\S]*)$/);
    const handlerBody = onClickMatch ? onClickMatch[1].replace(/\}$/, "") : "";
    const isStopPropagationOnly =
      /^\s*\(?\s*\w*\s*\)?\s*=>\s*\w+\.stopPropagation\(\)\s*;?\s*$/.test(
        handlerBody,
      );
    if (isStopPropagationOnly) continue;
    const hasRole = /\brole=/.test(tag);
    const hasTabIndex = /\btabIndex=/.test(tag);
    const hasKeyDown = /\bonKeyDown=/.test(tag);
    if (!(hasRole && hasTabIndex && hasKeyDown)) {
      add(
        "critical",
        "keyboard",
        file,
        lineOf(content, m.index),
        `<${m[1]}> ha onClick ma manca role+tabIndex+onKeyDown`,
      );
    }
  }

  // 2. outline removed without a focus-visible replacement in the SAME className.
  for (const m of content.matchAll(
    /className=\{?["'`][^"'`]*?\b(outline-none|focus:outline-none)\b[^"'`]*?["'`]/g,
  )) {
    const block = m[0];
    if (!/focus-visible:(ring|border|outline)/.test(block)) {
      add(
        "critical",
        "focus-visible",
        file,
        lineOf(content, m.index),
        "outline rimosso senza un sostituto focus-visible:ring-*/border-* nella stessa className",
      );
    }
  }

  // 3. window.confirm / window.alert — most design systems have a dedicated
  //    confirm-dialog/modal component instead.
  for (const m of content.matchAll(/window\.(confirm|alert)\(/g)) {
    add(
      "major",
      "consistency",
      file,
      lineOf(content, m.index),
      `window.${m[1]}() invece del componente dialog/modale condiviso del progetto`,
    );
  }

  // 4. Recharts chart roots without accessibilityLayer.
  for (const m of content.matchAll(
    /<(BarChart|LineChart|PieChart|AreaChart|ComposedChart|RadarChart)\b/g,
  )) {
    const tag = findOpeningTag(content, m.index);
    if (!/accessibilityLayer/.test(tag)) {
      add(
        "major",
        "charts",
        file,
        lineOf(content, m.index),
        `<${m[1]}> senza prop accessibilityLayer`,
      );
    }
  }

  // 5. <table> without aria-label/caption (checked in the opening tag + next 3 lines).
  for (const m of content.matchAll(/<table\b[^>]*>/g)) {
    const windowEnd = Math.min(content.length, m.index + m[0].length + 200);
    const nearby = content.slice(m.index, windowEnd);
    if (!/aria-label=|<caption/.test(nearby)) {
      add(
        "moderate",
        "tables",
        file,
        lineOf(content, m.index),
        "<table> senza aria-label o <caption>",
      );
    }
  }

  // 6. Repeated radio/checkbox `name=` without an enclosing <fieldset> anywhere in file.
  const radioNames = {};
  for (const m of content.matchAll(
    /type=["'](radio|checkbox)["'][\s\S]{0,120}?name=["']([^"']+)["']/g,
  )) {
    radioNames[m[2]] = (radioNames[m[2]] || 0) + 1;
  }
  const hasFieldset = /<fieldset/.test(content);
  for (const [name, count] of Object.entries(radioNames)) {
    if (count > 1 && !hasFieldset) {
      add(
        "moderate",
        "forms",
        file,
        1,
        `${count}x input con name="${name}" (radio/checkbox) senza <fieldset>/<legend> nel file`,
      );
    }
  }

  // 7. Modal with input(s) but no native <form> — Enter-to-submit likely broken.
  //    Heuristic, file-level: flags candidates for manual triage, not a hard rule
  //    (a read-only review modal or a live-filter input legitimately has no submit).
  //    Uses MODAL_COMPONENT (see --modal-component) as the marker for "this file
  //    renders a modal at all" — skip/adjust if your project has no single modal
  //    primitive.
  const modalTagRegex = new RegExp(`<${MODAL_COMPONENT}\\b`);
  if (
    modalTagRegex.test(content) &&
    /<(input|textarea|select)\b/.test(content) &&
    !/<form\b/.test(content)
  ) {
    add(
      "review",
      "form-submit",
      file,
      1,
      `<${MODAL_COMPONENT}> con input ma senza <form> nativo — verificare se Invio deve inviare`,
    );
  }

  // 8. Icon-only <button> without aria-label (best-effort heuristic — bounded window,
  //    flags a button tag whose next ~6 lines contain an <svg> and no other
  //    non-whitespace JSX text before the button closes). Prone to both false
  //    positives (button text built from a variable) and negatives (deeply
  //    nested icon) — always needs a human look, hence "review" not "major".
  for (const m of content.matchAll(/<button\b/g)) {
    const tag = findOpeningTag(content, m.index);
    if (/aria-label=|aria-labelledby=/.test(tag)) continue;
    const afterIdx = m.index + tag.length;
    const closeIdx = content.indexOf("</button>", afterIdx);
    if (closeIdx === -1 || closeIdx - afterIdx > 600) continue;
    const body = content.slice(afterIdx, closeIdx);
    const hasSvgOrEmoji =
      /<svg\b/.test(body) ||
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(body);
    const strippedText = body
      .replace(/<svg[\s\S]*?<\/svg>/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (hasSvgOrEmoji && strippedText.length === 0) {
      add(
        "review",
        "icon-name",
        file,
        lineOf(content, m.index),
        "<button> solo-icona senza aria-label (nome accessibile assente)",
      );
    }
  }

  // 9. Page-root files: must have exactly one <h1>.
  if (isPage) {
    const h1Count = (content.match(/<h1\b/g) || []).length;
    if (h1Count === 0) add("major", "headings", file, 1, "pagina senza <h1>");
  }

  // 10. role="button"/"link" wrapping another interactive control — ARIA
  //     nested-interactive violation even when the inner control is disabled
  //     (a disabled control is excluded from the operable a11y tree, but the
  //     DOM/ARIA structural conflict — a button-role element containing
  //     another button/link/form-control — remains). A hidden <input> (either
  //     type="hidden" or a "hidden" utility class, e.g. the file-picker
  //     trigger pattern in TransactionImportModal.tsx) is display:none and
  //     therefore removed from the accessibility tree entirely — not a
  //     violation, explicitly excluded below.
  //
  //     A `role="button"` wrapper that only renders `{children}` (a passthrough
  //     component, e.g. a tooltip/badge wrapper) can't be checked at its own
  //     definition — the actual nested-interactive violation only exists where
  //     the component is CALLED with an interactive child. For that case, this
  //     also resolves the enclosing component name and scans the same file's
  //     call sites of that component for a nested interactive tag.
  const checkedPassthroughNames = new Set();
  for (const m of content.matchAll(/<(div|span)\b/g)) {
    const openTag = findOpeningTag(content, m.index);
    if (!/role=["'](button|link)["']/.test(openTag)) continue;
    if (/\/>\s*$/.test(openTag)) continue; // self-closing, no children possible
    const tagName = m[1];
    const body = extractTagBody(content, tagName, m.index, openTag);
    const nestedTag = body.match(/<(button|a|select|textarea)\b/);
    const nestedVisibleInput = [...body.matchAll(/<input\b[^>]*>/g)].find(
      (im) =>
        !/type=["']hidden["']/.test(im[0]) &&
        !/className=\{?["'`][^"'`]*\bhidden\b/.test(im[0]),
    );
    const found = nestedTag ? nestedTag[1] : nestedVisibleInput ? "input" : null;
    if (found) {
      add(
        "critical",
        "nested-interactive",
        file,
        lineOf(content, m.index),
        `<${tagName} role="button"> contiene un <${found}> annidato — violazione ARIA nested-interactive, anche se l'elemento interno è disabled`,
      );
      continue;
    }
    if (!/\{children\}/.test(body)) continue;
    const defLine = lineOf(content, m.index);
    const before = content.slice(0, m.index);
    const nameMatches = [
      ...before.matchAll(/(?:function\s+(\w+)\s*\(|const\s+(\w+)\s*(?::[^=]*)?=\s*\([^)]*\)\s*(?::[^=]*)?=>)/g),
    ];
    const lastNameMatch = nameMatches[nameMatches.length - 1];
    const componentName = lastNameMatch && (lastNameMatch[1] || lastNameMatch[2]);
    if (!componentName || checkedPassthroughNames.has(componentName)) continue;
    checkedPassthroughNames.add(componentName);
    for (const call of content.matchAll(
      new RegExp(`<${componentName}\\b`, "g"),
    )) {
      const callOpenTag = findOpeningTag(content, call.index);
      if (/\/>\s*$/.test(callOpenTag)) continue; // self-closing, no children
      const callBody = extractTagBody(
        content,
        componentName,
        call.index,
        callOpenTag,
      );
      const callNestedTag = callBody.match(/<(button|a|select|textarea)\b/);
      const callNestedVisibleInput = [
        ...callBody.matchAll(/<input\b[^>]*>/g),
      ].find(
        (im) =>
          !/type=["']hidden["']/.test(im[0]) &&
          !/className=\{?["'`][^"'`]*\bhidden\b/.test(im[0]),
      );
      const callFound = callNestedTag
        ? callNestedTag[1]
        : callNestedVisibleInput
          ? "input"
          : null;
      if (callFound) {
        add(
          "critical",
          "nested-interactive",
          file,
          lineOf(content, call.index),
          `<${componentName}> (role="button" sul wrapper, definito riga ${defLine}) avvolge un <${callFound}> annidato in questo call site — violazione ARIA nested-interactive, anche se l'elemento interno è disabled`,
        );
      }
    }
  }
}

// ─── Run ────────────────────────────────────────────────────────────────
const pageFiles = findPageFiles();
const allFiles = walk(SRC);
for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  checkFile(file, content, pageFiles.has(file));
}

const severityOrder = { critical: 0, major: 1, moderate: 2, review: 3 };
findings.sort(
  (a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity] ||
    a.file.localeCompare(b.file),
);

if (JSON_OUTPUT) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const bySeverity = {};
  for (const f of findings)
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  console.log(
    `Usability audit — ${allFiles.length} file, ${pageFiles.size} pagine-radice riconosciute da ${rel(APP_FILE)}`,
  );
  console.log(
    `Finding: ${findings.length}  (` +
      Object.entries(bySeverity)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") +
      ")",
  );
  console.log("");
  for (const f of findings) {
    console.log(
      `[${f.severity.toUpperCase()}] ${f.category}  ${f.file}:${f.line}`,
    );
    console.log(`  ${f.message}`);
  }
}
