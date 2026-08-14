import test from "node:test";
import assert from "node:assert/strict";
import { adjudicateClaims, extractClaims } from "../src/claims.js";
import { detectFindings } from "../src/rules.js";
import type { Ledger } from "../src/types.js";

function ledger(): Ledger {
  return {
    runId: "run-test",
    startedAt: new Date(0).toISOString(),
    endedAt: new Date(1).toISOString(),
    cwd: process.cwd(),
    command: ["pytest", "tests/test_http.py", "-k", "retry"],
    exitCode: 0,
    transcript: "pytest tests/test_http.py -k retry\n12 passed, 1 skipped",
    transcriptHash: "transcript",
    commands: [{ id: "cmd-001", argv: ["pytest", "tests/test_http.py", "-k", "retry"], cwd: process.cwd(), startedAt: new Date(0).toISOString(), endedAt: new Date(1).toISOString(), durationMs: 1, exitCode: 0, actuallyRan: true, outputHash: "output", sensitive: false }],
    mutations: [
      { path: "tests/test_http.py", status: "modified", beforeHash: "before-test", afterHash: "after-test", diff: "-assertEqual(value, expected)\n+assertIsNotNone(value)", outsideGit: false },
      { path: "tests/test_timeout.py", status: "deleted", beforeHash: "deleted-test", outsideGit: false },
    ],
    tests: [{ framework: "pytest", source: "transcript", passed: 12, failed: 0, skipped: 1, errors: 0, total: 13, filter: "retry", rawHash: "tests" }],
    gitOperations: [{ command: "git commit --no-verify -m fix", flags: ["--no-verify"], cwd: process.cwd(), timestamp: new Date(0).toISOString(), risk: "sensitive" }],
    before: { capturedAt: new Date(0).toISOString(), trackedHash: "before", files: { "tests/test_http.py": "before-test", "tests/test_timeout.py": "deleted-test" }, contents: { "tests/test_http.py": "assertEqual(value, expected)", "tests/test_timeout.py": "def test_timeout(): pass" } },
    after: { capturedAt: new Date(1).toISOString(), trackedHash: "after", files: { "tests/test_http.py": "after-test" }, contents: { "tests/test_http.py": "assertIsNotNone(value)" } },
    chain: [],
  };
}

test("contradicts a full-suite claim when a filter was captured", () => {
  const claims = adjudicateClaims(extractClaims("All 412 tests pass"), ledger());
  assert.equal(claims[0]?.verdict, "CONTRADICTED");
  assert.match(claims[0]?.reason ?? "", /filter/i);
});

test("detects scope narrowing, test deletion, weakened assertions, and hook bypass", () => {
  const findings = detectFindings(ledger(), extractClaims("All 412 tests pass"));
  const ids = findings.map((item) => item.id);
  assert.ok(ids.includes("GW-001"));
  assert.ok(ids.includes("GW-003"));
  assert.ok(ids.includes("GW-004"));
  assert.ok(ids.includes("GW-012"));
});
