import test from "node:test";
import assert from "node:assert/strict";
import { detectFindings } from "../src/rules.js";
import { makeClaim, makeLedger } from "./helpers.js";

test("detects a constant stub return in a changed implementation", () => {
  const mutation = { path: "src/service.ts", status: "modified" as const, beforeHash: "before", afterHash: "after", outsideGit: false };
  const ledger = makeLedger({
    mutations: [mutation],
    before: { capturedAt: new Date(0).toISOString(), trackedHash: "before", files: { "src/service.ts": "function run() { return previous; }" }, contents: { "src/service.ts": "function run() { return previous; }" } },
    after: { capturedAt: new Date(1).toISOString(), trackedHash: "after", files: { "src/service.ts": "after" }, contents: { "src/service.ts": "function run() { return true; }" } },
  });
  assert.ok(detectFindings(ledger, []).some((finding) => finding.id === "GW-007"));
});

test("detects an empty catch handler", () => {
  const mutation = { path: "src/service.ts", status: "modified" as const, beforeHash: "before", afterHash: "after", outsideGit: false };
  const ledger = makeLedger({
    mutations: [mutation],
    before: { capturedAt: new Date(0).toISOString(), trackedHash: "before", files: { "src/service.ts": "try { run(); } catch (error) { log(error); }" }, contents: { "src/service.ts": "try { run(); } catch (error) { log(error); }" } },
    after: { capturedAt: new Date(1).toISOString(), trackedHash: "after", files: { "src/service.ts": "after" }, contents: { "src/service.ts": "try { run(); } catch (error) {}" } },
  });
  assert.ok(detectFindings(ledger, []).some((finding) => finding.id === "GW-008"));
});

test("falls back to transcript evidence for a sensitive Git operation", () => {
  const findings = detectFindings(makeLedger({ transcript: "$ git push --force\n", gitOperations: [] }), []);
  assert.equal(findings.filter((finding) => finding.id === "GW-012").length, 1);
});

test("detects a test claim with no test command or structured result", () => {
  const claim = makeClaim({ text: "All tests pass", kind: "test" });
  const findings = detectFindings(makeLedger({ command: ["node", "scripts/build.js"], transcript: "Build completed\n" }), [claim]);
  assert.ok(findings.some((finding) => finding.id === "GW-014"));
});

test("does not flag GW-014 when the command names a test runner", () => {
  const claim = makeClaim({ text: "All tests pass", kind: "test" });
  const findings = detectFindings(makeLedger({ command: ["npm", "test"], commands: [{ id: "cmd-001", argv: ["npm", "test"], cwd: process.cwd(), startedAt: new Date(0).toISOString(), endedAt: new Date(1).toISOString(), durationMs: 1, exitCode: 0, actuallyRan: true, outputHash: "output", sensitive: false }], transcript: "No structured result\n" }), [claim]);
  assert.equal(findings.some((finding) => finding.id === "GW-014"), false);
});
