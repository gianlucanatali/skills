import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function runScannerOn(tsxSource) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "usability-audit-"));
  const srcDir = path.join(tmpDir, "src");
  fs.mkdirSync(path.join(srcDir, "pages"), { recursive: true });
  fs.writeFileSync(
    path.join(srcDir, "App.tsx"),
    "export default function App() { return null; }\n",
  );
  fs.writeFileSync(path.join(srcDir, "pages", "Probe.tsx"), tsxSource);
  const scriptPath = path.join(import.meta.dirname, "usability-audit.mjs");
  const out = execFileSync("node", [scriptPath, "--json"], {
    cwd: tmpDir,
    encoding: "utf8",
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return JSON.parse(out);
}

test("nested-interactive: flags a role=button div wrapping a real <button>", () => {
  const findings = runScannerOn(`
    export default function Probe() {
      return (
        <div role="button" tabIndex={0} onClick={() => {}}>
          <button disabled>stub</button>
        </div>
      );
    }
  `);
  const hit = findings.find((f) => f.category === "nested-interactive");
  assert.ok(hit, "expected a nested-interactive finding");
  assert.equal(hit.severity, "critical");
});

test("nested-interactive: does NOT flag a hidden <input> inside role=button (legitimate file-trigger pattern)", () => {
  const findings = runScannerOn(`
    export default function Probe() {
      return (
        <div role="button" tabIndex={0} onClick={() => {}}>
          <svg />
          <input type="file" className="hidden" />
        </div>
      );
    }
  `);
  assert.equal(
    findings.filter((f) => f.category === "nested-interactive").length,
    0,
  );
});

test("nested-interactive: does NOT flag a role=button with only decorative children", () => {
  const findings = runScannerOn(`
    export default function Probe() {
      return (
        <span role="button" tabIndex={0}>
          <svg />
          <p>testo</p>
        </span>
      );
    }
  `);
  assert.equal(
    findings.filter((f) => f.category === "nested-interactive").length,
    0,
  );
});
